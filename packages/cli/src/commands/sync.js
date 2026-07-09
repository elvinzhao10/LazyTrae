const fs = require('fs');
const path = require('path');
const { copyDir, copyFileIfChanged } = require('../lib/templates');
const { replaceBlock, extractBlock, hasManagedBlock, extractBlockNames } = require('../lib/managed-blocks');

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

  console.log(`LazyTrae sync v0.6.0`);
  console.log(`Repo root: ${repoRoot}\n`);

  // Update .trae/agents/
  const agentsResult = copyDir(
    path.join(templatesDir, 'agents'),
    path.join(repoRoot, '.trae', 'agents')
  );
  if (agentsResult.updated > 0) summary.updated.push(`${agentsResult.updated} agent files`);
  else summary.skipped.push('agents (no changes)');

  // Update .trae/skills/
  const skillsResult = copyDir(
    path.join(templatesDir, 'skills'),
    path.join(repoRoot, '.trae', 'skills')
  );
  if (skillsResult.updated > 0) summary.updated.push(`${skillsResult.updated} skill files`);
  else summary.skipped.push('skills (no changes)');

  // Update .trae/commands/
  const commandsResult = copyDir(
    path.join(templatesDir, 'commands'),
    path.join(repoRoot, '.trae', 'commands')
  );
  if (commandsResult.updated > 0) summary.updated.push(`${commandsResult.updated} command files`);
  else summary.skipped.push('commands (no changes)');

  // Update .trae/rules/lazytrae.md
  if (copyFileIfChanged(
    path.join(templatesDir, 'rules', 'lazytrae.md'),
    path.join(repoRoot, '.trae', 'rules', 'lazytrae.md')
  )) {
    summary.updated.push('.trae/rules/lazytrae.md');
  } else {
    summary.skipped.push('.trae/rules/lazytrae.md (no changes)');
  }

  // Update .lazytrae/schemas/
  const schemasResult = copyDir(
    path.join(templatesDir, 'schemas'),
    path.join(repoRoot, '.lazytrae', 'schemas')
  );
  if (schemasResult.updated > 0) summary.updated.push(`${schemasResult.updated} schema files`);
  else summary.skipped.push('schemas (no changes)');

  // Update .lazytrae/evidence/ (only if missing, never overwrite)
  const evidenceResult = copyDir(
    path.join(templatesDir, 'evidence'),
    path.join(repoRoot, '.lazytrae', 'evidence')
  );
  if (evidenceResult.created > 0) summary.updated.push(`${evidenceResult.created} evidence files (created)`);
  else summary.skipped.push('evidence (no changes)');

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
      fs.writeFileSync(agentsDestPath, existingContent, 'utf-8');
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
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
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