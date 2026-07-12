const fs = require('fs');
const path = require('path');
const { copyRepoDir, copyRepoFileIfChanged, ensureRepoDir, writeRepoFile } = require('../lib/templates');
const { replaceBlock, extractBlock, hasManagedBlock, extractBlockNames } = require('../lib/managed-blocks');
const { ensureToolingState, mergeMcpTemplate } = require('../lib/tooling-state');

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
    console.log(`Usage: lazytrae sync [options]

Update managed templates and managed blocks.

Options:
  --help, -h   Show this help message
`);
    return;
  }

  const repoRoot = detectRepoRoot();
  const templatesDir = path.resolve(__dirname, '..', '..', 'templates');

  const summary = { updated: [], skipped: [] };

  console.log(`LazyTrae sync v0.15.0-alpha.3`);
  console.log(`Repo root: ${repoRoot}\n`);

  for (const relativePath of ['.lazytrae/plans', '.lazytrae/loop']) {
    ensureRepoDir(repoRoot, path.join(repoRoot, relativePath));
  }

  // Update .trae/agents/
  const agentsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'agents'),
    path.join(repoRoot, '.trae', 'agents')
  );
  if (agentsResult.updated > 0) summary.updated.push(`${agentsResult.updated} agent files`);
  else summary.skipped.push('agents (no changes)');

  // Update .trae/skills/
  const skillsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'skills'),
    path.join(repoRoot, '.trae', 'skills')
  );
  if (skillsResult.updated > 0) summary.updated.push(`${skillsResult.updated} skill files`);
  else summary.skipped.push('skills (no changes)');

  // Update .trae/commands/
  const commandsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'commands'),
    path.join(repoRoot, '.trae', 'commands')
  );
  if (commandsResult.updated > 0) summary.updated.push(`${commandsResult.updated} command files`);
  else summary.skipped.push('commands (no changes)');

  // Update .trae/rules/
  const rulesResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'rules'),
    path.join(repoRoot, '.trae', 'rules')
  );
  if (rulesResult.created + rulesResult.updated > 0) {
    summary.updated.push(`${rulesResult.created + rulesResult.updated} rule files`);
  } else {
    summary.skipped.push('rules (no changes)');
  }

  for (const relativePath of ['.trae/hooks.json']) {
    const templatePath = path.join(templatesDir, relativePath.slice('.trae/'.length));
    const destinationPath = path.join(repoRoot, relativePath);
    if (copyRepoFileIfChanged(repoRoot, templatePath, destinationPath)) summary.updated.push(relativePath);
    else summary.skipped.push(`${relativePath} (no changes)`);
  }

  const mcpTemplatePath = path.join(templatesDir, 'mcp.json');
  const mcpDestinationPath = path.join(repoRoot, '.trae', 'mcp.json');
  if (mergeMcpTemplate(repoRoot, mcpTemplatePath, mcpDestinationPath)) summary.updated.push('.trae/mcp.json');
  else summary.skipped.push('.trae/mcp.json (no changes)');

  const hooksResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'hooks'),
    path.join(repoRoot, '.trae', 'hooks')
  );
  if (hooksResult.created + hooksResult.updated > 0) {
    summary.updated.push(`${hooksResult.created + hooksResult.updated} hook scripts`);
  } else {
    summary.skipped.push('hooks (no changes)');
  }

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
    const templateContent = fs.readFileSync(agentsTemplatePath, 'utf-8');
    let existingContent = fs.readFileSync(agentsDestPath, 'utf-8');
    const mb = require('../lib/managed-blocks');
    let merges = 0;

    const templateBlockNames = mb.extractBlockNames(templateContent);
    for (const blockName of templateBlockNames) {
      const templateBlock = mb.extractBlock(templateContent, blockName);
      if (templateBlock === null) continue;

      if (mb.hasManagedBlock(existingContent, blockName)) {
        const existingBlock = mb.extractBlock(existingContent, blockName);
        if (existingBlock !== templateBlock) {
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
  console.log('\nDone.');
}

module.exports = { run };
