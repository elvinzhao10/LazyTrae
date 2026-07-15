const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { runOwnedCommand } = require('../src/lib/owned-process-runner');
const { install: installCodeGraph, initialize: initializeCodeGraph } = require('../src/lib/codegraph-lifecycle');
const { install: installLsp } = require('../src/lib/lsp-lifecycle');
const { listOwnedEntries, prepareOwnedRuntime, writeReceipt } = require('../src/lib/tooling-root');

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function waitForFile(file, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(file)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${file}`);
    childProcess.spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' });
  }
}

function waitForExit(pid, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for process ${pid} to exit`);
    childProcess.spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' });
  }
}

function writeTimeoutExecutable(file, pidPath) {
  const program = [
    '#!/usr/bin/env node',
    "const fs = require('node:fs');",
    "const { spawn } = require('node:child_process');",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify("process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000);")}], { stdio: 'ignore' });`,
    `fs.writeFileSync(${JSON.stringify(pidPath)}, String(child.pid));`,
    'setInterval(() => {}, 1_000);',
  ].join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, program);
  fs.chmodSync(file, 0o755);
}

function withPathPrefix(prefix, callback) {
  const original = process.env.PATH;
  process.env.PATH = `${prefix}${path.delimiter}${original}`;
  try {
    return callback();
  } finally {
    process.env.PATH = original;
  }
}

function assertTimedOut(action, pidPath, toolingRoot, code, shouldPreserveRoot = false) {
  assert.throws(action, error => error && error.message.includes(code));
  waitForFile(pidPath);
  const descendantPid = Number(fs.readFileSync(pidPath, 'utf8'));
  waitForExit(descendantPid);
  assert.equal(fs.existsSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json')), shouldPreserveRoot);
  assert.equal(fs.existsSync(toolingRoot), shouldPreserveRoot);
}

function writeOwnedCodeGraph(root, pidPath) {
  const executable = path.join(root, 'node_modules', '@colbymchenry', 'codegraph', 'fixture.js');
  writeTimeoutExecutable(executable, pidPath);
  const binDirectory = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(binDirectory, { recursive: true });
  fs.symlinkSync('../@colbymchenry/codegraph/fixture.js', path.join(binDirectory, 'codegraph'));
  prepareOwnedRuntime(root);
  writeReceipt(root, listOwnedEntries(root), ['codegraph']);
}

test('owned timeout kills a TERM-ignoring descendant without signaling its caller', { skip: process.platform === 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-owned-process-'));
  const pidPath = path.join(root, 'descendant.pid');
  const childProgram = [
    "const fs = require('node:fs');",
    "const { spawn } = require('node:child_process');",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify("process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000);")}], { stdio: 'ignore' });`,
    `fs.writeFileSync(${JSON.stringify(pidPath)}, String(child.pid));`,
    'setInterval(() => {}, 1_000);',
  ].join('\n');

  try {
    // Given: a package-owned child that creates a descendant which ignores graceful termination.
    // When: the bounded runner reaches its deadline.
    assert.throws(
      () => runOwnedCommand(process.execPath, ['-e', childProgram], { timeout: 150, timeoutCode: 'FIXTURE_TIMEOUT' }),
      error => error && error.code === 'FIXTURE_TIMEOUT',
    );
    waitForFile(pidPath);
    const descendantPid = Number(fs.readFileSync(pidPath, 'utf8'));

    // Then: only that detached session is removed; the caller survives and the descendant is gone.
    waitForExit(descendantPid);
    assert.equal(isAlive(process.pid), true);
  } finally {
    if (fs.existsSync(pidPath)) {
      const descendantPid = Number(fs.readFileSync(pidPath, 'utf8'));
      if (isAlive(descendantPid)) process.kill(descendantPid, 'SIGKILL');
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph and LSP lifecycle timeouts remove owned descendants and leave caller roots retryable', { skip: process.platform === 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-lifecycle-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'target');
  const codeGraphFakeBin = path.join(root, 'codegraph-bin');
  const lspFakeBin = path.join(root, 'lsp-bin');
  fs.mkdirSync(target);
  fs.mkdirSync(path.join(target, '.git'));
  fs.writeFileSync(path.join(target, 'tsconfig.json'), '{}\n');
  const codeGraphInstallPidPath = path.join(root, 'codegraph-install-descendant.pid');
  const lspInstallPidPath = path.join(root, 'lsp-install-descendant.pid');
  const initPidPath = path.join(root, 'init-descendant.pid');
  const fixtureTimeout = 1_000;
  writeTimeoutExecutable(path.join(codeGraphFakeBin, 'npm'), codeGraphInstallPidPath);
  writeTimeoutExecutable(path.join(lspFakeBin, 'npm'), lspInstallPidPath);
  const codeGraphRoot = path.join(root, 'codegraph');
  const lspRoot = path.join(root, 'lsp');
  const initializedRoot = path.join(root, 'initialized-codegraph');

  try {
    // Given: npm and CodeGraph fixtures whose direct process exits on timeout but whose child ignores TERM.
    // When: install or init reaches a bounded lifecycle deadline.
    withPathPrefix(codeGraphFakeBin, () => {
      assertTimedOut(() => installCodeGraph(target, codeGraphRoot, { timeout: fixtureTimeout }), codeGraphInstallPidPath, codeGraphRoot, 'CODEGRAPH_INSTALL_TIMEOUT');
    });
    withPathPrefix(lspFakeBin, () => {
      assertTimedOut(() => installLsp(target, lspRoot, { timeout: fixtureTimeout }), lspInstallPidPath, lspRoot, 'LSP_INSTALL_TIMEOUT');
    });
    writeOwnedCodeGraph(initializedRoot, initPidPath);
    assertTimedOut(() => initializeCodeGraph(target, initializedRoot, { timeout: fixtureTimeout }), initPidPath, initializedRoot, 'CODEGRAPH_INIT_TIMEOUT', true);
    assert.equal(fs.existsSync(path.join(target, '.codegraph')), false);

    // Then: no receipt or staging root remains, and each explicit caller root can be reused for a later install.
    for (const toolingRoot of [codeGraphRoot, lspRoot]) {
      fs.mkdirSync(toolingRoot);
      fs.writeFileSync(path.join(toolingRoot, 'caller-retry.txt'), 'retry\n');
      assert.equal(fs.readFileSync(path.join(toolingRoot, 'caller-retry.txt'), 'utf8'), 'retry\n');
    }
  } finally {
    for (const pidPath of [codeGraphInstallPidPath, lspInstallPidPath, initPidPath]) {
      if (!fs.existsSync(pidPath)) continue;
      const pid = Number(fs.readFileSync(pidPath, 'utf8'));
      if (isAlive(pid)) process.kill(pid, 'SIGKILL');
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
