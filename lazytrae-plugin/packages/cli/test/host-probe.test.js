const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

const OUTCOME_FIXTURE = path.resolve(__dirname, '..', 'contracts', 'fixtures', 'host-probes', 'outcomes.json');

function writeExecutable(root, name, body) {
  const target = path.join(root, name);
  fs.writeFileSync(target, '#!/bin/sh\n' + body + '\n', { mode: 0o755 });
  return target;
}

function digest(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

function withTemporaryDirectory(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-host-probe-'));
  try {
    callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('host probe executes only version and help with a credential-free environment', () => {
  withTemporaryDirectory(root => {
    // Given: an absolute, fingerprint-pinned closed-source Trae CLI-shaped executable.
    const invocationLog = path.join(root, 'invocations');
    const executable = writeExecutable(root, 'trae', [
      "printf '%s|%s|%s|%s\\n' \"$*\" \"${SECRET_TOKEN-}\" \"${HOME-}\" \"${PATH-}\" >> \"" + invocationLog + "\"",
      "if [ \"$1\" = \"--version\" ]; then printf 'Trae CLI 2.4.0 region=global edition=enterprise\\n'; else printf 'Trae CLI help\\n'; fi",
    ].join('\n'));

    // When: the real CLI probe surface is invoked with the binary fingerprint.
    const result = runCli([
      'host-probe', '--host', 'cli', '--executable', executable,
      '--expected-sha256', digest(executable), '--json',
    ], { env: { ...process.env, SECRET_TOKEN: 'must-not-leak' } });

    // Then: typed JSON stays pending and the child saw only allowlisted argv and a clean environment.
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'accessible');
    assert.equal(report.region, 'global');
    assert.equal(report.edition, 'enterprise');
    assert.equal(report.binary.version, '2.4.0');
    assert.equal(report.host_readiness, 'pending');
    assert.deepEqual(report.observed_argv, [['--version'], ['--help']]);
    assert.deepEqual(fs.readFileSync(invocationLog, 'utf8').trim().split('\n'), [
      '--version||/nonexistent|/usr/bin:/bin',
      '--help||/nonexistent|/usr/bin:/bin',
    ]);
  });
});

test('host probe accepts the required closed-source traecli executable name', () => {
  withTemporaryDirectory(root => {
    // Given: a pinned absolute executable named exactly like the closed-source product CLI.
    const invocationLog = path.join(root, 'traecli-invocations');
    const executable = writeExecutable(root, 'traecli', [
      'printf \'%s\\n\' "$*" >> "' + invocationLog + '"',
      "if [ \"$1\" = \"--version\" ]; then printf 'Trae CLI 7.8.9 region=global edition=enterprise\\n'; else printf 'Trae CLI help\\n'; fi",
    ].join('\n'));

    // When: the real probe command receives the exact absolute traecli path and fingerprint.
    const result = runCli([
      'host-probe', '--host', 'cli', '--executable', executable,
      '--expected-sha256', digest(executable), '--json',
    ]);

    // Then: it invokes only the allowlisted inspection arguments and returns accessible JSON.
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'accessible');
    assert.equal(report.binary.path, fs.realpathSync(executable));
    assert.deepEqual(report.observed_argv, [['--version'], ['--help']]);
    assert.deepEqual(fs.readFileSync(invocationLog, 'utf8').trim().split('\n'), ['--version', '--help']);
  });
});

test('host probe rejects relative and open-source trae-agent executables before execution', () => {
  withTemporaryDirectory(root => {
    // Given: a relative path and an executable carrying the forbidden open-source product identity.
    const executionMarker = path.join(root, 'executed');
    const openSource = writeExecutable(root, 'trae-agent', [
      'touch "' + executionMarker + '"',
      "printf 'Trae Agent open source\\n'",
    ].join('\n'));

    // When: both identities are presented to the probe surface.
    const relative = runCli(['host-probe', '--host', 'cli', '--executable', 'trae', '--json']);
    const forbidden = runCli(['host-probe', '--host', 'cli', '--executable', openSource, '--json']);

    // Then: both fail closed without executing the open-source binary.
    assert.equal(relative.status, 2);
    assert.equal(JSON.parse(relative.stdout).status, 'unsupported');
    assert.equal(forbidden.status, 2);
    assert.equal(JSON.parse(forbidden.stdout).status, 'unsupported');
    assert.equal(fs.existsSync(executionMarker), false);
  });
});

test('host probe preserves every typed capability outcome from a validated JSON fixture', () => {
  withTemporaryDirectory(root => {
    // Given: a safe binary and a fixture containing every supported typed outcome.
    const executable = writeExecutable(root, 'trae', "if [ \"$1\" = \"--version\" ]; then printf 'Trae CLI 2.4.0\\n'; else printf 'Trae CLI help\\n'; fi");

    // When: the fixture-backed probe runs.
    const result = runCli([
      'host-probe', '--host', 'cli', '--executable', executable,
      '--expected-sha256', digest(executable), '--fixture', OUTCOME_FIXTURE, '--json',
    ]);

    // Then: no status is collapsed into an ambiguous boolean.
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.capabilities.map(capability => capability.status), [
      'accessible', 'enterprise-only', 'region-blocked', 'coming-soon', 'absent',
      'malformed', 'timeout', 'changed-binary', 'unsupported',
    ]);
    assert.equal(report.host_readiness, 'pending');
  });
});

test('host probe recognizes IDE and Work identities without upgrading readiness', () => {
  withTemporaryDirectory(root => {
    // Given: absolute executables identifying the IDE and Work product surfaces.
    const ide = writeExecutable(root, 'Trae', "printf 'Trae IDE 3.1.0 region=china edition=individual\\n'");
    const work = writeExecutable(root, 'TraeWork', "printf 'Trae Work 5.0.0 region=global edition=enterprise\\n'");

    // When: each selected host is introspected through the same safe command.
    const ideResult = runCli(['host-probe', '--host', 'ide', '--executable', ide, '--expected-sha256', digest(ide), '--json']);
    const workResult = runCli(['host-probe', '--host', 'work', '--executable', work, '--expected-sha256', digest(work), '--json']);

    // Then: host, region, and edition are classified while readiness remains pending.
    const ideReport = JSON.parse(ideResult.stdout);
    const workReport = JSON.parse(workResult.stdout);
    assert.equal(ideReport.status, 'accessible');
    assert.equal(workReport.status, 'accessible');
    assert.deepEqual([ideReport.host, ideReport.region, ideReport.edition, ideReport.host_readiness], [
      'ide', 'china', 'individual', 'pending',
    ]);
    assert.deepEqual([workReport.host, workReport.region, workReport.edition, workReport.host_readiness], [
      'work', 'global', 'enterprise', 'pending',
    ]);
  });
});

test('host probe detects changed binaries and malformed fixtures before execution', () => {
  withTemporaryDirectory(root => {
    // Given: an executable with an execution marker plus a malformed fixture.
    const executionMarker = path.join(root, 'executed');
    const executable = writeExecutable(root, 'trae', [
      'touch "' + executionMarker + '"',
      "printf 'Trae CLI 2.4.0\\n'",
    ].join('\n'));
    const malformedFixture = path.join(root, 'fixture.json');
    fs.writeFileSync(malformedFixture, '{bad json\n');

    // When: the expected fingerprint differs and the fixture cannot be parsed.
    const changed = runCli([
      'host-probe', '--host', 'cli', '--executable', executable,
      '--expected-sha256', '0'.repeat(64), '--json',
    ]);
    const malformed = runCli([
      'host-probe', '--host', 'cli', '--executable', executable,
      '--fixture', malformedFixture, '--json',
    ]);

    // Then: both outcomes are typed and neither attempt executes the target.
    assert.equal(JSON.parse(changed.stdout).status, 'changed-binary');
    assert.equal(JSON.parse(malformed.stdout).status, 'malformed');
    assert.equal(fs.existsSync(executionMarker), false);
  });
});

test('host probe reports an unpinned fingerprint without executing the binary', () => {
  withTemporaryDirectory(root => {
    // Given: an absolute Trae-shaped executable whose digest was not pre-approved.
    const executionMarker = path.join(root, 'executed');
    const executable = writeExecutable(root, 'trae', 'touch "' + executionMarker + '"');

    // When: the probe is invoked without an expected fingerprint.
    const result = runCli(['host-probe', '--host', 'cli', '--executable', executable, '--json']);

    // Then: the digest is reported for a second explicit invocation and the binary is not run.
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'changed-binary');
    assert.equal(report.binary.sha256, digest(executable));
    assert.equal(fs.existsSync(executionMarker), false);
  });
});

test('host probe bounds time and output and rejects script-level network attempts', () => {
  withTemporaryDirectory(root => {
    // Given: binaries that sleep, flood stdout, or contain an explicit network client invocation.
    const timeout = writeExecutable(root, 'trae-timeout', 'sleep 5');
    const flood = writeExecutable(root, 'trae-flood', [
      "printf 'Trae CLI '",
      'i=0; while [ "$i" -lt 90000 ]; do printf x; i=$((i + 1)); done',
    ].join('\n'));
    const networkMarker = path.join(root, 'network-attempted');
    const network = writeExecutable(root, 'trae-network', [
      'touch "' + networkMarker + '"',
      '/usr/bin/curl https://example.invalid',
    ].join('\n'));

    // When: each adversarial executable reaches the real command surface.
    const timedOut = runCli(['host-probe', '--host', 'cli', '--executable', timeout, '--expected-sha256', digest(timeout), '--json']);
    const flooded = runCli(['host-probe', '--host', 'cli', '--executable', flood, '--expected-sha256', digest(flood), '--json']);
    const blockedNetwork = runCli(['host-probe', '--host', 'cli', '--executable', network, '--json']);

    // Then: execution is bounded and the network-shaped script is rejected before its marker is touched.
    assert.equal(JSON.parse(timedOut.stdout).status, 'timeout');
    assert.equal(JSON.parse(flooded.stdout).status, 'malformed');
    assert.equal(JSON.parse(blockedNetwork.stdout).status, 'unsupported');
    assert.equal(fs.existsSync(networkMarker), false);
  });
});
