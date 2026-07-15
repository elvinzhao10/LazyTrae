const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function loadLifecycleWithSpawnStub(modulePath, spawnStub) {
  const original = childProcess.spawnSync;
  delete require.cache[require.resolve(modulePath)];
  delete require.cache[require.resolve('../src/lib/owned-process-runner')];
  childProcess.spawnSync = (...args) => spawnStub(original, ...args);
  try {
    return require(modulePath);
  } finally {
    childProcess.spawnSync = original;
  }
}

function addConcurrentCallerEntries(toolingRoot, outsideFile) {
  fs.mkdirSync(toolingRoot, { recursive: true });
  fs.writeFileSync(path.join(toolingRoot, 'caller-owned.txt'), 'preserve\n');
  fs.symlinkSync(outsideFile, path.join(toolingRoot, 'caller-owned-link'));
}

function writeSuccessfulNpm(root) {
  const bin = path.join(root, 'fixture-bin');
  const executable = path.join(bin, 'npm');
  fs.mkdirSync(bin);
  fs.writeFileSync(executable, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
if (process.env.LAZYTRAE_TEST_TOOL_KIND === 'codegraph') {
  const implementation = path.join(process.cwd(), 'node_modules', '@colbymchenry', 'codegraph', 'fixture.js');
  fs.mkdirSync(path.dirname(implementation), { recursive: true });
  fs.writeFileSync(implementation, '#!/usr/bin/env node\\nprocess.exit(0);\\n');
  fs.chmodSync(implementation, 0o755);
  const binDirectory = path.join(process.cwd(), 'node_modules', '.bin');
  fs.mkdirSync(binDirectory, { recursive: true });
  fs.symlinkSync('../@colbymchenry/codegraph/fixture.js', path.join(binDirectory, 'codegraph'));
} else {
  const server = path.join(process.cwd(), 'node_modules', '.bin', 'typescript-language-server');
  fs.mkdirSync(path.dirname(server), { recursive: true });
  fs.writeFileSync(server, '#!/usr/bin/env node\\nconsole.log("fixture");\\n');
  fs.chmodSync(server, 0o755);
}
`);
  fs.chmodSync(executable, 0o755);
  return bin;
}

function assertCallerEntriesPreserved(toolingRoot, outsideFile) {
  assert.equal(fs.readFileSync(path.join(toolingRoot, 'caller-owned.txt'), 'utf8'), 'preserve\n');
  assert.equal(fs.lstatSync(path.join(toolingRoot, 'caller-owned-link')).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
  assert.equal(fs.existsSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json')), false);
  const stagingPrefix = `.${path.basename(toolingRoot)}.lazytrae-staging-`;
  assert.deepEqual(fs.readdirSync(path.dirname(toolingRoot)).filter(entry => entry.startsWith(stagingPrefix)), []);
}

function assertFailurePreservesCallerEntries({ modulePath, install, target, toolingRoot, outsideFile }) {
  for (const result of [
    { status: 23, stderr: 'fixture install failure\n', stdout: '' },
    { status: null, error: new Error('spawnSync npm ETIMEDOUT'), stderr: '', stdout: '' },
  ]) {
    fs.rmSync(toolingRoot, { recursive: true, force: true });
    const lifecycle = loadLifecycleWithSpawnStub(modulePath, (original, command, ...args) => {
      if (command !== 'npm') return original(command, ...args);
      addConcurrentCallerEntries(toolingRoot, outsideFile);
      return result;
    });

    assert.throws(() => lifecycle[install](target, toolingRoot), /caller tooling root preserved and no receipt was created/i);
    assertCallerEntriesPreserved(toolingRoot, outsideFile);
  }
}

test('CodeGraph failure and timeout preserve concurrent caller entries and permit a clean retry', () => {
  const root = makeRepo('lazytrae-codegraph-staging-');
  const toolingRoot = path.join(root, 'tooling-root');
  const outsideFile = path.join(root, 'outside.txt');
  fs.writeFileSync(outsideFile, 'outside\n');

  try {
    // Given: a target and a subprocess fixture that adds user-owned root entries after provisioning starts.
    assertFailurePreservesCallerEntries({
      modulePath: '../src/lib/codegraph-lifecycle',
      install: 'install',
      target: root,
      toolingRoot,
      outsideFile,
    });

    // When: the caller removes only their retained entries and retries with a successful package-owned installer.
    fs.rmSync(toolingRoot, { recursive: true, force: true });
    const result = runCli(['tooling', 'codegraph-install', '--target', root, '--tooling-root', toolingRoot], {
      cwd: root,
      env: {
        ...process.env,
        LAZYTRAE_TEST_TOOL_KIND: 'codegraph',
        PATH: `${writeSuccessfulNpm(root)}${path.delimiter}${process.env.PATH}`,
      },
    });

    // Then: the retry creates a receipt-owned installation without touching the external caller file.
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json')), true);
    assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('LSP failure and timeout preserve concurrent caller entries and permit a clean retry', () => {
  const root = makeRepo('lazytrae-lsp-staging-');
  const target = path.join(root, 'target');
  const toolingRoot = path.join(root, 'tooling-root');
  const outsideFile = path.join(root, 'outside.txt');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
  fs.writeFileSync(outsideFile, 'outside\n');

  try {
    // Given: a supported target and a failed or timed-out provider installer that races caller entries into the root.
    assertFailurePreservesCallerEntries({
      modulePath: '../src/lib/lsp-lifecycle',
      install: 'install',
      target,
      toolingRoot,
      outsideFile,
    });

    // When: the caller clears only their preserved entries and retries with a successful provider installer.
    fs.rmSync(toolingRoot, { recursive: true, force: true });
    const result = runCli(['tooling', 'lsp-install', '--target', target, '--tooling-root', toolingRoot], {
      cwd: root,
      env: {
        ...process.env,
        LAZYTRAE_TEST_TOOL_KIND: 'lsp',
        PATH: `${writeSuccessfulNpm(root)}${path.delimiter}${process.env.PATH}`,
      },
    });

    // Then: the retry creates a receipt-owned provider and leaves the external caller file intact.
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json')), true);
    assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
