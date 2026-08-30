'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CLI, runCli } = require('./test-helpers');

const OFFICIAL = 'https://github.com/elvinzhao10/LazyTrae.git';
const CONTRACTS = path.resolve(__dirname, '..', 'contracts');
const CLI_ROOT = path.resolve(__dirname, '..');

function git(cwd, args) {
  const result = childProcess.spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function writeRelease(root, selfTest = "process.stdout.write('self-test-ok\\n');\n") {
  const cli = path.join(root, 'lazytrae-plugin', 'packages', 'cli');
  fs.mkdirSync(path.join(cli, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(cli, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(cli, 'contracts'), { recursive: true });
  fs.writeFileSync(path.join(cli, 'package.json'), '{"name":"lazytrae-ai","version":"1.2.1"}\n');
  fs.writeFileSync(path.join(cli, 'bin', 'lazytrae.js'), "process.stdout.write('durable-cli-ok\\n');\n");
  fs.writeFileSync(path.join(cli, 'scripts', 'lifecycle-self-test.js'), selfTest);
  for (const name of [
    'lazy-harness-lifecycle.v1.schema.json',
    'lazy-harness-lifecycle.v1.example.json',
    'lazy-harness-lifecycle.v2.schema.json',
    'lazy-harness-active.v2.schema.json',
  ]) {
    const bytes = fs.readFileSync(path.join(CONTRACTS, name));
    fs.writeFileSync(path.join(cli, 'contracts', name), bytes);
    fs.writeFileSync(
      path.join(cli, 'contracts', `${name}.sha256`),
      `${crypto.createHash('sha256').update(bytes).digest('hex')}  ${name}\n`,
    );
  }
}

function writeFullLifecycleRelease(root) {
  const cli = path.join(root, 'lazytrae-plugin', 'packages', 'cli');
  fs.mkdirSync(cli, { recursive: true });
  for (const name of ['bin', 'contracts', 'scripts', 'src']) {
    fs.cpSync(path.join(CLI_ROOT, name), path.join(cli, name), { recursive: true });
  }
  for (const name of ['package.json', 'LICENSE', 'NOTICE']) {
    fs.copyFileSync(path.join(CLI_ROOT, name), path.join(cli, name));
  }
}

function packedBinary(t, sandbox) {
  const packRoot = path.join(sandbox, 'packed cli');
  const installRoot = path.join(packRoot, 'install');
  fs.mkdirSync(packRoot);
  const packed = childProcess.spawnSync('npm', ['pack', '--json', '--pack-destination', packRoot], {
    cwd: CLI_ROOT,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(sandbox, 'npm cache') },
  });
  assert.equal(packed.status, 0, packed.stderr || packed.stdout);
  const [{ filename }] = JSON.parse(packed.stdout);
  const installed = childProcess.spawnSync('npm', [
    'install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund', '--offline',
    '--package-lock=false', path.join(packRoot, filename),
  ], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(sandbox, 'npm cache') },
  });
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  const binary = path.join(installRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'lazytrae.cmd' : 'lazytrae');
  t.after(() => assert.equal(fs.existsSync(path.join(installRoot, 'node_modules', '.bin', 'traecli')), false));
  return binary;
}

function lifecycleFixture(t) {
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae lifecycle command '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const source = path.join(sandbox, 'source checkout');
  const remote = path.join(sandbox, 'official fixture.git');
  const project = path.join(sandbox, 'project with spaces');
  const installRoot = path.join(sandbox, 'durable root');
  const fakeBin = path.join(sandbox, 'fake bin');
  fs.mkdirSync(source);
  fs.mkdirSync(project);
  fs.mkdirSync(fakeBin);
  git(source, ['init', '-q']);
  git(source, ['config', 'user.email', 'fixture@example.invalid']);
  git(source, ['config', 'user.name', 'Lifecycle Fixture']);
  writeRelease(source);
  git(source, ['add', '.']);
  git(source, ['commit', '-qm', 'fixture v1']);
  git(source, ['branch', '-M', 'main']);
  git(source, ['tag', 'v1.2.1']);
  git(sandbox, ['clone', '--bare', source, remote]);
  const realGit = childProcess.spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  const shim = `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2).map((value) => value === ${JSON.stringify(OFFICIAL)} ? ${JSON.stringify(remote)} : value);
const result = spawnSync(${JSON.stringify(realGit)}, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
`;
  fs.writeFileSync(path.join(fakeBin, 'git'), shim, { mode: 0o755 });
  const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH}` };
  const common = ['--install-root', installRoot, '--project', project, '--json'];
  return { common, env, installRoot, project, remote, sandbox, source };
}

function runLifecycle(fixture, subcommand, extra = []) {
  return runCli(['lifecycle', subcommand, ...fixture.common, ...extra], {
    cwd: fixture.project,
    env: fixture.env,
  });
}

function runCliWithPreload(preload, args, options = {}) {
  return childProcess.spawnSync(process.execPath, ['--require', preload, CLI, ...args], {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    env: options.env,
  });
}

async function waitForPath(target, timeoutMs = 5_000) {
  const started = Date.now();
  while (!fs.existsSync(target)) {
    if (Date.now() - started >= timeoutMs) throw new Error(`timed out waiting for ${target}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function startOnboard({ environment, installRoot, projectRoot }) {
  const child = childProcess.spawn(process.execPath, [
    CLI, 'lifecycle', 'onboard', '--source', OFFICIAL,
    '--install-root', installRoot, '--project', projectRoot, '--json',
  ], { env: environment });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, stderr, stdout }));
  });
}

test('lifecycle help documents the durable subcommands and exact flags', () => {
  // Given: the direct CLI entry point.
  // When: lifecycle help is requested.
  const result = runCli(['lifecycle', '--help']);

  // Then: every durable operation and its public option names are visible.
  assert.equal(result.status, 0);
  for (const token of ['onboard', 'update', 'status', 'rollback', 'prune', 'offboard', '--install-root', '--project', '--json', '--source', '--confirm-revision', '--yes']) {
    assert.match(result.stdout, new RegExp(token.replaceAll('-', '\\-')));
  }
});

test('status keeps package readiness separate from unobserved host readiness', (t) => {
  // Given: an absent durable root and an existing project.
  const fixture = lifecycleFixture(t);

  // When: machine-readable status is requested.
  const result = runLifecycle(fixture, 'status');
  const report = JSON.parse(result.stdout);

  // Then: package absence is distinct from host observation and status does not create the root.
  assert.equal(result.status, 0);
  assert.equal(report.package_readiness.status, 'absent');
  assert.equal(report.host_readiness.status, 'pending');
  assert.equal(fs.existsSync(fixture.installRoot), false);
});

test('fresh onboard prerequisite failure leaves a reusable fail-closed scaffold', (t) => {
  // Given: fresh spaced project/install roots and a PATH without Git.
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae prerequisite failure '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const project = path.join(sandbox, 'project with spaces');
  const installRoot = path.join(sandbox, 'install root');
  const emptyPath = path.join(sandbox, 'empty path');
  fs.mkdirSync(project);
  fs.mkdirSync(emptyPath);

  // When: the real lifecycle CLI attempts a fresh onboard.
  const result = runCli([
    'lifecycle', 'onboard', '--source', OFFICIAL,
    '--install-root', installRoot, '--project', project, '--json',
  ], { cwd: project, env: { ...process.env, PATH: emptyPath } });

  // Then: the prerequisite error is reported with only the reusable scaffold retained.
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error.code, 'PREREQUISITE_MISSING');
  const productRoot = path.join(installRoot, 'LazyTrae');
  assert.deepEqual(fs.readdirSync(productRoot).sort(), ['locks', 'receipts', 'releases', 'rollback', 'staging']);
  for (const entry of fs.readdirSync(productRoot)) assert.deepEqual(fs.readdirSync(path.join(productRoot, entry)), []);
});

test('onboard preserves an unverified workspace with a structured refusal', (t) => {
  // Given: a caller-owned workspace already occupies the lifecycle product path.
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae preserved workspace '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const project = path.join(sandbox, 'project with spaces');
  const installRoot = path.join(sandbox, 'install root');
  const productRoot = path.join(installRoot, 'LazyTrae');
  const sentinel = path.join(productRoot, 'caller-owned.txt');
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(productRoot, { recursive: true });
  fs.writeFileSync(sentinel, 'retain me\n');
  const before = fs.lstatSync(productRoot);

  // When: the real lifecycle CLI attempts onboard against that path.
  const result = runCli([
    'lifecycle', 'onboard', '--source', OFFICIAL,
    '--install-root', installRoot, '--project', project, '--json',
  ], { cwd: project });
  const report = JSON.parse(result.stdout);

  // Then: refusal is machine-readable and the workspace remains byte- and identity-exact.
  assert.equal(result.status, 1, result.stderr);
  assert.equal(report.status, 'error');
  assert.equal(report.error.code, 'WORKSPACE_PRESERVED');
  assert.deepEqual(report.preservation, {
    status: 'recovery_required',
    public_workspace: productRoot,
    retained_artifacts: [],
  });
  assert.equal(report.package_readiness.status, 'blocked');
  assert.equal(report.host_readiness.status, 'pending');
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'retain me\n');
  const after = fs.lstatSync(productRoot);
  assert.deepEqual({ dev: after.dev, ino: after.ino }, { dev: before.dev, ino: before.ino });
  assert.deepEqual(fs.readdirSync(productRoot), ['caller-owned.txt']);
});

test('collision-preserved bootstrap lock is surfaced and recovered through the real lifecycle CLI', (t) => {
  // Given: a real CLI process whose fresh product root is replaced with a caller-owned exact scaffold before lock acquisition.
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae swapped caller scaffold '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const project = path.join(sandbox, 'project with spaces');
  const installRoot = path.join(sandbox, 'install root');
  const productRoot = path.join(installRoot, 'LazyTrae');
  const emptyPath = path.join(sandbox, 'empty path');
  const hook = path.join(sandbox, 'swap-hook.js');
  const snapshotPath = path.join(sandbox, 'caller-snapshot.json');
  fs.mkdirSync(project);
  fs.mkdirSync(emptyPath);
  fs.writeFileSync(hook, `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const realOpenSync = fs.openSync;
let swapped = false;
fs.openSync = (target, flags, mode) => {
  if (!swapped && target === process.env.BLOCKED_LOCK) {
    swapped = true;
    const displacedProductRoot = path.join(
      path.dirname(process.env.PRODUCT_ROOT),
      '.' + path.basename(process.env.PRODUCT_ROOT) + '-before-swap-' + process.pid,
    );
    fs.renameSync(process.env.PRODUCT_ROOT, displacedProductRoot);
    const directories = ['releases', 'receipts', 'staging', 'locks', 'rollback'];
    for (const directory of directories) fs.mkdirSync(path.join(process.env.PRODUCT_ROOT, directory), { recursive: true });
    fs.writeFileSync(path.join(process.env.PRODUCT_ROOT, 'caller-owned.txt'), 'caller-owned\\n');
    const snapshot = Object.fromEntries(['', ...directories].map((entry) => {
      const stat = fs.lstatSync(path.join(process.env.PRODUCT_ROOT, entry));
      return [entry, { dev: stat.dev, ino: stat.ino, mode: stat.mode, nlink: stat.nlink }];
    }));
    fs.writeFileSync(process.env.SNAPSHOT_PATH, JSON.stringify(snapshot));
  }
  return realOpenSync(target, flags, mode);
};
`);

  // When: the real lifecycle CLI reaches a missing-Git failure after the caller swap.
  const result = runCliWithPreload(hook, [
    'lifecycle', 'onboard', '--source', OFFICIAL,
    '--install-root', installRoot, '--project', project, '--json',
  ], {
    cwd: project,
    env: {
      ...process.env,
      BLOCKED_LOCK: path.join(installRoot, '.LazyTrae.bootstrap.lock'),
      PATH: emptyPath,
      PRODUCT_ROOT: productRoot,
      SNAPSHOT_PATH: snapshotPath,
    },
  });

  // Then: structured failure preserves the exact caller-owned root and directory identities.
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.error.code, 'WORKSPACE_PRESERVED');
  assert.deepEqual(report.preservation, {
    status: 'recovery_required',
    public_workspace: productRoot,
    retained_artifacts: [
      { kind: 'lifecycle_lock', last_known_path: path.join(installRoot, '.LazyTrae.bootstrap.lock') },
    ],
  });
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  for (const [entry, identity] of Object.entries(snapshot)) {
    const stat = fs.lstatSync(path.join(productRoot, entry));
    assert.deepEqual({ dev: stat.dev, ino: stat.ino, mode: stat.mode, nlink: stat.nlink }, identity);
  }
  assert.deepEqual(fs.readdirSync(path.join(productRoot, 'locks')), []);

  // When: the real status and explicit recovery commands inspect the retained sibling lock.
  const status = runCli([
    'lifecycle', 'status', '--install-root', installRoot, '--project', project, '--json',
  ], { cwd: project });
  const recovered = runCli([
    'lifecycle', 'recover-bootstrap-lock', '--install-root', installRoot, '--project', project, '--yes', '--json',
  ], { cwd: project });

  // Then: status names the sibling lock, recovery removes only it, and the caller workspace stays untouched.
  assert.equal(status.status, 1, status.stderr);
  assert.ok(JSON.parse(status.stdout).package_readiness.issues.some((issue) => (
    issue.code === 'BOOTSTRAP_LOCK_PRESENT' && issue.path === path.join(installRoot, '.LazyTrae.bootstrap.lock')
  )));
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).status, 'bootstrap_lock_recovered');
  assert.equal(fs.existsSync(path.join(installRoot, '.LazyTrae.bootstrap.lock')), false);
  assert.equal(fs.readFileSync(path.join(productRoot, 'caller-owned.txt'), 'utf8'), 'caller-owned\n');
  assert.equal(fs.existsSync(path.join(productRoot, 'locks', 'lifecycle.lock')), false);
});

test('failed onboard preserves a caller-owned scaffold with a forged valid bootstrap marker', (t) => {
  // Given: a caller-created exact scaffold and a marker matching the previously public bootstrap schema.
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae forged bootstrap marker '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const project = path.join(sandbox, 'project with spaces');
  const installRoot = path.join(sandbox, 'install root');
  const productRoot = path.join(installRoot, 'LazyTrae');
  const emptyPath = path.join(sandbox, 'empty path');
  const directories = ['releases', 'receipts', 'staging', 'locks', 'rollback'];
  const marker = path.join(productRoot, '.bootstrap-owner.json');
  fs.mkdirSync(project);
  fs.mkdirSync(emptyPath);
  for (const directory of directories) fs.mkdirSync(path.join(productRoot, directory), { recursive: true });
  fs.writeFileSync(marker, '{"nonce":"00000000-0000-4000-8000-000000000000","product":"LazyTrae","schema_version":1}\n');
  const snapshots = new Map(
    ['', ...directories, '.bootstrap-owner.json'].map((entry) => {
      const target = path.join(productRoot, entry);
      const stat = fs.lstatSync(target);
      return [entry, {
        bytes: stat.isFile() ? fs.readFileSync(target) : null,
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        nlink: stat.nlink,
      }];
    }),
  );

  // When: the real lifecycle CLI fails because Git is unavailable.
  const result = runCli([
    'lifecycle', 'onboard', '--source', OFFICIAL,
    '--install-root', installRoot, '--project', project, '--json',
  ], { cwd: project, env: { ...process.env, PATH: emptyPath } });

  // Then: structured failure preserves every caller-owned byte, type, and identity.
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error.code, 'PREREQUISITE_MISSING');
  for (const [entry, snapshot] of snapshots) {
    const target = path.join(productRoot, entry);
    const stat = fs.lstatSync(target);
    assert.deepEqual({
      bytes: stat.isFile() ? fs.readFileSync(target) : null,
      dev: stat.dev,
      ino: stat.ino,
      mode: stat.mode,
      nlink: stat.nlink,
    }, snapshot);
  }
});

test('fresh root creator retries after a concurrent failure acquires its lifecycle lock', { timeout: 15_000 }, async (t) => {
  // Given: the root creator is paused while a second process acquires the new root's lock.
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae creator lock race '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const project = path.join(sandbox, 'project with spaces');
  const installRoot = path.join(sandbox, 'install root');
  const productRoot = path.join(installRoot, 'LazyTrae');
  const emptyPath = path.join(sandbox, 'empty path');
  const hook = path.join(sandbox, 'creator-lock-hook.js');
  const ownerWaiting = path.join(sandbox, 'owner-waiting');
  const releaseOwner = path.join(sandbox, 'release-owner');
  const ownerContended = path.join(sandbox, 'owner-contended');
  const contenderEntered = path.join(sandbox, 'contender-entered');
  const releaseContender = path.join(sandbox, 'release-contender');
  fs.mkdirSync(project);
  fs.mkdirSync(emptyPath);
  fs.writeFileSync(hook, `'use strict';
const childProcess = require('node:child_process');
const fs = require('node:fs');
const wait = (target) => {
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(target)) {
    if (Date.now() >= deadline) throw new Error('barrier timed out: ' + target);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
};
if (process.env.BOOTSTRAP_ROLE === 'owner') {
  const realOpenSync = fs.openSync;
  let paused = false;
  fs.openSync = (target, flags, mode) => {
    if (!paused && target === process.env.BLOCKED_LOCK) {
      paused = true;
      fs.writeFileSync(process.env.OWNER_WAITING, '');
      wait(process.env.RELEASE_OWNER);
    }
    try {
      return realOpenSync(target, flags, mode);
    } catch (error) {
      if (target === process.env.BLOCKED_LOCK && error && error.code === 'EEXIST') {
        fs.writeFileSync(process.env.OWNER_CONTENDED, '');
      }
      throw error;
    }
  };
}
if (process.env.BOOTSTRAP_ROLE === 'contender') {
  const realSpawnSync = childProcess.spawnSync;
  childProcess.spawnSync = (command, args, options) => {
    if (command !== 'git') return realSpawnSync(command, args, options);
    fs.writeFileSync(process.env.CONTENDER_ENTERED, '');
    wait(process.env.RELEASE_CONTENDER);
    const error = new Error('spawnSync git ENOENT');
    error.code = 'ENOENT';
    return { error, status: null, stderr: '', stdout: '' };
  };
}
`);
  const common = {
    ...process.env,
    NODE_OPTIONS: `--require=${JSON.stringify(hook)}`,
    PATH: emptyPath,
  };
  const owner = startOnboard({
    environment: {
      ...common,
      BLOCKED_LOCK: path.join(installRoot, '.LazyTrae.bootstrap.lock'),
      BOOTSTRAP_ROLE: 'owner',
      OWNER_CONTENDED: ownerContended,
      OWNER_WAITING: ownerWaiting,
      RELEASE_OWNER: releaseOwner,
    },
    installRoot,
    projectRoot: project,
  });
  await waitForPath(ownerWaiting);
  const contender = startOnboard({
    environment: {
      ...common,
      BOOTSTRAP_ROLE: 'contender',
      CONTENDER_ENTERED: contenderEntered,
      RELEASE_CONTENDER: releaseContender,
    },
    installRoot,
    projectRoot: project,
  });
  await waitForPath(contenderEntered);

  // When: the creator observes contention before the contender releases the lock.
  fs.writeFileSync(releaseOwner, '');
  await waitForPath(ownerContended);
  fs.writeFileSync(releaseContender, '');
  const results = await Promise.all([owner, contender]);

  // Then: both failures are structured and leave only a reusable unlocked scaffold.
  for (const result of results) {
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).error.code, 'PREREQUISITE_MISSING');
    assert.doesNotMatch(result.stderr, /ENOENT/);
  }
  assert.equal(fs.existsSync(productRoot), true);
  assert.deepEqual(fs.readdirSync(path.join(productRoot, 'locks')), []);
});

test('malformed status arguments retain the common readiness envelope', (t) => {
  // Given: a valid durable root argument and an invalid relative project argument.
  const fixture = lifecycleFixture(t);

  // When: machine-readable lifecycle status parsing fails.
  const result = runCli([
    'lifecycle', 'status', '--install-root', fixture.installRoot,
    '--project', 'relative-project', '--json',
  ], { cwd: fixture.project, env: fixture.env });
  const report = JSON.parse(result.stdout);

  // Then: the failure remains machine-readable in the common readiness envelope.
  assert.equal(result.status, 1);
  assert.equal(report.error.code, 'INVALID_ARGUMENT');
  assert.equal(report.package_readiness.status, 'blocked');
  assert.deepEqual(report.host_readiness, { status: 'pending' });
  assert.equal(report.install_root, path.resolve(fixture.installRoot));
  assert.equal(report.project_root, 'relative-project');
});

test('onboard is repeatable, survives source deletion, and never writes the project or host', (t) => {
  // Given: an official-identity remote, spaced durable/project roots, and a host sentinel.
  const fixture = lifecycleFixture(t);
  const hostSentinel = path.join(fixture.sandbox, 'host-settings.json');
  fs.writeFileSync(hostSentinel, 'caller-owned\n');

  // When: onboarding runs twice and the source transports are then deleted.
  const first = runLifecycle(fixture, 'onboard', ['--source', OFFICIAL]);
  const second = runLifecycle(fixture, 'onboard', ['--source', OFFICIAL]);
  fs.rmSync(fixture.source, { recursive: true });
  fs.rmSync(fixture.remote, { recursive: true });
  const firstReport = JSON.parse(first.stdout);
  const secondReport = JSON.parse(second.stdout);
  const launched = childProcess.spawnSync(
    process.execPath,
    [path.join(fixture.installRoot, 'LazyTrae', 'launcher.js')],
    { encoding: 'utf8' },
  );

  // Then: both calls are ready, the durable launcher works, and external roots remain untouched.
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(firstReport.package_readiness.status, 'ready');
  assert.equal(secondReport.status, 'unchanged');
  assert.equal(launched.status, 0, launched.stderr);
  assert.equal(launched.stdout.trim(), 'durable-cli-ok');
  assert.deepEqual(fs.readdirSync(fixture.project), []);
  assert.equal(fs.readFileSync(hostSentinel, 'utf8'), 'caller-owned\n');
  assert.equal(firstReport.host_readiness.status, 'pending');
});

test('update requires exact same-version revision confirmation and is repeatable', (t) => {
  // Given: an onboarded release and a new commit at the official branch.
  const fixture = lifecycleFixture(t);
  assert.equal(runLifecycle(fixture, 'onboard', ['--source', OFFICIAL]).status, 0);
  fs.appendFileSync(path.join(fixture.source, 'lazytrae-plugin/packages/cli/bin/lazytrae.js'), '// v2\n');
  git(fixture.source, ['add', '.']);
  git(fixture.source, ['commit', '-qm', 'fixture v2']);
  git(fixture.source, ['push', '--force', fixture.remote, 'main']);
  const sha = git(fixture.source, ['rev-parse', 'HEAD']);

  // When: update runs without, with a wrong, with the exact, and then repeats the exact confirmation.
  const pending = runLifecycle(fixture, 'update', ['--source', `${OFFICIAL.slice(0, -4)}/tree/main`]);
  const wrong = runLifecycle(fixture, 'update', ['--source', `${OFFICIAL.slice(0, -4)}/tree/main`, '--confirm-revision', '0'.repeat(40)]);
  const confirmed = runLifecycle(fixture, 'update', ['--source', `${OFFICIAL.slice(0, -4)}/tree/main`, '--confirm-revision', sha]);
  const repeated = runLifecycle(fixture, 'update', ['--source', `${OFFICIAL.slice(0, -4)}/tree/main`]);

  // Then: only exact confirmation promotes and repeating the selected revision is unchanged.
  assert.equal(pending.status, 2);
  assert.equal(JSON.parse(pending.stdout).required_confirmation, sha);
  assert.equal(wrong.status, 1);
  assert.equal(JSON.parse(wrong.stdout).error.code, 'REVISION_CONFIRMATION_MISMATCH');
  assert.equal(confirmed.status, 0, confirmed.stderr);
  assert.equal(JSON.parse(confirmed.stdout).commit_sha, sha);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).status, 'unchanged');
});

test('offboard prints a confirmation plan before exact owned removal', (t) => {
  // Given: an onboarded durable package and a caller-owned project sentinel.
  const fixture = lifecycleFixture(t);
  const projectSentinel = path.join(fixture.project, 'keep.txt');
  fs.writeFileSync(projectSentinel, 'keep\n');
  assert.equal(runLifecycle(fixture, 'onboard', ['--source', OFFICIAL]).status, 0);

  // When: offboard is requested without confirmation.
  const planned = runLifecycle(fixture, 'offboard');

  // Then: the plan is non-mutating.
  assert.equal(planned.status, 2);
  assert.equal(JSON.parse(planned.stdout).status, 'confirmation_required');
  assert.equal(fs.existsSync(path.join(fixture.installRoot, 'LazyTrae')), true);

  // When: offboard is confirmed and then safely repeated.
  const removed = runLifecycle(fixture, 'offboard', ['--yes']);
  const repeated = runLifecycle(fixture, 'offboard', ['--yes']);

  // Then: confirmed removal is product-only and repetition is safe.
  assert.equal(removed.status, 0, removed.stderr);
  assert.equal(JSON.parse(removed.stdout).status, 'removed');
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).status, 'absent');
  assert.equal(fs.readFileSync(projectSentinel, 'utf8'), 'keep\n');
});

test('packed lifecycle upgrades a copied v1 install, rolls back, prunes, and offboards through the durable launcher', (t) => {
  // Given: an offline-installed LazyTrae package and a full copied release fixture downgraded to immutable v1 evidence.
  const fixture = lifecycleFixture(t);
  fs.rmSync(path.join(fixture.source, 'lazytrae-plugin'), { recursive: true });
  writeFullLifecycleRelease(fixture.source);
  git(fixture.source, ['add', '.']);
  git(fixture.source, ['commit', '-qm', 'full lifecycle fixture']);
  git(fixture.source, ['push', '--force', fixture.remote, 'main']);
  const binary = packedBinary(t, fixture.sandbox);
  const runPacked = (entry, subcommand, extra = []) => childProcess.spawnSync(process.execPath, [
    entry, 'lifecycle', subcommand, ...fixture.common, ...extra,
  ], { cwd: fixture.project, encoding: 'utf8', env: fixture.env });
  const onboarded = runPacked(binary, 'onboard', ['--source', `${OFFICIAL.slice(0, -4)}/tree/main`]);
  assert.equal(onboarded.status, 0, onboarded.stderr);
  const productRoot = path.join(fixture.installRoot, 'LazyTrae');
  const launcher = path.join(productRoot, 'launcher.js');
  const firstReport = JSON.parse(onboarded.stdout);
  const firstReceiptPath = path.join(
    productRoot,
    'receipts',
    `lazytrae-1-2-1-${firstReport.commit_sha.slice(0, 12)}.json`,
  );
  const firstReceipt = JSON.parse(fs.readFileSync(firstReceiptPath, 'utf8'));
  firstReceipt.$schema = 'lazy-harness-lifecycle.v1.schema.json';
  firstReceipt.schema_version = 1;
  delete firstReceipt.created_files_scope;
  firstReceipt.created_files.unshift({ path: 'launcher.js', type: 'file', mode: '0755', sha256: 'a'.repeat(64) });
  fs.writeFileSync(firstReceiptPath, JSON.stringify(firstReceipt, null, 2) + '\n');
  const firstReceiptBytes = fs.readFileSync(firstReceiptPath);
  const activePath = path.join(productRoot, 'active.json');
  const firstActive = JSON.parse(fs.readFileSync(activePath, 'utf8'));
  delete firstActive.$schema;
  firstActive.schema_version = 1;
  fs.writeFileSync(activePath, JSON.stringify(firstActive, null, 2) + '\n');
  fs.writeFileSync(launcher, require('../src/lib/lifecycle').LEGACY_LAUNCHER_V1, { mode: 0o755 });
  const legacyStatus = runPacked(launcher, 'status');
  assert.equal(legacyStatus.status, 0, legacyStatus.stderr);
  assert.equal(JSON.parse(legacyStatus.stdout).schema_version, 2);
  fs.appendFileSync(path.join(fixture.source, 'lazytrae-plugin/packages/cli/bin/lazytrae.js'), '\n// upgraded fixture\n');
  git(fixture.source, ['add', '.']);
  git(fixture.source, ['commit', '-qm', 'upgraded fixture']);
  git(fixture.source, ['push', '--force', fixture.remote, 'main']);
  const nextSha = git(fixture.source, ['rev-parse', 'HEAD']);

  // When: packed update and the durable launcher perform the v1-to-v2 operational flow.
  const updated = runPacked(binary, 'update', [
    '--source', `${OFFICIAL.slice(0, -4)}/tree/main`, '--confirm-revision', nextSha,
  ]);
  assert.equal(updated.status, 0, updated.stderr);
  const status = runPacked(launcher, 'status');
  const rollbackPlan = runPacked(launcher, 'rollback');
  const rolledBack = runPacked(launcher, 'rollback', ['--yes']);
  const prunePlan = runPacked(launcher, 'prune');
  const pruned = runPacked(launcher, 'prune', ['--yes']);

  // Then: public output/state are v2, legacy receipt bytes stay immutable, and each destructive step is confirmed.
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).schema_version, 2);
  assert.equal(JSON.parse(fs.readFileSync(activePath, 'utf8')).schema_version, 2);
  assert.deepEqual(fs.readFileSync(firstReceiptPath), firstReceiptBytes);
  assert.equal(rollbackPlan.status, 2, rollbackPlan.stderr);
  assert.equal(rolledBack.status, 0, rolledBack.stderr);
  assert.equal(prunePlan.status, 2, prunePlan.stderr);
  assert.equal(pruned.status, 0, pruned.stderr);
  assert.equal(childProcess.spawnSync(process.execPath, [launcher, '--version']).status, 0);

  const caller = path.join(fixture.installRoot, 'caller-owned.txt');
  const hostSettings = path.join(fixture.project, 'unknown-host-settings.json');
  fs.writeFileSync(caller, 'caller\n');
  fs.writeFileSync(hostSettings, 'host\n');
  assert.equal(runPacked(launcher, 'offboard').status, 2);
  assert.equal(runPacked(launcher, 'offboard', ['--yes']).status, 0);
  assert.equal(fs.readFileSync(caller, 'utf8'), 'caller\n');
  assert.equal(fs.readFileSync(hostSettings, 'utf8'), 'host\n');
});

test('malformed options and misleading self-test success fail closed', (t) => {
  // Given: a clean fixture whose staged self-test prints success but exits nonzero.
  const fixture = lifecycleFixture(t);
  fs.writeFileSync(
    path.join(fixture.source, 'lazytrae-plugin/packages/cli/scripts/lifecycle-self-test.js'),
    "console.log('PASS'); process.exit(7);\n",
  );
  git(fixture.source, ['add', '.']);
  git(fixture.source, ['commit', '-qm', 'misleading test']);
  git(fixture.source, ['push', '--force', fixture.remote, 'main']);

  // When: malformed and misleading onboarding requests are executed.
  const malformed = runLifecycle(fixture, 'status', ['--source', OFFICIAL]);
  const misleading = runLifecycle(fixture, 'onboard', ['--source', `${OFFICIAL.slice(0, -4)}/tree/main`]);

  // Then: both are structured failures and no active release is selected.
  assert.equal(malformed.status, 1);
  assert.equal(JSON.parse(malformed.stdout).error.code, 'INVALID_ARGUMENT');
  assert.equal(misleading.status, 1);
  assert.equal(JSON.parse(misleading.stdout).error.code, 'SELF_TEST_FAILED');
  assert.equal(fs.existsSync(path.join(fixture.installRoot, 'LazyTrae', 'active.json')), false);
});

test('dirty or stale durable state is reported as blocked without cleanup', (t) => {
  // Given: an onboarded release with an abandoned stage and modified active bundle.
  const fixture = lifecycleFixture(t);
  const onboarded = runLifecycle(fixture, 'onboard', ['--source', OFFICIAL]);
  const releaseId = JSON.parse(onboarded.stdout).release_id;
  const entry = path.join(fixture.installRoot, 'LazyTrae', 'releases', releaseId, 'lazytrae-plugin/packages/cli/bin/lazytrae.js');
  const abandoned = path.join(fixture.installRoot, 'LazyTrae', 'staging', 'abandoned');
  const staleLock = path.join(fixture.installRoot, 'LazyTrae', 'locks', 'lifecycle.lock');
  fs.appendFileSync(entry, '// caller edit\n');
  fs.mkdirSync(abandoned);
  fs.writeFileSync(staleLock, '{}\n');

  // When: status inspects the dirty durable bundle.
  const status = runLifecycle(fixture, 'status');
  const report = JSON.parse(status.stdout);

  // Then: readiness is blocked and status preserves every suspicious artifact.
  assert.equal(status.status, 1);
  assert.equal(report.package_readiness.status, 'blocked');
  assert.deepEqual(
    new Set(report.package_readiness.issues.map((issue) => issue.code)),
    new Set(['LOCK_PRESENT', 'STAGING_PRESENT', 'OWNERSHIP_REFUSED']),
  );
  assert.equal(fs.existsSync(staleLock), true);
  assert.equal(fs.existsSync(abandoned), true);
  assert.match(fs.readFileSync(entry, 'utf8'), /caller edit/);
});
