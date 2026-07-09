const fs = require('fs');
const path = require('path');
const { validateAllState } = require('../lib/validator');
const { extractBlockNames } = require('../lib/managed-blocks');
const { checkParityLedger } = require('../lib/parity-check');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function check(pathSegments, label, warnIfMissing = false) {
  return { pathSegments, label, warnIfMissing };
}

function run(args) {
  const strict = args.includes('--strict');
  const repoRoot = detectRepoRoot();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae doctor [options]

Check LazyTrae installation health.

Options:
  --help, -h   Show this help message
  --strict     Treat WARNs as FAILs
`);
    return;
  }

  const checks = [];
  let pass = 0;
  let fail = 0;
  let warn = 0;

  function addResult(label, status, detail) {
    checks.push({ label, status, detail });
    if (status === 'PASS') pass++;
    else if (status === 'FAIL') fail++;
    else warn++;
  }

  // .trae/rules/lazytrae.md
  const rulesPath = path.join(repoRoot, '.trae', 'rules', 'lazytrae.md');
  addResult('.trae/rules/lazytrae.md', fs.existsSync(rulesPath) ? 'PASS' : 'FAIL');

  // .trae/skills — at least 9
  const skillsDir = path.join(repoRoot, '.trae', 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')));
    const count = skillDirs.length;
    addResult(`.trae/skills/ (${count} skills)`, count >= 9 ? 'PASS' : 'FAIL',
      `Found ${count} skills, expected at least 9`);
  } else {
    addResult('.trae/skills/', 'FAIL', 'Directory not found');
  }

  // .trae/commands — at least 9
  const commandsDir = path.join(repoRoot, '.trae', 'commands');
  if (fs.existsSync(commandsDir)) {
    const cmdFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    const count = cmdFiles.length;
    addResult(`.trae/commands/ (${count} commands)`, count >= 9 ? 'PASS' : 'FAIL',
      `Found ${count} commands, expected at least 9`);
  } else {
    addResult('.trae/commands/', 'FAIL', 'Directory not found');
  }

  // .trae/agents — at least 11
  const agentsDir = path.join(repoRoot, '.trae', 'agents');
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    const count = agentFiles.length;
    addResult(`.trae/agents/ (${count} agents)`, count >= 11 ? 'PASS' : 'FAIL',
      `Found ${count} agents, expected at least 11`);
  } else {
    addResult('.trae/agents/', 'FAIL', 'Directory not found');
  }

  // .trae/hooks.json
  const hooksPath = path.join(repoRoot, '.trae', 'hooks.json');
  addResult('.trae/hooks.json', fs.existsSync(hooksPath) ? 'PASS' : 'WARN', 'v0.7 hooks support');

  // .trae/mcp.json
  const mcpPath = path.join(repoRoot, '.trae', 'mcp.json');
  addResult('.trae/mcp.json', fs.existsSync(mcpPath) ? 'PASS' : 'WARN', 'MCP config for v0.8');

  // .lazytrae/config.json
  const configPath = path.join(repoRoot, '.lazytrae', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      addResult('.lazytrae/config.json', 'PASS');
    } catch (e) {
      addResult('.lazytrae/config.json', 'FAIL', e.message);
    }
  } else {
    addResult('.lazytrae/config.json', 'FAIL');
  }

  // .lazytrae/state/*.json
  const stateDir = path.join(repoRoot, '.lazytrae', 'state');
  if (fs.existsSync(stateDir)) {
    const stateFiles = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));
    for (const sf of stateFiles) {
      try {
        JSON.parse(fs.readFileSync(path.join(stateDir, sf), 'utf-8'));
        addResult(`.lazytrae/state/${sf}`, 'PASS');
      } catch (e) {
        addResult(`.lazytrae/state/${sf}`, 'FAIL', e.message);
      }
    }
    if (stateFiles.length === 0) {
      addResult('.lazytrae/state/', 'FAIL', 'No state files found');
    }
  } else {
    addResult('.lazytrae/state/', 'FAIL', 'Directory not found');
  }

  // .lazytrae/schemas/*.json
  const schemaDir = path.join(repoRoot, '.lazytrae', 'schemas');
  if (fs.existsSync(schemaDir)) {
    const schemaFiles = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));
    for (const sf of schemaFiles) {
      try {
        JSON.parse(fs.readFileSync(path.join(schemaDir, sf), 'utf-8'));
        addResult(`.lazytrae/schemas/${sf}`, 'PASS');
      } catch (e) {
        addResult(`.lazytrae/schemas/${sf}`, 'FAIL', e.message);
      }
    }
    if (schemaFiles.length === 0) {
      addResult('.lazytrae/schemas/', 'FAIL', 'No schema files found');
    }
  } else {
    addResult('.lazytrae/schemas/', 'FAIL', 'Directory not found');
  }

  // .lazytrae/evidence/*.md
  const evidenceDir = path.join(repoRoot, '.lazytrae', 'evidence');
  if (fs.existsSync(evidenceDir)) {
    const evidenceFiles = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.md'));
    addResult(`.lazytrae/evidence/ (${evidenceFiles.length} files)`, evidenceFiles.length >= 6 ? 'PASS' : 'WARN',
      `Found ${evidenceFiles.length} evidence files, expected at least 6`);
  } else {
    addResult('.lazytrae/evidence/', 'WARN', 'Directory not found');
  }

  // .omo/ directories
  const omoPlans = path.join(repoRoot, '.omo', 'plans');
  const omoUlw = path.join(repoRoot, '.omo', 'ulw-loop');
  addResult('.omo/plans/', fs.existsSync(omoPlans) ? 'PASS' : 'WARN');
  addResult('.omo/ulw-loop/', fs.existsSync(omoUlw) ? 'PASS' : 'WARN');

  // AGENTS.md with managed blocks
  const agentsPath = path.join(repoRoot, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    const blocks = extractBlockNames(content);
    const expectedBlocks = ['version-numbering', 'plan-files', 'command-index'];
    const missing = expectedBlocks.filter(b => !blocks.includes(b));
    if (missing.length === 0) {
      addResult('AGENTS.md managed blocks', 'PASS', `${blocks.length} blocks intact`);
    } else {
      addResult('AGENTS.md managed blocks', 'FAIL', `Missing: ${missing.join(', ')}`);
    }
  } else {
    addResult('AGENTS.md', 'FAIL', 'Not found');
  }

  // Schema validation
  const schemaResults = validateAllState(repoRoot);
  for (const [stateFile, result] of Object.entries(schemaResults)) {
    if (result.valid) {
      addResult(`Schema validation: ${stateFile}`, 'PASS');
    } else {
      addResult(`Schema validation: ${stateFile}`, 'FAIL', result.errors.join('; '));
    }
  }

  // Parity ledger
  const parityResult = checkParityLedger(repoRoot);
  if (!parityResult.present) {
    addResult('Parity ledger', 'FAIL', parityResult.errors.join('; '));
  } else if (parityResult.errors.length > 0) {
    addResult('Parity ledger', 'WARN', parityResult.errors.join('; '));
  } else {
    addResult('Parity ledger', 'PASS',
      `${parityResult.complete}/${parityResult.total} (${parityResult.coverage}%) complete`);
  }

  // Print report
  console.log(`LazyTrae Doctor v0.6.0`);
  console.log(`Repo root: ${repoRoot}\n`);

  const maxLabelLen = Math.max(...checks.map(c => c.label.length), 0);
  for (const check of checks) {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
    const label = check.label.padEnd(maxLabelLen + 2);
    console.log(`${icon} ${label} ${check.status}`);
    if (check.detail) {
      console.log(`   ${check.detail}`);
    }
  }

  console.log(`\n=== Results: ${pass} PASS, ${warn} WARN, ${fail} FAIL ===`);

  const effectiveFail = strict ? (fail + warn) : fail;
  process.exit(effectiveFail > 0 ? 1 : 0);
}

module.exports = { run };