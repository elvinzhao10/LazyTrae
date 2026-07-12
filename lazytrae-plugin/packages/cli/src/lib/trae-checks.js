const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Runs all .trae/ structural checks (rules, skills, commands, agents, hooks, mcp).
 * Returns an array of { label, status, detail? } result objects.
 *
 * @param {string} repoRoot - Absolute path to the repo root.
 * @returns {Array<{label: string, status: 'PASS'|'FAIL'|'WARN', detail?: string}>}
 */
function checkTraeStructure(repoRoot) {
  const results = [];

  // .trae/rules/lazytrae.md
  const rulesPath = path.join(repoRoot, '.trae', 'rules', 'lazytrae.md');
  results.push({ label: '.trae/rules/lazytrae.md', status: fs.existsSync(rulesPath) ? 'PASS' : 'FAIL' });

  // .trae/skills — at least 9
  const skillsDir = path.join(repoRoot, '.trae', 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')));
    const count = skillDirs.length;
    results.push({
      label: `.trae/skills/ (${count} skills)`,
      status: count >= 9 ? 'PASS' : 'FAIL',
      detail: `Found ${count} skills, expected at least 9`,
    });
  } else {
    results.push({ label: '.trae/skills/', status: 'FAIL', detail: 'Directory not found' });
  }

  // .trae/commands — at least 9
  const commandsDir = path.join(repoRoot, '.trae', 'commands');
  if (fs.existsSync(commandsDir)) {
    const cmdFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    const count = cmdFiles.length;
    results.push({
      label: `.trae/commands/ (${count} commands)`,
      status: count >= 9 ? 'PASS' : 'FAIL',
      detail: `Found ${count} commands, expected at least 9`,
    });
  } else {
    results.push({ label: '.trae/commands/', status: 'FAIL', detail: 'Directory not found' });
  }

  // .trae/agents — at least 11
  const agentsDir = path.join(repoRoot, '.trae', 'agents');
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    const count = agentFiles.length;
    results.push({
      label: `.trae/agents/ (${count} agents)`,
      status: count >= 11 ? 'PASS' : 'FAIL',
      detail: `Found ${count} agents, expected at least 11`,
    });
  } else {
    results.push({ label: '.trae/agents/', status: 'FAIL', detail: 'Directory not found' });
  }

  // .trae/hooks.json
  const hooksPath = path.join(repoRoot, '.trae', 'hooks.json');
  if (fs.existsSync(hooksPath)) {
    try {
      const hooksConfig = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
      const hookEvents = Object.keys(hooksConfig.hooks || {});
      results.push({
        label: '.trae/hooks.json',
        status: hookEvents.length >= 5 ? 'PASS' : 'WARN',
        detail: `${hookEvents.length} hook events configured, expected at least 5`,
      });
    } catch (e) {
      results.push({ label: '.trae/hooks.json', status: 'FAIL', detail: `Invalid JSON: ${e.message}` });
    }
  } else {
    results.push({ label: '.trae/hooks.json', status: 'WARN', detail: 'Hooks config for v0.7' });
  }

  // .trae/hooks/ — executability
  const hooksDir = path.join(repoRoot, '.trae', 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hookScripts = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
    if (hookScripts.length > 0) {
      const nonExec = [];
      for (const script of hookScripts) {
        try {
          fs.accessSync(path.join(hooksDir, script), fs.constants.X_OK);
        } catch (_) {
          nonExec.push(script);
        }
      }
      results.push({
        label: '.trae/hooks/ executability',
        status: nonExec.length === 0 ? 'PASS' : 'WARN',
        detail: nonExec.length === 0
          ? `${hookScripts.length} scripts executable`
          : `Not executable: ${nonExec.join(', ')}`,
      });

      for (const script of hookScripts) {
        const rel = `.trae/hooks/${script}`;
        const syntax = spawnSync('bash', ['-n', path.join(hooksDir, script)], { encoding: 'utf-8' });
        results.push({
          label: `${rel} syntax`,
          status: syntax.status === 0 ? 'PASS' : 'FAIL',
          detail: syntax.status === 0
            ? 'bash -n passed'
            : `${syntax.stderr.trim() || syntax.stdout.trim() || 'Invalid shell syntax'}. Run \`bash -n ${rel}\` to diagnose.`,
        });
      }
    } else {
      results.push({ label: '.trae/hooks/', status: 'WARN', detail: 'No hook scripts found' });
    }
  } else {
    results.push({ label: '.trae/hooks/', status: 'WARN', detail: 'Directory not found' });
  }

  // .trae/mcp.json
  const mcpPath = path.join(repoRoot, '.trae', 'mcp.json');
  if (fs.existsSync(mcpPath)) {
    try {
      JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      results.push({ label: '.trae/mcp.json', status: 'PASS' });
    } catch (e) {
      results.push({ label: '.trae/mcp.json', status: 'FAIL', detail: `Invalid JSON: ${e.message}` });
    }
  } else {
    results.push({ label: '.trae/mcp.json', status: 'WARN', detail: 'MCP config for v0.15.0-alpha.3' });
  }

  return results;
}

module.exports = { checkTraeStructure };
