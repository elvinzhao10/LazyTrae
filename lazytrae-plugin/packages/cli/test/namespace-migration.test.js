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
