const fs = require('fs');
const path = require('path');
const { ensureDir, copyDir, copyFileIfChanged } = require('../lib/templates');
const { replaceBlock, hasManagedBlock, extractBlock } = require('../lib/managed-blocks');

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
    console.log(`Usage: lazytrae init [options]

Install LazyTrae into the current repo.

Options:
  --help, -h   Show this help message
  --force      Force re-copy all files (even if unchanged)
`);
    return;
  }

  const repoRoot = detectRepoRoot();
  const force = args.includes('--force');
  const templatesDir = path.resolve(__dirname, '..', '..', 'templates');

  const summary = { created: [], updated: [], skipped: [], merged: [] };

  console.log(`LazyTrae init v0.6.0`);
  console.log(`Repo root: ${repoRoot}\n`);

  // Create directory structure
  const dirs = [
    '.trae/rules', '.trae/skills', '.trae/commands', '.trae/agents', '.trae/hooks',
    '.lazytrae/state', '.lazytrae/evidence', '.lazytrae/schemas', '.lazytrae/logs',
    '.omo/plans', '.omo/ulw-loop',
  ];
  for (const dir of dirs) {
    const fullPath = path.join(repoRoot, dir);
    ensureDir(fullPath);
  }

  // Copy .trae/agents/
  const agentsResult = copyDir(
    path.join(templatesDir, 'agents'),
    path.join(repoRoot, '.trae', 'agents')
  );
  if (agentsResult.created > 0) summary.created.push(`${agentsResult.created} agent files`);
  if (agentsResult.updated > 0) summary.updated.push(`${agentsResult.updated} agent files`);

  // Copy .trae/skills/
  const skillsResult = copyDir(
    path.join(templatesDir, 'skills'),
    path.join(repoRoot, '.trae', 'skills')
  );
  if (skillsResult.created > 0) summary.created.push(`${skillsResult.created} skill files`);
  if (skillsResult.updated > 0) summary.updated.push(`${skillsResult.updated} skill files`);

  // Copy .trae/commands/
  const commandsResult = copyDir(
    path.join(templatesDir, 'commands'),
    path.join(repoRoot, '.trae', 'commands')
  );
  if (commandsResult.created > 0) summary.created.push(`${commandsResult.created} command files`);
  if (commandsResult.updated > 0) summary.updated.push(`${commandsResult.updated} command files`);

  // Copy .trae/rules/lazytrae.md
  if (copyFileIfChanged(
    path.join(templatesDir, 'rules', 'lazytrae.md'),
    path.join(repoRoot, '.trae', 'rules', 'lazytrae.md')
  )) {
    force ? summary.updated.push('.trae/rules/lazytrae.md') : summary.created.push('.trae/rules/lazytrae.md');
  }

  // Copy .trae/mcp.json
  try {
    if (copyFileIfChanged(
      path.join(templatesDir, 'mcp.json'),
      path.join(repoRoot, '.trae', 'mcp.json')
    )) {
      summary.created.push('.trae/mcp.json');
    }
  } catch (e) {
    summary.skipped.push(`.trae/mcp.json (copy failed: ${e.message})`);
  }

  // Copy .trae/hooks.json
  try {
    if (copyFileIfChanged(
      path.join(templatesDir, 'hooks.json'),
      path.join(repoRoot, '.trae', 'hooks.json')
    )) {
      summary.created.push('.trae/hooks.json');
    }
  } catch (e) {
    summary.skipped.push(`.trae/hooks.json (copy failed: ${e.message})`);
  }

  // Copy .lazytrae/config.json
  if (!fs.existsSync(path.join(repoRoot, '.lazytrae', 'config.json'))) {
    copyFileIfChanged(
      path.join(templatesDir, 'config.json'),
      path.join(repoRoot, '.lazytrae', 'config.json')
    );
    summary.created.push('.lazytrae/config.json');
  } else {
    summary.skipped.push('.lazytrae/config.json (already exists)');
  }

  // Copy .lazytrae/schemas/
  const schemasResult = copyDir(
    path.join(templatesDir, 'schemas'),
    path.join(repoRoot, '.lazytrae', 'schemas')
  );
  if (schemasResult.created > 0) summary.created.push(`${schemasResult.created} schema files`);
  if (schemasResult.updated > 0) summary.updated.push(`${schemasResult.updated} schema files`);

  // Copy .lazytrae/evidence/
  const evidenceResult = copyDir(
    path.join(templatesDir, 'evidence'),
    path.join(repoRoot, '.lazytrae', 'evidence')
  );
  if (evidenceResult.created > 0) summary.created.push(`${evidenceResult.created} evidence files`);
  if (evidenceResult.updated > 0) summary.updated.push(`${evidenceResult.updated} evidence files`);

  // Copy .lazytrae/state/
  const stateResult = copyDir(
    path.join(templatesDir, 'state'),
    path.join(repoRoot, '.lazytrae', 'state')
  );
  if (stateResult.created > 0) summary.created.push(`${stateResult.created} state files`);
  if (stateResult.updated > 0) summary.updated.push(`${stateResult.updated} state files`);

  // Handle AGENTS.md with managed blocks
  const agentsTemplatePath = path.join(templatesDir, 'AGENTS.md');
  const agentsDestPath = path.join(repoRoot, 'AGENTS.md');
  if (fs.existsSync(agentsTemplatePath)) {
    const templateContent = fs.readFileSync(agentsTemplatePath, 'utf-8');
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
          if (existingBlock !== templateBlock) {
            existingContent = mb.replaceBlock(existingContent, blockName, templateBlock.trim());
            merges++;
          }
        } else {
          existingContent = mb.replaceBlock(existingContent, blockName, templateBlock.trim());
          merges++;
        }
      }

      if (merges > 0) {
        fs.writeFileSync(agentsDestPath, existingContent, 'utf-8');
        summary.merged.push(`AGENTS.md (${merges} managed blocks updated)`);
      } else {
        summary.skipped.push('AGENTS.md (no changes needed)');
      }
    } else {
      fs.copyFileSync(agentsTemplatePath, agentsDestPath);
      summary.created.push('AGENTS.md');
    }
  }

  // Handle .gitignore entries
  const gitignorePath = path.join(repoRoot, '.gitignore');
  const gitignoreEntries = [
    '',
    '# LazyTrae runtime (managed by lazytrae init)',
    '.lazytrae/state/',
    '.lazytrae/logs/',
    '.lazytrae/evidence/',
  ].join('\n');

  if (fs.existsSync(gitignorePath)) {
    let gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('# LazyTrae runtime')) {
      gitignoreContent = gitignoreContent.trimEnd() + '\n' + gitignoreEntries + '\n';
      fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
      summary.updated.push('.gitignore');
    } else {
      summary.skipped.push('.gitignore (already has LazyTrae entries)');
    }
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
  console.log('\nDone.');
}

module.exports = { run };