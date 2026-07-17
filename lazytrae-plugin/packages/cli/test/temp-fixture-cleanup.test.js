const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const cleanupPreload = path.join(__dirname, 'temp-fixture-cleanup.js');
const inventoryRunner = path.join(__dirname, '..', 'tools', 'test-fixture-runner.js');
const packageManifest = require('../package.json');

function createFixture(environment = {}) {
  const result = spawnSync(process.execPath, ['--require', cleanupPreload, '-e', [
    "const fs = require('node:fs');",
    "const os = require('node:os');",
    "const path = require('node:path');",
    "process.stdout.write(fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-fixture-cleanup-')));",
  ].join('')], {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('test fixture runner isolates and inventories only this invocation temporary directories', () => {
  assert.match(packageManifest.scripts.test, /test-fixture-runner\.js/);
  const runner = fs.readFileSync(inventoryRunner, 'utf8');
  assert.match(runner, /TMPDIR: suiteRoot/);
  assert.match(runner, /LAZYTRAE_TEST_FIXTURE_INVENTORY/);
});

test('test fixture preload removes only its owned temporary directory at process exit', () => {
  const fixture = createFixture();

  assert.equal(fs.existsSync(fixture), false);
});

test('test fixture preload preserves diagnostics only when explicitly requested', () => {
  const fixture = createFixture({ LAZYTRAE_KEEP_TEST_FIXTURES: '1' });
  try {
    assert.equal(fs.existsSync(fixture), true);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
