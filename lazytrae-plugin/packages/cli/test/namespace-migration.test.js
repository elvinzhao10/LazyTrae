const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { defaultLoop } = require('../src/lib/loop-store');
const { REPO_ROOT, runCli } = require('./test-helpers');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

test('fresh init keeps runtime state exclusively under .lazytrae', () => {
  const fixture = makeRepo('lazytrae-namespace-init-');

  try {
    const init = runCli(['init', '--host', 'ide'], { cwd: fixture });
    assert.equal(init.status, 0, init.stderr);
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'plans')), true);
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'loop')), true);
    assert.equal(fs.existsSync(path.join(fixture, '.omo')), false);

    const loop = JSON.parse(fs.readFileSync(
      path.join(fixture, '.lazytrae', 'state', 'active-loop.json'),
      'utf8',
    ));
    const expectedPrefix = `.lazytrae/loop/${loop.run_id}/`;
    for (const value of [loop.brief_path, loop.goals_path, loop.ledger_path]) {
      assert.equal(value.startsWith(expectedPrefix), true, `${value} must use ${expectedPrefix}`);
    }
    const generatedLoop = defaultLoop();
    const generatedPrefix = `.lazytrae/loop/${generatedLoop.run_id}/`;
    for (const value of [generatedLoop.brief_path, generatedLoop.goals_path, generatedLoop.ledger_path]) {
      assert.equal(value.startsWith(generatedPrefix), true, `${value} must use ${generatedPrefix}`);
    }

    const doctor = runCli(['doctor'], { cwd: fixture });
    assert.equal(doctor.status, 0, doctor.stdout);
    assert.doesNotMatch(doctor.stdout, /\.omo/);

    const activeLoopPath = path.join(fixture, '.lazytrae', 'state', 'active-loop.json');
    const beforeSync = fs.readFileSync(activeLoopPath, 'utf8');
    assert.equal(runCli(['sync'], { cwd: fixture }).status, 0);
    assert.equal(fs.readFileSync(activeLoopPath, 'utf8'), beforeSync, 'sync must preserve loop data');

    const foreignOmo = path.join(fixture, '.omo', 'keep');
    fs.mkdirSync(path.dirname(foreignOmo), { recursive: true });
    fs.writeFileSync(foreignOmo, 'foreign namespace\n');
    assert.equal(runCli(['uninstall', '--yes', '--purge-state'], { cwd: fixture }).status, 0);
    assert.equal(fs.readFileSync(foreignOmo, 'utf8'), 'foreign namespace\n');

    const mcp = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.trae', 'mcp.json'), 'utf8'));
    const codegraph = mcp.mcpServers.codegraph;
    assert.equal(codegraph.disabled, true);
    assert.equal(Object.hasOwn(codegraph, 'command'), false);
    assert.equal(Object.hasOwn(codegraph, 'args'), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('uninstall preserves canonical runtime state unless explicitly purged', () => {
  const fixture = makeRepo('lazytrae-namespace-uninstall-');

  try {
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    const planPath = path.join(fixture, '.lazytrae', 'plans', 'preserve.md');
    const loopPath = path.join(fixture, '.lazytrae', 'loop', 'run-1', 'ledger.json');
    const evidencePath = path.join(fixture, '.lazytrae', 'evidence', 'proof.txt');
    const statePath = path.join(fixture, '.lazytrae', 'state', 'custom.json');
    const foreignOmo = path.join(fixture, '.omo', 'keep');
    for (const [filePath, content] of [
      [planPath, 'plan\n'],
      [loopPath, 'loop\n'],
      [evidencePath, 'evidence\n'],
      [statePath, 'state\n'],
      [foreignOmo, 'foreign namespace\n'],
    ]) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }

    const normal = runCli(['uninstall', '--yes'], { cwd: fixture });
    assert.equal(normal.status, 0, normal.stderr);
    for (const filePath of [planPath, loopPath, evidencePath, statePath]) {
      assert.equal(fs.existsSync(filePath), true, `${filePath} must survive normal uninstall`);
    }

    const purged = runCli(['uninstall', '--yes', '--purge-state'], { cwd: fixture });
    assert.equal(purged.status, 0, purged.stderr);
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae')), false);
    assert.equal(fs.readFileSync(foreignOmo, 'utf8'), 'foreign namespace\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('loop create-goals persists external brief input as canonical run artifacts', () => {
  const fixture = makeRepo('lazytrae-namespace-loop-artifacts-');

  try {
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    const sourceBrief = path.join(fixture, 'external-brief.md');
    fs.writeFileSync(sourceBrief, 'Persist this loop brief.\n', 'utf8');

    const result = runCli([
      'loop', 'create-goals', '--brief', 'external-brief.md', '--goal-id', 'goal-1', '--criterion-id', 'goal-1-crit-1',
    ], { cwd: fixture });
    assert.equal(result.status, 0, result.stderr);

    const loop = JSON.parse(fs.readFileSync(
      path.join(fixture, '.lazytrae', 'state', 'active-loop.json'),
      'utf8',
    ));
    const runPrefix = `.lazytrae/loop/${loop.run_id}/`;
    for (const artifactPath of [loop.brief_path, loop.goals_path, loop.ledger_path]) {
      assert.equal(artifactPath.startsWith(runPrefix), true, `${artifactPath} must use ${runPrefix}`);
      assert.equal(fs.existsSync(path.join(fixture, artifactPath)), true, `${artifactPath} must exist`);
    }
    assert.equal(fs.readFileSync(path.join(fixture, loop.brief_path), 'utf8'), 'Persist this loop brief.\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
