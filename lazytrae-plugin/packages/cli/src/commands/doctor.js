const fs = require('fs');
const path = require('path');
const { validateAllState, checkCompletedTaskEvidence } = require('../lib/validator');
const { extractBlockNames } = require('../lib/managed-blocks');
const { checkParityLedger } = require('../lib/parity-check');
const { checkModelRouting } = require('../lib/model-routing-check');
const { checkTraeStructure } = require('../lib/trae-checks');
const { checkTeamMode } = require('../lib/team-check');
const { checkStaleRecovery } = require('../lib/context-recovery');

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
  const sourceTree = fs.existsSync(path.join(repoRoot, 'packages', 'cli', 'src', 'index.js'));
  let pass = 0;
  let fail = 0;
  let warn = 0;

  function addResult(label, status, detail) {
    checks.push({ label, status, detail });
    if (status === 'PASS') pass++;
    else if (status === 'FAIL') fail++;
    else warn++;
  }

  // .trae/ structural checks (rules, skills, commands, agents, hooks, mcp)
  for (const r of checkTraeStructure(repoRoot)) {
    addResult(r.label, r.status, r.detail);
  }

  if (sourceTree) {
    const mcpIndexPath = path.join(repoRoot, 'packages', 'mcp', 'src', 'index.js');
    if (fs.existsSync(mcpIndexPath)) addResult('packages/mcp/src/index.js', 'PASS');
    else addResult('packages/mcp/src/index.js', 'FAIL', 'MCP server entry point not found');

    const mcpToolsPath = path.join(repoRoot, 'packages', 'mcp', 'src', 'tools.js');
    if (fs.existsSync(mcpToolsPath)) {
      try {
        const { TOOLS } = require(mcpToolsPath);
        const toolCount = TOOLS.length;
        addResult('MCP tools (15 expected)', toolCount === 15 ? 'PASS' : 'FAIL',
          `Found ${toolCount} MCP tools, expected 15`);
      } catch (e) {
        addResult('MCP tools', 'FAIL', `Cannot load tools.js: ${e.message}`);
      }
    } else {
      addResult('packages/mcp/src/tools.js', 'FAIL', 'MCP tools file not found');
    }
  } else {
    addResult('MCP runtime', 'WARN', 'Uses the installed lazytrae CLI; source-package checks skipped');
  }

  addResult('MCP server running', 'WARN', 'Started on demand by Trae IDE, Trae Work, or Trae CLI via lazytrae mcp');

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

  const plansDir = path.join(repoRoot, '.lazytrae', 'plans');
  const loopDir = path.join(repoRoot, '.lazytrae', 'loop');
  addResult('.lazytrae/plans/', fs.existsSync(plansDir) ? 'PASS' : 'WARN');
  addResult('.lazytrae/loop/', fs.existsSync(loopDir) ? 'PASS' : 'WARN');

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
      addResult('AGENTS.md managed blocks', 'WARN', 'Managed blocks absent (AGENTS.md is now a setup guide)');
    }
  } else {
    addResult('AGENTS.md', 'WARN', 'Not present (README is the onboarding guide)');
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

  const evidenceGate = checkCompletedTaskEvidence(repoRoot);
  addResult('Completed task evidence gate', evidenceGate.valid ? 'PASS' : 'FAIL',
    evidenceGate.valid ? 'All completed tasks have evidence paths' : evidenceGate.errors.join('; '));

  const recoveryResult = checkStaleRecovery(repoRoot);
  addResult(recoveryResult.label, recoveryResult.status, recoveryResult.detail);

  // Model routing config check (v0.10)
  const routingResult = checkModelRouting(repoRoot);
  addResult(routingResult.label, routingResult.status, routingResult.detail);

  // Team mode check (v0.11)
  const teamResult = sourceTree || fs.existsSync(path.join(repoRoot, '.lazytrae', 'team'))
    ? checkTeamMode(repoRoot)
    : { label: 'Team mode', status: 'WARN', detail: 'No team state initialized' };
  addResult(teamResult.label, teamResult.status, teamResult.detail);

  // Parity ledger
  if (sourceTree) {
    const parityResult = checkParityLedger(repoRoot);
    if (!parityResult.present) {
      addResult('Parity ledger', 'FAIL', parityResult.errors.join('; '));
    } else if (parityResult.errors.length > 0) {
      addResult('Parity ledger', 'WARN', parityResult.errors.join('; '));
    } else {
      addResult('Parity ledger', 'PASS',
        `${parityResult.complete}/${parityResult.total} (${parityResult.coverage}%) complete`);
    }
  } else {
    addResult('Parity ledger', 'WARN', 'Not included in an initialized consumer project');
  }

  // Print report
  console.log(`LazyTrae Doctor v0.16.0-alpha.1`);
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
