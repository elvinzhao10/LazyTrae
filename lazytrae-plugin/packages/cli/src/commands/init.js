const fs = require('fs');
const path = require('path');
const {
  chmodRepoFile, copyRepoDir, copyRepoFile, copyRepoFileIfChanged, ensureRepoDir, writeRepoFile,
} = require('../lib/templates');
const { replaceBlock, hasManagedBlock, extractBlock } = require('../lib/managed-blocks');
const { appendManagedGitignoreBlock } = require('../lib/managed-gitignore');
const { ensureToolingState, updateMcpDeclaration } = require('../lib/tooling-state');

const VALID_HOSTS = new Set(['ide', 'work', 'cli']);

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function readHost(args) {
  const hostIndex = args.indexOf('--host');
  if (hostIndex === -1) return 'ide';
  const host = args[hostIndex + 1];
  if (!VALID_HOSTS.has(host)) throw new Error('--host must be ide, work, or cli.');
  return host;
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae init [options]

Install LazyTrae into the current repo.

Options:
  --help, -h   Show this help message
  --force      Force re-copy all files (even if unchanged)
  --host <id>  Run the final load check for ide, work, or cli
  --skills-dir <path>
                Override Trae Work's global skills directory with --host work
`);
    return;
  }

  const host = readHost(args);
  const work = host === 'work' ? require('./work') : null;
  const workSkillsDir = work ? work.readSkillsDir(args) : null;
  const repoRoot = detectRepoRoot();
  const force = args.includes('--force');
  const templatesDir = path.resolve(__dirname, '..', '..', 'templates');

  const summary = { created: [], updated: [], skipped: [], merged: [] };

  console.log(`LazyTrae init v1.0.0`);
  console.log(`Repo root: ${repoRoot}\n`);

  // Create directory structure
  const dirs = [
    '.trae/rules', '.trae/skills', '.trae/commands', '.trae/agents', '.trae/hooks',
    '.lazytrae/state', '.lazytrae/evidence', '.lazytrae/schemas', '.lazytrae/logs',
    '.lazytrae/plans', '.lazytrae/loop',
  ];
  for (const dir of dirs) {
    const fullPath = path.join(repoRoot, dir);
    ensureRepoDir(repoRoot, fullPath);
  }

  // Copy .trae/agents/
  const agentsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'agents'),
    path.join(repoRoot, '.trae', 'agents')
  );
  if (agentsResult.created > 0) summary.created.push(`${agentsResult.created} agent files`);
  if (agentsResult.updated > 0) summary.updated.push(`${agentsResult.updated} agent files`);

  // Copy .trae/skills/
  const skillsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'skills'),
    path.join(repoRoot, '.trae', 'skills')
  );
  if (skillsResult.created > 0) summary.created.push(`${skillsResult.created} skill files`);
  if (skillsResult.updated > 0) summary.updated.push(`${skillsResult.updated} skill files`);

  // Copy .trae/commands/
  const commandsResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'commands'),
    path.join(repoRoot, '.trae', 'commands'),
    { overwrite: force },
  );
  if (commandsResult.created > 0) summary.created.push(`${commandsResult.created} command files`);
  if (commandsResult.updated > 0) summary.updated.push(`${commandsResult.updated} command files`);
  if (commandsResult.skipped > 0) {
    summary.skipped.push(`refused to overwrite ${commandsResult.skipped} modified command files (preserved; rerun with --force to overwrite)`);
    process.exitCode = 1;
  }

  // Copy .trae/rules/
  const rulesResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'rules'),
    path.join(repoRoot, '.trae', 'rules')
  );
  if (rulesResult.created > 0) summary.created.push(`${rulesResult.created} rule files`);
  if (rulesResult.updated > 0) summary.updated.push(`${rulesResult.updated} rule files`);

  try {
    const mcpUpdate = updateMcpDeclaration(repoRoot,
      path.join(templatesDir, 'mcp.json'),
      path.join(repoRoot, '.trae', 'mcp.json')
    );
    if (mcpUpdate.status === 'updated') {
      summary.created.push('.trae/mcp.json');
    } else if (mcpUpdate.status === 'unavailable_existing' || mcpUpdate.status === 'unavailable_absent') {
      const manualHostAction = host === 'work'
        ? 'Trae Work requires manual Settings → MCP registration'
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

  // Copy .trae/hooks.json
  try {
    if (copyRepoFileIfChanged(repoRoot,
      path.join(templatesDir, 'hooks.json'),
      path.join(repoRoot, '.trae', 'hooks.json')
    )) {
      summary.created.push('.trae/hooks.json');
    }
  } catch (e) {
    summary.skipped.push(`.trae/hooks.json (copy failed: ${e.message})`);
  }

  // Copy .trae/hooks/ shell scripts
  const hooksResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'hooks'),
    path.join(repoRoot, '.trae', 'hooks')
  );
  if (hooksResult.created > 0) summary.created.push(`${hooksResult.created} hook scripts`);
  if (hooksResult.updated > 0) summary.updated.push(`${hooksResult.updated} hook scripts`);

  // Make hook scripts executable
  const hooksDestDir = path.join(repoRoot, '.trae', 'hooks');
  if (fs.existsSync(hooksDestDir)) {
    const scripts = fs.readdirSync(hooksDestDir).filter(f => f.endsWith('.sh'));
    for (const script of scripts) {
      try {
        const scriptPath = path.join(hooksDestDir, script);
        chmodRepoFile(repoRoot, scriptPath, 0o755);
      } catch (_) { /* ignore */ }
    }
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
    path.join(repoRoot, '.lazytrae', 'schemas')
  );
  if (schemasResult.created > 0) summary.created.push(`${schemasResult.created} schema files`);
  if (schemasResult.updated > 0) summary.updated.push(`${schemasResult.updated} schema files`);

  // Copy .lazytrae/evidence/
  const evidenceResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'evidence'),
    path.join(repoRoot, '.lazytrae', 'evidence')
  );
  if (evidenceResult.created > 0) summary.created.push(`${evidenceResult.created} evidence files`);
  if (evidenceResult.updated > 0) summary.updated.push(`${evidenceResult.updated} evidence files`);

  // Copy .lazytrae/state/
  const stateResult = copyRepoDir(repoRoot,
    path.join(templatesDir, 'state'),
    path.join(repoRoot, '.lazytrae', 'state')
  );
  if (stateResult.created > 0) summary.created.push(`${stateResult.created} state files`);
  if (stateResult.updated > 0) summary.updated.push(`${stateResult.updated} state files`);

  if (ensureToolingState(repoRoot)) summary.created.push('.lazytrae/state/tooling.json');

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
        writeRepoFile(repoRoot, agentsDestPath, existingContent);
        summary.merged.push(`AGENTS.md (${merges} managed blocks updated)`);
      } else {
        summary.skipped.push('AGENTS.md (no changes needed)');
      }
    } else {
      copyRepoFile(repoRoot, agentsTemplatePath, agentsDestPath);
      summary.created.push('AGENTS.md');
    }
  }

  // Handle .gitignore entries
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const nextGitignoreContent = appendManagedGitignoreBlock(gitignoreContent);
    if (nextGitignoreContent !== gitignoreContent) {
      writeRepoFile(repoRoot, gitignorePath, nextGitignoreContent);
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
  if (host === 'work') {
    work.install(workSkillsDir);
  }
  const loadCheckArgs = ['--host', host];
  const loadCheck = () => require('./load-check').run(loadCheckArgs);
  const loadStatus = work ? work.withSkillsDirOverride(workSkillsDir, loadCheck) : loadCheck();
  if (loadStatus !== 0) process.exitCode = loadStatus;
}

module.exports = { readHost, run };
