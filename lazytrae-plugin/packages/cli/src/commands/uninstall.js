const fs = require('fs');
const path = require('path');
const { removeAllBlocks } = require('../lib/managed-blocks');
const { removeManagedGitignoreBlock } = require('../lib/managed-gitignore');
const { removeManagedMcpDeclaration } = require('../lib/mcp-declaration');
const { assertSafeRepoWritePath } = require('../lib/path-boundary');
const { removeEmptyDir, removeVerifiedFile, removeVerifiedTree } = require('../lib/owned-assets');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae uninstall [options]

Remove LazyTrae from the current repo.

Options:
  --help, -h       Show this help message
  --yes, -y        Skip confirmation prompt
  --soft           Remove verified .trae/ assets only
  --purge-state    Also remove verified .lazytrae runtime templates

Normal uninstall retains .lazytrae state/, evidence/, plans/, and loop/ data.
`);
    return;
  }

  const yes = args.includes('--yes') || args.includes('-y');
  const soft = args.includes('--soft');
  const purgeState = args.includes('--purge-state');
  if (soft && purgeState) throw new Error('--soft and --purge-state cannot be combined.');

  if (!yes) {
    console.log('This will remove LazyTrae from the current repo.');
    if (soft) console.log('Mode: --soft (preserve .lazytrae/)');
    if (purgeState) console.log('Mode: --purge-state (remove verified runtime templates)');
    console.log('Are you sure? Run with --yes to confirm.');
    process.exit(0);
  }

  const repoRoot = detectRepoRoot();
  const summary = { removed: [], preserved: [] };

  console.log(`LazyTrae uninstall v1.0.3`);
  console.log(`Repo root: ${repoRoot}\n`);

  const templatesDir = path.resolve(__dirname, '..', '..', 'templates');
  const traeDir = path.join(repoRoot, '.trae');
  const mcpRemoval = removeManagedMcpDeclaration(
    repoRoot,
    path.join(templatesDir, 'mcp.json'),
    path.join(traeDir, 'mcp.json'),
  );
  if (mcpRemoval.status === 'removed') summary.removed.push('.trae/mcp.json managed declaration');
  else if (mcpRemoval.status === 'updated') summary.removed.push('.trae/mcp.json managed entries');
  else if (mcpRemoval.status === 'preserved_modified') {
    summary.preserved.push('.trae/mcp.json (modified same-name LazyTrae entry)');
  }
  const traeFiles = removeVerifiedTree(repoRoot, templatesDir, traeDir);
  if (traeFiles > 0) {
    summary.removed.push(`${traeFiles} verified .trae/ asset(s)`);
  }
  removeEmptyDir(repoRoot, traeDir);

  const lazytraeDir = path.join(repoRoot, '.lazytrae');
  if (soft) {
    summary.preserved.push('.lazytrae/ (--soft)');
  } else {
    let lazytraeFiles = removeVerifiedFile(repoRoot, path.join(templatesDir, 'config.json'), path.join(lazytraeDir, 'config.json')) ? 1 : 0;
    lazytraeFiles += removeVerifiedTree(repoRoot, path.join(templatesDir, 'schemas'), path.join(lazytraeDir, 'schemas'));
    removeEmptyDir(repoRoot, path.join(lazytraeDir, 'schemas'));
    if (lazytraeFiles > 0) summary.removed.push(`${lazytraeFiles} verified .lazytrae/ asset(s)`);
    if (purgeState) {
      let runtimeFiles = removeVerifiedTree(repoRoot, path.join(templatesDir, 'state'), path.join(lazytraeDir, 'state'));
      runtimeFiles += removeVerifiedTree(repoRoot, path.join(templatesDir, 'evidence'), path.join(lazytraeDir, 'evidence'));
      removeEmptyDir(repoRoot, path.join(lazytraeDir, 'state'));
      removeEmptyDir(repoRoot, path.join(lazytraeDir, 'evidence'));
      if (runtimeFiles > 0) summary.removed.push(`${runtimeFiles} verified runtime asset(s)`);
    } else {
      summary.preserved.push('.lazytrae runtime data (state/, evidence/, plans/, and loop/; normal uninstall)');
    }
    removeEmptyDir(repoRoot, lazytraeDir);
  }

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

  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const nextContent = removeManagedGitignoreBlock(content);
    if (nextContent !== content) {
      assertSafeRepoWritePath(repoRoot, gitignorePath);
      fs.writeFileSync(gitignorePath, nextContent, 'utf-8');
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
