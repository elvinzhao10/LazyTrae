const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const LOCAL_LAUNCHER = path.join(CLI_ROOT, 'bin', 'lazytrae.js');

function nodeOnlyEnvironment(home, binDirectory = path.dirname(process.execPath)) {
  return { HOME: home, PATH: binDirectory, npm_config_update_notifier: 'false' };
}

function runLauncher(launcher, args, options) {
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: nodeOnlyEnvironment(options.home, options.binDirectory),
    input: options.input,
  });
}

function makeProject(root, name = 'Consumer Project') {
  const project = path.join(root, name);
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  return project;
}

function readDeclaration(project) {
  return JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'))
    .mcpServers.lazytrae;
}

function initialize(declaration, cwd, home, binDirectory) {
  return spawnSync(declaration.command, declaration.args, {
    cwd,
    encoding: 'utf8',
    env: nodeOnlyEnvironment(home, binDirectory),
    input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`,
  });
}

function assertManagedDeclaration(declaration, launcher, project) {
  assert.equal(declaration.command, 'node');
  assert.deepEqual(declaration.args, [fs.realpathSync(launcher), '--root', fs.realpathSync(project), 'mcp']);
  assert.equal(path.isAbsolute(declaration.args[0]), true);
  assert.equal(declaration._lazytrae.schema_version, 1);
  assert.match(declaration._lazytrae.fingerprint, /^sha256:[a-f0-9]{64}$/);
}

test('permanent local launcher reports v1.0.2 and owns both package bins', () => {
  // Given: the publishable package manifest and release-owned launcher.
  const manifest = require('../package.json');

  // When: the launcher version surface is invoked.
  const result = spawnSync(process.execPath, [LOCAL_LAUNCHER, '--version'], { encoding: 'utf8' });

  // Then: both binary aliases resolve to that launcher and it reports the current package version.
  assert.deepEqual(manifest.bin, { 'lazytrae-ai': 'bin/lazytrae.js', lazytrae: 'bin/lazytrae.js' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '1.0.2');
});

test('local release launcher initializes a project from an unrelated cwd when paths contain spaces', () => {
  // Given: a permanent release copy and consumer project whose paths contain spaces.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-local-space-'));
  const release = path.join(root, 'Lazy Trae Release');
  const project = makeProject(root);
  const caller = path.join(root, 'unrelated', 'deep', 'caller');
  const home = path.join(root, 'home');
  fs.cpSync(CLI_ROOT, release, { recursive: true });
  fs.mkdirSync(caller, { recursive: true });
  fs.mkdirSync(home);
  try {
    // When: the release-owned launcher initializes the explicitly rooted project.
    const launcher = path.join(release, 'bin', 'lazytrae.js');
    const initialized = runLauncher(launcher, ['init', '--root', project, '--host', 'ide'], { cwd: caller, home });

    // Then: the generated declaration is release-owned and starts MCP without a global lazytrae.
    assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
    const declaration = readDeclaration(project);
    assertManagedDeclaration(declaration, launcher, project);
    const guidance = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    assert.match(guidance, new RegExp(fs.realpathSync(launcher).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(guidance, new RegExp(fs.realpathSync(project).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const stopHook = fs.readFileSync(path.join(project, '.trae', 'hooks', 'stop.sh'), 'utf8');
    assert.doesNotMatch(stopHook, /command -v lazytrae|&& lazytrae /);
    const mcp = initialize(declaration, caller, home);
    assert.equal(mcp.status, 0, mcp.stderr);
    assert.equal(JSON.parse(mcp.stdout.trim()).result.serverInfo.version, '1.0.2');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release-owned launcher serves MCP initialize from outside the release with a node-only PATH', () => {
  // Given: no global LazyTrae command and a caller cwd outside the release.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-local-mcp-'));
  const caller = path.join(root, 'caller');
  const home = path.join(root, 'home');
  fs.mkdirSync(caller);
  fs.mkdirSync(home);
  try {
    // When: Node executes the permanent release-owned launcher directly.
    const result = runLauncher(LOCAL_LAUNCHER, ['mcp'], {
      cwd: caller,
      home,
      input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`,
    });

    // Then: initialize reports the current release.
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout.trim()).result.serverInfo.version, '1.0.2');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('local launcher discovers the project from a deeply nested cwd', () => {
  // Given: a nested working directory inside a Git project.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-local-nested-'));
  const project = makeProject(root, 'project');
  const nested = path.join(project, 'one', 'two', 'three');
  const home = path.join(root, 'home');
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(home);
  try {
    // When: init runs without a root override.
    const initialized = runLauncher(LOCAL_LAUNCHER, ['init', '--host', 'ide'], { cwd: nested, home });

    // Then: the declaration pins the real project and release launcher roots.
    assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
    assertManagedDeclaration(readDeclaration(project), LOCAL_LAUNCHER, project);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('repeat local init and sync are byte-idempotent', () => {
  // Given: an initialized project.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-local-idempotent-'));
  const project = makeProject(root, 'project');
  const home = path.join(root, 'home');
  fs.mkdirSync(home);
  const tracked = ['.trae/mcp.json', '.trae/hooks/stop.sh', 'AGENTS.md'];
  try {
    assert.equal(runLauncher(LOCAL_LAUNCHER, ['init', '--root', project], { cwd: root, home }).status, 0);
    const before = Object.fromEntries(tracked.map(name => [name, fs.readFileSync(path.join(project, name))]));

    // When: onboarding and synchronization are repeated.
    const repeated = runLauncher(LOCAL_LAUNCHER, ['init', '--root', project], { cwd: root, home });
    const synced = runLauncher(LOCAL_LAUNCHER, ['sync', '--root', project], { cwd: root, home });

    // Then: every launcher-owned generated surface is byte-for-byte unchanged.
    assert.equal(repeated.status, 0, `${repeated.stdout}\n${repeated.stderr}`);
    assert.equal(synced.status, 0, `${synced.stdout}\n${synced.stderr}`);
    for (const name of tracked) assert.deepEqual(fs.readFileSync(path.join(project, name)), before[name], name);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a moved release fails closed and a new local sync refreshes its managed declaration', () => {
  // Given: a project initialized from a release that is then moved.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-local-moved-'));
  const oldRelease = path.join(root, 'Old Release');
  const newRelease = path.join(root, 'New Release');
  const project = makeProject(root, 'project');
  const caller = path.join(root, 'caller');
  const home = path.join(root, 'home');
  const fakeBin = path.join(root, 'fake-bin');
  fs.cpSync(CLI_ROOT, oldRelease, { recursive: true });
  fs.mkdirSync(caller);
  fs.mkdirSync(home);
  fs.mkdirSync(fakeBin);
  fs.symlinkSync(process.execPath, path.join(fakeBin, 'node'));
  fs.writeFileSync(path.join(fakeBin, 'lazytrae'), '#!/bin/sh\nprintf PATH_FALLBACK_USED\n');
  fs.chmodSync(path.join(fakeBin, 'lazytrae'), 0o755);
  try {
    const oldLauncher = path.join(oldRelease, 'bin', 'lazytrae.js');
    assert.equal(runLauncher(oldLauncher, ['init', '--root', project], { cwd: caller, home }).status, 0);
    const staleDeclaration = readDeclaration(project);
    fs.renameSync(oldRelease, newRelease);

    // When: the stale declaration starts and the moved release diagnoses the project.
    const staleStart = initialize(staleDeclaration, caller, home, fakeBin);
    const newLauncher = path.join(newRelease, 'bin', 'lazytrae.js');
    const checked = runLauncher(newLauncher, ['load-check', '--root', project], { cwd: caller, home });
    const doctored = runLauncher(newLauncher, ['doctor', '--root', project], { cwd: caller, home });

    // Then: no PATH fallback runs, diagnostics prescribe sync, and sync alone refreshes the managed entry.
    assert.notEqual(staleStart.status, 0);
    assert.doesNotMatch(`${staleStart.stdout}${staleStart.stderr}`, /PATH_FALLBACK_USED/);
    assert.equal(checked.status, 1, checked.stdout);
    assert.match(`${checked.stdout}${checked.stderr}`, /stale|missing/i);
    assert.match(`${checked.stdout}${checked.stderr}`, /sync/i);
    assert.equal(doctored.status, 1, doctored.stdout);
    assert.match(`${doctored.stdout}${doctored.stderr}`, /stale|missing/i);
    const synced = runLauncher(newLauncher, ['sync', '--root', project], { cwd: caller, home });
    assert.equal(synced.status, 0, `${synced.stdout}\n${synced.stderr}`);
    assert.match(synced.stdout, /refreshed.*launcher|launcher.*refreshed/i);
    const refreshed = readDeclaration(project);
    assertManagedDeclaration(refreshed, newLauncher, project);
    assert.equal(initialize(refreshed, caller, home, fakeBin).status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
