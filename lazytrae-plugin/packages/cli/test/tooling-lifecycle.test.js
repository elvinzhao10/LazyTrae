const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CLI, runCli } = require('./test-helpers');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function snapshotTarget(root) {
  const files = ['package.json', 'package-lock.json', '.gitignore'];
  return Object.fromEntries(files.map(file => {
    const target = path.join(root, file);
    return [file, fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null];
  }));
}

function install(root, toolingRoot) {
  const bin = path.join(root, 'incompatible-host-bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const [name, version] of Object.entries({ rg: 'ripgrep 13.0.0', sg: 'ast-grep 0.43.0' })) {
    const executable = path.join(bin, name);
    fs.writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${version}'\n`);
    fs.chmodSync(executable, 0o755);
  }
  return spawnSync(process.execPath, [CLI, 'tooling', 'install', '--tooling-root', toolingRoot], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  });
}

test('tooling lifecycle owns only an explicit empty root and sync preserves user MCP and capability state', () => {
  const root = makeRepo('lazytrae-tooling-lifecycle-');
  const toolingRoot = path.join(root, 'tooling-root');
  try {
    // Given: an initialized project with caller-owned MCP configuration and explicit capability state.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    const before = snapshotTarget(root);
    const mcpPath = path.join(root, '.trae', 'mcp.json');
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    mcp.mcpServers.user_owned = { command: 'user-mcp', args: ['serve'] };
    fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + '\n');
    const statePath = path.join(root, '.lazytrae', 'state', 'tooling.json');
    fs.writeFileSync(statePath, JSON.stringify({
      schema_version: 1,
      capabilities: { codegraph: { selected: true, state: 'not-configured' } },
    }, null, 2) + '\n');

    // When: the package-owned tooling lifecycle is run against an explicit root, followed by sync.
    const installed = install(root, toolingRoot);
    const status = runCli(['tooling', 'status', '--tooling-root', toolingRoot], { cwd: root });
    const doctor = runCli(['tooling', 'doctor', '--tooling-root', toolingRoot], { cwd: root });
    const repeatInit = runCli(['init'], { cwd: root });
    const sync = runCli(['sync'], { cwd: root });

    // Then: only receipt-owned files live in the root, target dependency files stay unchanged, and state survives sync.
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.equal(repeatInit.status, 0, repeatInit.stderr);
    assert.equal(sync.status, 0, sync.stderr);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'package.json')), true);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'package-lock.json')), true);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json')), true);
    assert.deepEqual(snapshotTarget(root), before);
    const syncedMcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    assert.deepEqual(syncedMcp.mcpServers.user_owned, { command: 'user-mcp', args: ['serve'] });
    assert.deepEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')).capabilities.codegraph, {
      selected: true,
      state: 'not-configured',
    });

    const uninstalled = runCli(['tooling', 'uninstall', '--tooling-root', toolingRoot], { cwd: root });
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    assert.equal(fs.existsSync(toolingRoot), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tooling lifecycle rejects unsafe roots and preserves unverified files', () => {
  const root = makeRepo('lazytrae-tooling-safety-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-tooling-outside-'));
  try {
    // Given: a target repo, unsafe roots, and an outside file that must never be deleted.
    const nonempty = path.join(root, 'nonempty');
    fs.mkdirSync(nonempty);
    fs.writeFileSync(path.join(nonempty, 'sentinel'), 'keep\n');
    const linkedRoot = path.join(root, 'linked-root');
    fs.symlinkSync(outside, linkedRoot);
    const linkedParent = path.join(root, 'linked-parent');
    fs.symlinkSync(outside, linkedParent);
    const outsideFile = path.join(outside, 'outside-package.json');
    fs.writeFileSync(outsideFile, 'outside\n');

    // When: invalid and unsafe lifecycle commands are attempted.
    const missing = runCli(['tooling', 'install'], { cwd: root });
    const relative = runCli(['tooling', 'install', '--tooling-root', 'relative'], { cwd: root });
    const nonemptyInstall = install(root, nonempty);
    const symlinkInstall = install(root, linkedRoot);
    const ancestorSymlinkInstall = install(root, path.join(linkedParent, 'new', 'interior'));
    const noReceipt = runCli(['tooling', 'uninstall', '--tooling-root', nonempty], { cwd: root });

    // Then: every unsafe call fails without mutating user-owned data.
    assert.equal(missing.status, 1);
    assert.equal(relative.status, 1);
    assert.equal(nonemptyInstall.status, 1);
    assert.equal(symlinkInstall.status, 1);
    assert.equal(ancestorSymlinkInstall.status, 1);
    assert.equal(noReceipt.status, 1);
    assert.equal(fs.readFileSync(path.join(nonempty, 'sentinel'), 'utf8'), 'keep\n');
    assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
    assert.equal(fs.existsSync(path.join(outside, 'new', 'interior')), false);

    const editedRoot = path.join(root, 'edited-root');
    assert.equal(install(root, editedRoot).status, 0);
    fs.writeFileSync(path.join(editedRoot, 'package.json'), 'edited\n');
    const editedUninstall = runCli(['tooling', 'uninstall', '--tooling-root', editedRoot], { cwd: root });
    assert.equal(editedUninstall.status, 1);
    assert.equal(fs.readFileSync(path.join(editedRoot, 'package.json'), 'utf8'), 'edited\n');

    const hardLinkedRoot = path.join(root, 'hard-linked-root');
    assert.equal(install(root, hardLinkedRoot).status, 0);
    const manifest = path.join(hardLinkedRoot, 'package.json');
    fs.rmSync(manifest);
    fs.linkSync(outsideFile, manifest);
    const hardLinkUninstall = runCli(['tooling', 'uninstall', '--tooling-root', hardLinkedRoot], { cwd: root });
    assert.equal(hardLinkUninstall.status, 1);
    assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'outside\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
