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

function readTree(root, relative = '') {
  const directory = path.join(root, relative);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(relative, entry.name);
    return entry.isDirectory() ? [entryPath, ...readTree(root, entryPath)] : [entryPath];
  }).sort();
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
    for (const value of [loop.brief_path, loop.goals_path, loop.ledger_path]) {
      assert.equal(value, null, 'an idle loop must not claim a run artifact');
    }
    const generatedLoop = defaultLoop();
    const generatedPrefix = `.lazytrae/loop/${generatedLoop.run_id}/`;
    for (const value of [generatedLoop.brief_path, generatedLoop.goals_path, generatedLoop.ledger_path]) {
      assert.equal(typeof value, 'string');
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

    const mcp = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'mcp.json'),
      'utf8',
    ));
    assert.equal(Object.hasOwn(mcp.mcpServers, 'codegraph'), false);
    assert.equal(Object.hasOwn(mcp.mcpServers, 'lazytrae_codegraph'), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('uninstall preserves non-template canonical runtime state in every mode', () => {
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
    for (const filePath of [planPath, loopPath, evidencePath, statePath]) {
      assert.equal(fs.existsSync(filePath), true, `${filePath} must survive purge uninstall`);
    }
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

test('legacy .omo sentinel is untouched by canonical init doctor loop and uninstall operations', () => {
  const fixture = makeRepo('lazytrae-namespace-legacy-sentinel-');

  try {
    // Given: a malformed legacy namespace that must never become an input or output surface.
    const legacyRoot = path.join(fixture, '.omo');
    const legacySentinel = path.join(legacyRoot, 'keep');
    const legacyState = path.join(legacyRoot, 'state', 'boulder.json');
    fs.mkdirSync(path.dirname(legacyState), { recursive: true });
    fs.writeFileSync(legacySentinel, 'foreign namespace\n', 'utf8');
    fs.writeFileSync(legacyState, '{ malformed legacy state\n', 'utf8');
    const legacyTree = readTree(legacyRoot);
    const legacyContents = new Map(
      legacyTree.filter(relativePath => fs.statSync(path.join(legacyRoot, relativePath)).isFile())
        .map(relativePath => [relativePath, fs.readFileSync(path.join(legacyRoot, relativePath), 'utf8')]),
    );

    // When: every runtime lifecycle operation is exercised in a fresh repository.
    const init = runCli(['init', '--host', 'cli'], { cwd: fixture });
    assert.equal(init.status, 0, init.stderr);
    const doctor = runCli(['doctor'], { cwd: fixture });
    assert.equal(doctor.status, 0, doctor.stdout);
    assert.doesNotMatch(doctor.stdout, /\.omo/);
    fs.writeFileSync(path.join(fixture, 'brief.md'), 'Canonical loop brief.\n', 'utf8');
    const loop = runCli([
      'loop', 'create-goals', '--brief', 'brief.md', '--goal-id', 'goal-1', '--criterion-id', 'goal-1-crit-1',
    ], { cwd: fixture });
    assert.equal(loop.status, 0, loop.stderr);
    const normalUninstall = runCli(['uninstall', '--yes'], { cwd: fixture });
    assert.equal(normalUninstall.status, 0, normalUninstall.stderr);
    const purgeUninstall = runCli(['uninstall', '--yes', '--purge-state'], { cwd: fixture });
    assert.equal(purgeUninstall.status, 0, purgeUninstall.stderr);

    // Then: canonical state and the legacy tree are byte-for-byte unchanged.
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae')), true);
    assert.deepEqual(readTree(legacyRoot), legacyTree);
    for (const [relativePath, expectedContents] of legacyContents) {
      assert.equal(fs.readFileSync(path.join(legacyRoot, relativePath), 'utf8'), expectedContents);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
