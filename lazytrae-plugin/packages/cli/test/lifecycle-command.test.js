'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

const OFFICIAL = 'https://github.com/elvinzhao10/LazyTrae.git';
const CONTRACTS = path.resolve(__dirname, '..', 'contracts');

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
  fs.writeFileSync(path.join(cli, 'package.json'), '{"name":"lazytrae-ai","version":"1.0.3"}\n');
  fs.writeFileSync(path.join(cli, 'bin', 'lazytrae.js'), "process.stdout.write('durable-cli-ok\\n');\n");
  fs.writeFileSync(path.join(cli, 'scripts', 'lifecycle-self-test.js'), selfTest);
  for (const name of ['lazy-harness-lifecycle.v1.schema.json', 'lazy-harness-lifecycle.v1.example.json']) {
    const bytes = fs.readFileSync(path.join(CONTRACTS, name));
    fs.writeFileSync(path.join(cli, 'contracts', name), bytes);
    fs.writeFileSync(
      path.join(cli, 'contracts', `${name}.sha256`),
      `${crypto.createHash('sha256').update(bytes).digest('hex')}  ${name}\n`,
    );
  }
}

function lifecycleFixture() {
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae lifecycle command '));
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
  git(source, ['tag', 'v1.0.3']);
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

test('lifecycle help documents the durable subcommands and exact flags', () => {
  // Given: the direct CLI entry point.
  // When: lifecycle help is requested.
  const result = runCli(['lifecycle', '--help']);

  // Then: every durable operation and its public option names are visible.
  assert.equal(result.status, 0);
  for (const token of ['onboard', 'update', 'status', 'offboard', '--install-root', '--project', '--json', '--source', '--confirm-revision', '--yes']) {
    assert.match(result.stdout, new RegExp(token.replaceAll('-', '\\-')));
  }
});

test('status keeps package readiness separate from unobserved host readiness', () => {
  // Given: an absent durable root and an existing project.
  const fixture = lifecycleFixture();

  // When: machine-readable status is requested.
  const result = runLifecycle(fixture, 'status');
  const report = JSON.parse(result.stdout);

  // Then: package absence is distinct from host observation and status does not create the root.
  assert.equal(result.status, 0);
  assert.equal(report.package_readiness.status, 'absent');
  assert.equal(report.host_readiness.status, 'pending');
  assert.equal(fs.existsSync(fixture.installRoot), false);
});

test('onboard is repeatable, survives source deletion, and never writes the project or host', () => {
  // Given: an official-identity remote, spaced durable/project roots, and a host sentinel.
  const fixture = lifecycleFixture();
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

test('update requires exact same-version revision confirmation and is repeatable', () => {
  // Given: an onboarded release and a new commit at the official branch.
  const fixture = lifecycleFixture();
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

test('offboard prints a confirmation plan before exact owned removal', () => {
  // Given: an onboarded durable package and a caller-owned project sentinel.
  const fixture = lifecycleFixture();
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

test('malformed options and misleading self-test success fail closed', () => {
  // Given: a clean fixture whose staged self-test prints success but exits nonzero.
  const fixture = lifecycleFixture();
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

test('dirty or stale durable state is reported as blocked without cleanup', () => {
  // Given: an onboarded release with an abandoned stage and modified active bundle.
  const fixture = lifecycleFixture();
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
