const fs = require('fs');
const path = require('path');
const { copyRepoDir, copyRepoFileIfChanged, ensureRepoDir, writeRepoFile } = require('../lib/templates');
const { appendManagedGitignoreBlock } = require('../lib/managed-gitignore');
const { localLauncherContext, materializeGuidance } = require('../lib/local-launcher');
const { preflightMcpDeclaration, updateMcpDeclaration } = require('../lib/mcp-declaration');
const { RECEIPT_PATH, installProjectAssets } = require('../lib/project-assets');
const { ensureToolingState } = require('../lib/tooling-state');
const { inspectGitMetadata } = require('../lib/git-repository');
const { readHost } = require('../lib/host-route');
const { routeFor } = require('../lib/host-adapter-lifecycle');
const { generateCandidate } = require('../lib/traecli-candidate');
const {
  installVerifiedHookConfiguration, preflightVerifiedHookConfiguration,
} = require('../lib/trae-ide-config');
const { inspectManagedBlocks } = require('../lib/managed-blocks');
const { CURRENT_VERSION } = require('../lib/version');

function detectRepoRoot() {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

function run(args) {
  if (args.includes('--force')) throw new Error('--force is not supported; asset ownership conflicts cannot be bypassed.');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae init [options]

Install LazyTrae into the current repo.

Options:
  --help, -h   Show this help message
  --host <id>  Run the final load check for ide, work, or cli
  --ide-probe <path>  Verified host-probe JSON authorizing the IDE Hook schema
  --global-hooks <path>  Explicit absolute global Hook config path; never guessed
  --skills-dir <path>  Override TraeWork's global skills directory with --host work
`);
    return;
  }

  const host = readHost(args);
  routeFor(host);
  const work = host === 'work' ? require('./work') : null;
  const workSkillsDir = work ? work.readSkillsDir(args) : null;
  const probeIndex = args.indexOf('--ide-probe');
  const globalHooksIndex = args.indexOf('--global-hooks');
  const ideProbePath = probeIndex === -1 ? null : args[probeIndex + 1];
  const globalHooksPath = globalHooksIndex === -1 ? null : args[globalHooksIndex + 1];
  const repoRoot = detectRepoRoot();
  localLauncherContext();
  const templatesDir = path.resolve(__dirname, '..', '..', 'templates');

  const summary = { created: [], updated: [], skipped: [], merged: [], warnings: [] };

  const existingAgentsPath = path.join(repoRoot, 'AGENTS.md');
  if (fs.existsSync(existingAgentsPath)) {
    const inspection = inspectManagedBlocks(fs.readFileSync(existingAgentsPath, 'utf8'));
    if (inspection.malformed.length > 0) {
      throw new Error(`AGENTS.md has malformed managed markers: ${inspection.malformed.join(', ')}`);
    }
  }
  preflightVerifiedHookConfiguration({
    repoRoot,
    probePath: ideProbePath,
    globalHooksPath,
    templatePath: path.join(templatesDir, 'hooks.json'),
  });
  preflightMcpDeclaration(
    repoRoot,
    path.join(templatesDir, 'mcp.json'),
    path.join(repoRoot, '.trae', 'mcp.json'),
  );

  console.log(`LazyTrae init v${CURRENT_VERSION}`);
  console.log(`Repo root: ${repoRoot}\n`);

  const gitStatus = inspectGitMetadata(repoRoot);
  if (gitStatus.status === 'WARN') summary.warnings.push(gitStatus.detail);

  // Create directory structure
  const dirs = [
    '.agents/skills', '.trae/rules', '.trae/skills', '.trae/commands', '.trae/agents', '.trae/hooks',
    '.lazytrae/state', '.lazytrae/evidence', '.lazytrae/schemas', '.lazytrae/logs',
    '.lazytrae/plans', '.lazytrae/loop',
  ];
  for (const dir of dirs) {
    const fullPath = path.join(repoRoot, dir);
    ensureRepoDir(repoRoot, fullPath);
  }

  const assetReceiptExisted = fs.existsSync(path.join(repoRoot, RECEIPT_PATH));
  const assetsResult = installProjectAssets(repoRoot);
  if (assetsResult.written.length > 0) summary.created.push(`${assetsResult.written.length} receipt-owned host asset files`);
  else summary.skipped.push('receipt-owned host assets (no changes)');
  if (assetsResult.preserved.length > 0) {
    const commands = assetsResult.preserved.filter((item) => item.startsWith('.trae/commands/'));
    if (commands.length > 0) {
      summary.skipped.push(`refused to overwrite ${commands.length} modified command files (preserved; resolve ownership before retrying)`);
      process.exitCode = 1;
    }
    const others = assetsResult.preserved.length - commands.length;
    if (others > 0) summary.skipped.push(`preserved ${others} caller-modified managed asset files`);
  }
  if (!assetReceiptExisted) summary.created.push(RECEIPT_PATH);

  try {
    const mcpUpdate = updateMcpDeclaration(repoRoot,
      path.join(templatesDir, 'mcp.json'),
      path.join(repoRoot, '.trae', 'mcp.json')
    );
    if (mcpUpdate.status === 'updated' && mcpUpdate.refreshed) {
      summary.updated.push(`.trae/mcp.json (refreshed stale launcher ${JSON.stringify(mcpUpdate.previousLauncher)})`);
    } else if (mcpUpdate.status === 'updated') {
      summary.created.push('.trae/mcp.json');
    } else if (mcpUpdate.status === 'preserved_modified') {
      summary.skipped.push(`.trae/mcp.json (${mcpUpdate.detail})`);
      process.exitCode = 1;
    } else if (mcpUpdate.status === 'unavailable_existing' || mcpUpdate.status === 'unavailable_absent') {
      const manualHostAction = host === 'work'
        ? 'TraeWork requires manual Settings → MCP registration'
        : 'complete MCP registration manually with your host';
      const declarationState = mcpUpdate.status === 'unavailable_existing'
        ? 'existing declaration preserved'
        : 'declaration was not written';
      summary.skipped.push(`.trae/mcp.json (protected destination; ${declarationState}; ${manualHostAction})`);
    }
  } catch (e) {
    summary.skipped.push(`.trae/mcp.json (copy failed: ${e.message})`);
    process.exitCode = 1;
  }

  try {
    const hooks = installVerifiedHookConfiguration({
      repoRoot,
      probePath: ideProbePath,
      globalHooksPath,
      templatePath: path.join(templatesDir, 'hooks.json'),
    });
    if (hooks.status === 'updated') summary.created.push(`${hooks.written.length} verified Hook configuration file(s)`);
    else summary.skipped.push('Hook configuration (probe did not verify the IDE event/config schema)');
  } catch (e) {
    summary.skipped.push(`Hook configuration (merge refused: ${e.message})`);
    process.exitCode = 1;
  }

  // Copy .lazytrae/config.json
  if (!fs.existsSync(path.join(repoRoot, '.lazytrae', 'config.json'))) {
    copyRepoFileIfChanged(repoRoot,
      path.join(templatesDir, 'config.json'),
      path.join(repoRoot, '.lazytrae', 'config.json')
    );
    summary.created.push('.lazytrae/config.json');
  } else {
    summary.skipped.push('.lazytrae/config.json (already exists)');
  }

  // Copy .lazytrae/schemas/
  const schemasResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'schemas'),
    path.join(repoRoot, '.lazytrae', 'schemas'),
    { overwrite: false },
  );
  if (schemasResult.created > 0) summary.created.push(`${schemasResult.created} schema files`);
  if (schemasResult.updated > 0) summary.updated.push(`${schemasResult.updated} schema files`);

  // Copy .lazytrae/evidence/
  const evidenceResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'evidence'),
    path.join(repoRoot, '.lazytrae', 'evidence'),
    { overwrite: false },
  );
  if (evidenceResult.created > 0) summary.created.push(`${evidenceResult.created} evidence files`);
  if (evidenceResult.updated > 0) summary.updated.push(`${evidenceResult.updated} evidence files`);

  // Copy .lazytrae/state/
  const stateResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'state'),
    path.join(repoRoot, '.lazytrae', 'state'),
    { overwrite: false },
  );
  if (stateResult.created > 0) summary.created.push(`${stateResult.created} state files`);
  if (stateResult.updated > 0) summary.updated.push(`${stateResult.updated} state files`);

  if (ensureToolingState(repoRoot)) summary.created.push('.lazytrae/state/tooling.json');

  // Handle AGENTS.md with managed blocks
  const agentsTemplatePath = path.join(templatesDir, 'AGENTS.md');
  const agentsDestPath = path.join(repoRoot, 'AGENTS.md');
  if (fs.existsSync(agentsTemplatePath)) {
    const templateContent = materializeGuidance(fs.readFileSync(agentsTemplatePath, 'utf-8'), repoRoot);
    const mb = require('../lib/managed-blocks');

    if (fs.existsSync(agentsDestPath)) {
      let existingContent = fs.readFileSync(agentsDestPath, 'utf-8');
      let merges = 0;

      const templateBlockNames = mb.extractBlockNames(templateContent);
      for (const blockName of templateBlockNames) {
        const templateBlock = mb.extractBlock(templateContent, blockName);
        if (templateBlock === null) continue;

        if (mb.hasManagedBlock(existingContent, blockName)) {
          const existingBlock = mb.extractBlock(existingContent, blockName);
          if (!mb.sameBlockContent(existingBlock, templateBlock)) {
            existingContent = mb.replaceBlock(existingContent, blockName, templateBlock.trim());
            merges++;
          }
        } else {
          existingContent = mb.replaceBlock(existingContent, blockName, templateBlock.trim());
          merges++;
        }
      }

      if (merges > 0) {
        writeRepoFile(repoRoot, agentsDestPath, existingContent);
        summary.merged.push(`AGENTS.md (${merges} managed blocks updated)`);
      } else {
        summary.skipped.push('AGENTS.md (no changes needed)');
      }
    } else {
      writeRepoFile(repoRoot, agentsDestPath, templateContent);
      summary.created.push('AGENTS.md');
    }
  }

  // Handle .gitignore entries
  const gitignorePath = path.join(repoRoot, '.gitignore');
  const gitignoreExists = fs.existsSync(gitignorePath);
  const gitignoreContent = gitignoreExists ? fs.readFileSync(gitignorePath, 'utf-8') : '';
  const nextGitignoreContent = appendManagedGitignoreBlock(gitignoreContent);
  if (nextGitignoreContent !== gitignoreContent) {
    writeRepoFile(repoRoot, gitignorePath, nextGitignoreContent);
    summary[gitignoreExists ? 'updated' : 'created'].push('.gitignore');
  } else {
    summary.skipped.push('.gitignore (already has LazyTrae entries)');
  }

  if (!process.exitCode && host === 'cli') {
    const candidate = generateCandidate(repoRoot);
    summary.created.push(`${candidate.written.length} TraeCode CLI candidate asset(s)`);
  }

  // Print summary
  console.log('=== Init Summary ===\n');
  if (summary.created.length > 0) {
    console.log('Created:');
    summary.created.forEach(s => console.log(`  + ${s}`));
  }
  if (summary.updated.length > 0) {
    console.log('\nUpdated:');
    summary.updated.forEach(s => console.log(`  ~ ${s}`));
  }
  if (summary.merged.length > 0) {
    console.log('\nMerged:');
    summary.merged.forEach(s => console.log(`  * ${s}`));
  }
  if (summary.skipped.length > 0) {
    console.log('\nSkipped:');
    summary.skipped.forEach(s => console.log(`  - ${s}`));
  }
  if (summary.warnings.length > 0) {
    console.log('\nWarnings:');
    summary.warnings.forEach(s => console.log(`  ! ${s}`));
  }
  if (process.exitCode) return process.exitCode;
  if (host === 'work') {
    work.install(workSkillsDir);
  }
  const loadCheckArgs = ['--host', host];
  const loadCheck = () => require('./load-check').run(loadCheckArgs);
  const loadStatus = work ? work.withSkillsDirOverride(workSkillsDir, loadCheck) : loadCheck();
  if (loadStatus !== 0) {
    process.exitCode = loadStatus;
    return loadStatus;
  }
  console.log('\nDone.');
  return 0;
}

module.exports = { readHost, run };
