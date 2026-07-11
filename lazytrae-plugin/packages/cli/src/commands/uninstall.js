const fs = require('fs');
const path = require('path');
const { removeAllBlocks } = require('../lib/managed-blocks');
const { assertSafeRepoWritePath } = require('../lib/path-boundary');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function rimraf(repoRoot, dirPath) {
  if (!fs.existsSync(dirPath)) return;
  assertSafeRepoWritePath(repoRoot, dirPath);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      rimraf(repoRoot, fullPath);
    } else {
      assertSafeRepoWritePath(repoRoot, fullPath);
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dirPath);
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae uninstall [options]

Remove LazyTrae from the current repo.

Options:
  --help, -h       Show this help message
  --yes, -y        Skip confirmation prompt
  --soft           Only remove managed files (preserve .lazytrae/)
  --purge-state    Remove all LazyTrae runtime state
`);
    return;
  }

  const yes = args.includes('--yes') || args.includes('-y');
  const soft = args.includes('--soft');
  const purgeState = args.includes('--purge-state');

  if (!yes) {
    console.log('This will remove LazyTrae from the current repo.');
    if (soft) console.log('Mode: --soft (preserve .lazytrae/)');
    if (purgeState) console.log('Mode: --purge-state (remove everything)');
    console.log('Are you sure? Run with --yes to confirm.');
    process.exit(0);
  }

  const repoRoot = detectRepoRoot();
  const summary = { removed: [], preserved: [] };

  console.log(`LazyTrae uninstall v0.15.0-alpha.2`);
  console.log(`Repo root: ${repoRoot}\n`);

  // Remove .trae/ directory
  const traeDir = path.join(repoRoot, '.trae');
  if (fs.existsSync(traeDir)) {
    rimraf(repoRoot, traeDir);
    summary.removed.push('.trae/');
  }

  if (soft) {
    summary.preserved.push('.lazytrae/ (--soft)');
  } else {
    // Remove .lazytrae/ directory
    const lazytraeDir = path.join(repoRoot, '.lazytrae');
    if (fs.existsSync(lazytraeDir)) {
      if (purgeState) {
        rimraf(repoRoot, lazytraeDir);
        summary.removed.push('.lazytrae/ (including runtime state)');
      } else {
        const evidenceDir = path.join(lazytraeDir, 'evidence');
        const plansDir = path.join(lazytraeDir, 'plans');
        const loopDir = path.join(lazytraeDir, 'loop');
        const stateDir = path.join(lazytraeDir, 'state');
        if (fs.existsSync(evidenceDir)) summary.preserved.push('.lazytrae/evidence/');
        if (fs.existsSync(plansDir)) summary.preserved.push('.lazytrae/plans/');
        if (fs.existsSync(loopDir)) summary.preserved.push('.lazytrae/loop/');
        if (fs.existsSync(stateDir)) summary.preserved.push('.lazytrae/state/');

        // Remove everything else
        const entries = fs.readdirSync(lazytraeDir, { withFileTypes: true });
        for (const entry of entries) {
          if (['evidence', 'plans', 'loop', 'state'].includes(entry.name)) continue;
          const fullPath = path.join(lazytraeDir, entry.name);
          assertSafeRepoWritePath(repoRoot, fullPath);
          if (entry.isDirectory()) rimraf(repoRoot, fullPath);
          else fs.unlinkSync(fullPath);
        }
        summary.removed.push('.lazytrae/ (runtime state preserved)');
      }
    }
  }

  // Remove managed blocks from AGENTS.md
  const agentsPath = path.join(repoRoot, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    let content = fs.readFileSync(agentsPath, 'utf-8');
    const newContent = removeAllBlocks(content);
    if (newContent !== content) {
      assertSafeRepoWritePath(repoRoot, agentsPath);
      fs.writeFileSync(agentsPath, newContent, 'utf-8');
      summary.removed.push('AGENTS.md managed blocks');
    } else {
      summary.preserved.push('AGENTS.md (no managed blocks)');
    }
  }

  // Remove .gitignore entries
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    let content = fs.readFileSync(gitignorePath, 'utf-8');
    const marker = '# LazyTrae runtime';
    const idx = content.indexOf(marker);
    if (idx !== -1) {
      // Find the end of the LazyTrae section
      let endIdx = content.indexOf('\n\n', idx);
      if (endIdx === -1) endIdx = content.length;
      content = content.substring(0, idx).trimEnd() + '\n' + content.substring(endIdx);
      content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
      assertSafeRepoWritePath(repoRoot, gitignorePath);
      fs.writeFileSync(gitignorePath, content, 'utf-8');
      summary.removed.push('.gitignore LazyTrae entries');
    }
  }

  // Print summary
  console.log('=== Uninstall Summary ===\n');
  if (summary.removed.length > 0) {
    console.log('Removed:');
    summary.removed.forEach(s => console.log(`  - ${s}`));
  }
  if (summary.preserved.length > 0) {
    console.log('\nPreserved:');
    summary.preserved.forEach(s => console.log(`  + ${s}`));
  }
  console.log('\nDone.');
}

module.exports = { run };
