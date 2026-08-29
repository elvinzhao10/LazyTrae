'use strict';

const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const packageRoot = path.resolve(__dirname, '..');
const runner = path.join(packageRoot, 'tools', 'test-fixture-runner.js');
const packageManifest = require('../package.json');

function scriptArguments(name) {
  return packageManifest.scripts[name]
    .split(' ')
    .slice(2);
}

function inventory(name, environment = {}) {
  const childEnvironment = { ...process.env, ...environment };
  if (!Object.hasOwn(environment, 'LAZYTRAE_TEST_CONCURRENCY')) {
    delete childEnvironment.LAZYTRAE_TEST_CONCURRENCY;
  }
  const result = spawnSync(process.execPath, [runner, '--inventory', ...scriptArguments(name)], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: childEnvironment,
  });
  return {
    result,
    inventory: result.status === 0 ? JSON.parse(result.stdout) : null,
  };
}

function waitForFile(file, child) {
  return new Promise((resolve, reject) => {
    let complete = false;
    const timeout = setTimeout(() => {
      if (!complete) reject(new Error(`timed out waiting for ${file}`));
    }, 5_000);
    const finish = (callback) => {
      if (complete) return;
      complete = true;
      clearTimeout(timeout);
      callback();
    };
    const check = () => {
      if (fs.existsSync(file)) {
        finish(resolve);
      } else if (!complete) {
        setTimeout(check, 10);
      }
    };
    child.once('exit', (code, signal) => finish(() => reject(new Error(
      `runner exited before ${path.basename(file)} was created: code=${code} signal=${signal}`,
    ))));
    check();
  });
}

test('Given package scripts, when inventories are selected, then source and package form a complete disjoint test set', () => {
  // Given
  const complete = fs.readdirSync(__dirname)
    .filter((entry) => entry.endsWith('.test.js'))
    .map((entry) => `test/${entry}`)
    .sort();

  // When
  const source = inventory('test:source');
  const packaged = inventory('test:package');

  // Then
  assert.equal(source.result.status, 0, source.result.stderr);
  assert.equal(packaged.result.status, 0, packaged.result.stderr);
  const sourceTests = source.inventory.tests;
  const packageTests = packaged.inventory.tests;
  assert.deepEqual(sourceTests.filter((entry) => packageTests.includes(entry)), []);
  assert.deepEqual([...new Set([...sourceTests, ...packageTests])].sort(), complete);
  assert.equal([...sourceTests, ...packageTests].some((entry) => !entry.endsWith('.test.js')), false);
  assert.deepEqual(source.inventory.serial_tests, [
    'test/lifecycle-command.test.js',
    'test/owned-process-runner.test.js',
  ]);
});

test('Given the test concurrency environment, when it is parsed, then the default is two and only one through four are accepted', () => {
  // Given / When
  const defaulted = inventory('test:source');
  const serial = inventory('test:source', { LAZYTRAE_TEST_CONCURRENCY: '1' });
  const maximum = inventory('test:source', { LAZYTRAE_TEST_CONCURRENCY: '4' });
  const malformed = ['0', '5', '2.5', 'many'].map((value) => (
    inventory('test:source', { LAZYTRAE_TEST_CONCURRENCY: value }).result
  ));

  // Then
  assert.equal(defaulted.inventory.concurrency, 2);
  assert.equal(serial.inventory.concurrency, 1);
  assert.equal(maximum.inventory.concurrency, 4);
  for (const result of malformed) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /LAZYTRAE_TEST_CONCURRENCY/);
  }
});

test('Given helper modules in the test directory, when explicitly selected, then the runner refuses to execute them as tests', () => {
  // Given
  const helpers = [
    'test/json-rpc-call.js',
    'test/mcp-test.js',
    'test/temp-fixture-cleanup.js',
    'test/test-helpers.js',
  ];

  // When
  const results = helpers.map((helper) => spawnSync(process.execPath, [runner, helper], {
    cwd: packageRoot,
    encoding: 'utf8',
  }));

  // Then
  for (const result of results) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /test helpers cannot be executed as tests/);
  }
});

test('Given a nested fixture runner, when SIGTERM terminates it, then its owned suite root and blocking child are removed', async (t) => {
  // Given
  const parentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-runner-signal-'));
  const blockingTest = path.join(parentRoot, 'blocking.test.js');
  const readyFile = path.join(parentRoot, 'blocking-child.pid');
  const nestedEnvironment = { ...process.env };
  delete nestedEnvironment.NODE_TEST_CONTEXT;
  fs.writeFileSync(blockingTest, [
    "'use strict';",
    "const fs = require('node:fs');",
    "const test = require('node:test');",
    "test('blocks', async () => {",
    "  fs.writeFileSync(process.env.LAZYTRAE_TEST_BLOCKER_READY, String(process.pid));",
    '  setInterval(() => {}, 1_000);',
    '  await new Promise(() => {});',
    '});',
    '',
  ].join('\n'));
  const child = spawn(process.execPath, [runner, blockingTest], {
    cwd: packageRoot,
    env: {
      ...nestedEnvironment,
      TMPDIR: parentRoot,
      TMP: parentRoot,
      TEMP: parentRoot,
      LAZYTRAE_TEST_BLOCKER_READY: readyFile,
    },
  });
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
    if (fs.existsSync(readyFile)) {
      const pid = Number(fs.readFileSync(readyFile, 'utf8'));
      try {
        process.kill(pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(parentRoot, { recursive: true, force: true });
  });
  const suiteRoot = await new Promise((resolve, reject) => {
    const prefix = 'lazytrae-suite-';
    let complete = false;
    const timeout = setTimeout(() => {
      if (!complete) reject(new Error('timed out waiting for the suite root'));
    }, 5_000);
    const check = () => {
      const root = fs.readdirSync(parentRoot).find((entry) => entry.startsWith(prefix));
      if (root) {
        complete = true;
        clearTimeout(timeout);
        resolve(path.join(parentRoot, root));
      } else if (!complete) {
        setTimeout(check, 10);
      }
    };
    child.once('exit', (code, signal) => {
      if (!complete) reject(new Error(`runner exited before the suite root was created: code=${code} signal=${signal}`));
    });
    check();
  });
  await waitForFile(readyFile, child);
  const blockedChildPid = Number(fs.readFileSync(readyFile, 'utf8'));

  // When
  const exit = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.kill('SIGTERM');
  });

  // Then
  assert.deepEqual(exit, { code: null, signal: 'SIGTERM' });
  assert.equal(fs.existsSync(suiteRoot), false);
  assert.throws(() => process.kill(blockedChildPid, 0), { code: 'ESRCH' });
});
