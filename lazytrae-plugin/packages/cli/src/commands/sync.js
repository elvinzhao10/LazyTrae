const fs = require('fs');
const path = require('path');
const {
  chmodRepoFile, copyRepoDir, copyRepoFileIfChanged, ensureRepoDir, writeRepoFile,
} = require('../lib/templates');
const { localLauncherContext, materializeGuidance } = require('../lib/local-launcher');
const { updateMcpDeclaration } = require('../lib/mcp-declaration');
const { RECEIPT_PATH, checkProjectAssets, installProjectAssets } = require('../lib/project-assets');
const { ensureToolingState } = require('../lib/tooling-state');
const { inspectGitMetadata } = require('../lib/git-repository');
const {
  installVerifiedHookConfiguration, preflightVerifiedHookConfiguration,
} = require('../lib/trae-ide-config');
const { inspectManagedBlocks } = require('../lib/managed-blocks');
const { readHost } = require('../lib/host-route');
const { routeFor } = require('../lib/host-adapter-lifecycle');
const { generateCandidate } = require('../lib/traecli-candidate');
const { CURRENT_VERSION } = require('../lib/version');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function run(args) {
  if (args.includes('--force')) throw new Error('--force is not supported; asset ownership conflicts cannot be bypassed.');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae sync [options]

Update managed templates and managed blocks.

Options:
  --help, -h   Show this help message
  --check      Report stale, missing, orphaned, or modified generated assets without writing
  --host <id>  Select the ide, work, or cli adapter manifest route
  --ide-probe <path>  Verified host-probe JSON authorizing the IDE Hook schema
  --global-hooks <path>  Explicit absolute global Hook config path; never guessed
`);
    return;
  }

  const repoRoot = detectRepoRoot();
  const host = readHost(args);
  routeFor(host);
  const probeIndex = args.indexOf('--ide-probe');
  const globalHooksIndex = args.indexOf('--global-hooks');
  const ideProbePath = probeIndex === -1 ? null : args[probeIndex + 1];
  const globalHooksPath = globalHooksIndex === -1 ? null : args[globalHooksIndex + 1];
  localLauncherContext();
  const templatesDir = path.resolve(__dirname, '..', '..', 'templates');
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

  if (args.includes('--check')) {
    const result = checkProjectAssets(repoRoot);
    const candidate = host === 'cli' ? require('../lib/traecli-candidate').checkCandidate(repoRoot) : { issues: [] };
    const issues = [...result.issues, ...candidate.issues];
    if (issues.length === 0) {
      console.log('PASS receipt-owned host assets are current');
      return 0;
    }
    for (const issue of issues) console.log(`FAIL ${issue}`);
    return 1;
  }

  const summary = { updated: [], skipped: [], warnings: [] };

  console.log(`LazyTrae sync v${CURRENT_VERSION}`);
  console.log(`Repo root: ${repoRoot}\n`);

  const gitStatus = inspectGitMetadata(repoRoot);
  if (gitStatus.status === 'WARN') summary.warnings.push(gitStatus.detail);

  for (const relativePath of ['.lazytrae/plans', '.lazytrae/loop']) {
    ensureRepoDir(repoRoot, path.join(repoRoot, relativePath));
  }

  const assetReceiptExisted = fs.existsSync(path.join(repoRoot, RECEIPT_PATH));
  const assetsResult = installProjectAssets(repoRoot);
  if (assetsResult.written.length > 0) summary.updated.push(`${assetsResult.written.length} receipt-owned host asset files`);
  else if (!assetReceiptExisted) summary.updated.push(`${RECEIPT_PATH} (adopted exact legacy assets)`);
  else summary.skipped.push('receipt-owned host assets (no changes)');
  if (host === 'cli') {
    const candidate = generateCandidate(repoRoot);
    if (candidate.written.length > 0) summary.updated.push(`${candidate.written.length} TraeCode CLI candidate asset(s)`);
    else summary.skipped.push('TraeCode CLI candidate assets (no changes)');
  }

  // Update .trae/agents/
  const agentsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'agents'),
    path.join(repoRoot, '.trae', 'agents'),
    { overwrite: false },
  );
  if (agentsResult.updated > 0) summary.updated.push(`${agentsResult.updated} agent files`);
  else summary.skipped.push('agents (no changes)');

  // Update .trae/skills/
  const skillsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'skills'),
    path.join(repoRoot, '.trae', 'skills'),
    { overwrite: false },
  );
  if (skillsResult.updated > 0) summary.updated.push(`${skillsResult.updated} skill files`);
  else summary.skipped.push('skills (no changes)');

  // Update .trae/commands/
  const commandsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'commands'),
    path.join(repoRoot, '.trae', 'commands'),
    { overwrite: false },
  );
  if (commandsResult.updated > 0) summary.updated.push(`${commandsResult.updated} command files`);
  else summary.skipped.push('commands (no changes)');

  // Update .trae/rules/
  const rulesResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'rules'),
    path.join(repoRoot, '.trae', 'rules'),
    { overwrite: false },
  );
  if (rulesResult.created + rulesResult.updated > 0) {
    summary.updated.push(`${rulesResult.created + rulesResult.updated} rule files`);
  } else {
    summary.skipped.push('rules (no changes)');
  }

  try {
    const hooks = installVerifiedHookConfiguration({
      repoRoot,
      probePath: ideProbePath,
      globalHooksPath,
      templatePath: path.join(templatesDir, 'hooks.json'),
    });
    if (hooks.status === 'updated') summary.updated.push(`${hooks.written.length} verified Hook configuration file(s)`);
    else summary.skipped.push('Hook configuration (probe did not verify the IDE event/config schema)');
  } catch (error) {
    console.error(`LazyTrae sync: Hook configuration merge refused: ${error.message}`);
    return 1;
  }

  const mcpTemplatePath = path.join(templatesDir, 'mcp.json');
  const mcpDestinationPath = path.join(repoRoot, '.trae', 'mcp.json');
  let mcpUpdate;
  try {
    mcpUpdate = updateMcpDeclaration(repoRoot, mcpTemplatePath, mcpDestinationPath);
  } catch (error) {
    console.error(`LazyTrae sync: ${error.message}`);
    return 1;
  }
  if (mcpUpdate.status === 'updated' && mcpUpdate.refreshed) {
    summary.updated.push(`.trae/mcp.json (refreshed stale launcher ${JSON.stringify(mcpUpdate.previousLauncher)})`);
  } else if (mcpUpdate.status === 'updated') summary.updated.push('.trae/mcp.json');
  else if (mcpUpdate.status === 'preserved_modified') {
    summary.skipped.push(`.trae/mcp.json (${mcpUpdate.detail})`);
    process.exitCode = 1;
  }
  else if (mcpUpdate.status === 'unavailable_existing') summary.skipped.push('.trae/mcp.json (protected destination; existing declaration preserved; complete MCP registration manually with your host)');
  else if (mcpUpdate.status === 'unavailable_absent') summary.skipped.push('.trae/mcp.json (protected destination; declaration was not written; complete MCP registration manually with your host)');
  else summary.skipped.push('.trae/mcp.json (no changes)');

  const hooksResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'hooks'),
    path.join(repoRoot, '.trae', 'hooks'),
    { overwrite: false },
  );
  if (hooksResult.created + hooksResult.updated > 0) {
    summary.updated.push(`${hooksResult.created + hooksResult.updated} hook scripts`);
  } else {
    summary.skipped.push('hooks (no changes)');
  }
  const userPromptHook = path.join(repoRoot, '.trae', 'hooks', 'user-prompt-submit.sh');
  chmodRepoFile(repoRoot, userPromptHook, 0o755);

  // Update .lazytrae/schemas/
  const schemasResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'schemas'),
    path.join(repoRoot, '.lazytrae', 'schemas')
  );
  if (schemasResult.updated > 0) summary.updated.push(`${schemasResult.updated} schema files`);
  else summary.skipped.push('schemas (no changes)');

  // Update .lazytrae/evidence/ (only if missing, never overwrite)
  const evidenceResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'evidence'),
    path.join(repoRoot, '.lazytrae', 'evidence')
  );
  if (evidenceResult.created > 0) summary.updated.push(`${evidenceResult.created} evidence files (created)`);
  else summary.skipped.push('evidence (no changes)');

  const stateTemplateDir = path.join(templatesDir, 'state');
  const stateDir = path.join(repoRoot, '.lazytrae', 'state');
  let createdStateFiles = 0;
  for (const name of fs.readdirSync(stateTemplateDir)) {
    const destinationPath = path.join(stateDir, name);
    if (!fs.existsSync(destinationPath) && copyRepoFileIfChanged(repoRoot, path.join(stateTemplateDir, name), destinationPath)) {
      createdStateFiles++;
    }
  }
  if (createdStateFiles > 0) summary.updated.push(`${createdStateFiles} state files (created)`);
  else summary.skipped.push('state (consumer data preserved)');
  if (ensureToolingState(repoRoot)) summary.updated.push('.lazytrae/state/tooling.json (created)');

  // Update AGENTS.md managed blocks
  const agentsTemplatePath = path.join(templatesDir, 'AGENTS.md');
  const agentsDestPath = path.join(repoRoot, 'AGENTS.md');
  if (fs.existsSync(agentsTemplatePath) && fs.existsSync(agentsDestPath)) {
    const templateContent = materializeGuidance(fs.readFileSync(agentsTemplatePath, 'utf-8'), repoRoot);
    let existingContent = fs.readFileSync(agentsDestPath, 'utf-8');
    const mb = require('../lib/managed-blocks');
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
      }
    }

    if (merges > 0) {
      writeRepoFile(repoRoot, agentsDestPath, existingContent);
      summary.updated.push(`AGENTS.md (${merges} managed blocks updated)`);
    } else {
      summary.skipped.push('AGENTS.md managed blocks (no changes)');
    }
  }

  // Schema version migration
  const configPath = path.join(repoRoot, '.lazytrae', 'config.json');
  if (fs.existsSync(configPath)) {
    const templateConfig = JSON.parse(
      fs.readFileSync(path.join(templatesDir, 'config.json'), 'utf-8')
    );
    let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.schema_version !== templateConfig.schema_version) {
      config.schema_version = templateConfig.schema_version;
      writeRepoFile(repoRoot, configPath, JSON.stringify(config, null, 2) + '\n');
      summary.updated.push(`.lazytrae/config.json (schema_version: ${config.schema_version})`);
    } else {
      summary.skipped.push('.lazytrae/config.json (schema_version unchanged)');
    }
  }

  // Print summary
  console.log('=== Sync Summary ===\n');
  if (summary.updated.length > 0) {
    console.log('Updated:');
    summary.updated.forEach(s => console.log(`  ~ ${s}`));
  }
  if (summary.skipped.length > 0) {
    console.log('\nSkipped:');
    summary.skipped.forEach(s => console.log(`  - ${s}`));
  }
  if (summary.warnings.length > 0) {
    console.log('\nWarnings:');
    summary.warnings.forEach(s => console.log(`  ! ${s}`));
  }
  console.log('\nDone.');
  return process.exitCode || 0;
}

module.exports = { run };
