'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { makeFixture, runCli } = require('./test-helpers');

test('status reports independent manifest-driven profiles for every Trae host', () => {
  // Given: a real initialized project with package assets but no host observation.
  const fixture = makeFixture('lazytrae-host-lifecycle-');
  try {
    // When: the public status surface reports all adapters.
    const result = runCli(['status', '--json'], { cwd: fixture });

    // Then: every evidence layer is separate and package-green never promotes the host.
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.schema_version, 2);
    assert.equal(report.contract_version, '2.0.0');
    assert.deepEqual(report.profiles.map(profile => profile.host), ['trae-cli', 'trae-ide', 'trae-work']);
    for (const profile of report.profiles) {
      assert.match(profile.host_fingerprint, /^[0-9a-f]{64}$/);
      assert.equal(profile.package_assets.status, 'ready');
      assert.ok(['ready', 'missing'].includes(profile.generated_assets.status));
      assert.ok(['ready', 'pending'].includes(profile.config.status));
      assert.equal(profile.probe.status, 'pending');
      assert.equal(profile.registration.status, 'pending');
      assert.equal(profile.session.status, 'pending');
      assert.equal(profile.mcp.status, 'pending');
      assert.equal(profile.observation.status, 'pending');
      assert.equal(profile.package_readiness, 'ready');
      assert.equal(profile.host_readiness, 'pending');
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('generated state mutations change the v2 host fingerprint and invalidate readiness', () => {
  // Given: a package-ready CLI adapter with receipt-owned generated assets.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v2-fingerprint-'));
  fs.mkdirSync(path.join(fixture, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: fixture }).status, 0);
    const before = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];

    // When: exact offboarding changes generated state without changing package sources.
    assert.equal(runCli(['offboard', '--host', 'cli', '--yes'], { cwd: fixture }).status, 0);
    const after = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];

    // Then: the canonical fingerprint changes and host readiness remains pending.
    assert.notEqual(after.host_fingerprint, before.host_fingerprint);
    assert.notEqual(after.evidence_fingerprint, before.evidence_fingerprint);
    assert.equal(after.generated_assets.status, 'missing');
    assert.equal(after.host_readiness, 'pending');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('CLI init and offboard own only the manifest-declared candidate outputs', () => {
  // Given: a disposable project containing a caller-owned sentinel.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-cli-offboard-'));
  fs.mkdirSync(path.join(fixture, '.git'));
  fs.writeFileSync(path.join(fixture, 'caller.txt'), 'caller-owned\n');
  try {
    const initialized = runCli(['init', '--host', 'cli'], { cwd: fixture });
    assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
    assert.equal(fs.existsSync(path.join(fixture, '.traecli', 'candidate-receipt.v1.json')), true);

    // When: CLI offboarding is confirmed.
    const removed = runCli(['offboard', '--host', 'cli', '--yes'], { cwd: fixture });

    // Then: exact candidate outputs are removed while shared and caller-owned bytes remain.
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(fs.existsSync(path.join(fixture, '.traecli', 'candidate-receipt.v1.json')), false);
    assert.equal(fs.readFileSync(path.join(fixture, 'caller.txt'), 'utf8'), 'caller-owned\n');
    assert.equal(fs.existsSync(path.join(fixture, '.trae', 'mcp.json')), true);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('sync preserves a caller-modified CLI output and offboard reports the conflict', () => {
  // Given: an initialized CLI adapter whose generated command was edited by the caller.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-cli-conflict-'));
  fs.mkdirSync(path.join(fixture, '.git'));
  try {
    const initialized = runCli(['init', '--host', 'cli'], { cwd: fixture });
    assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
    const command = path.join(fixture, '.traecli', 'candidates', 'lazytrae', 'commands', 'lazy-handoff.md');
    const callerBytes = `${fs.readFileSync(command, 'utf8')}\ncaller edit\n`;
    fs.writeFileSync(command, callerBytes);

    // When: sync runs and then exact offboarding is attempted.
    const synced = runCli(['sync', '--host', 'cli'], { cwd: fixture });
    const removed = runCli(['offboard', '--host', 'cli', '--yes'], { cwd: fixture });

    // Then: sync retains the edit and offboard preserves the conflicting output with a nonzero exit.
    assert.equal(synced.status, 0, `${synced.stdout}\n${synced.stderr}`);
    assert.equal(fs.readFileSync(command, 'utf8'), callerBytes);
    assert.equal(removed.status, 1, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(fs.readFileSync(command, 'utf8'), callerBytes);
    assert.match(removed.stdout, /1 preserved/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('registration without a fingerprint-bound current MCP observation stays pending', () => {
  // Given: a package-ready CLI profile with a bounded probe and matching current session.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-cli-evidence-'));
  fs.mkdirSync(path.join(fixture, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: fixture }).status, 0);
    const probeDir = path.join(fixture, '.lazytrae', 'state', 'host-probes');
    const observationDir = path.join(fixture, '.lazytrae', 'state', 'host-observations');
    fs.mkdirSync(probeDir, { recursive: true });
    fs.mkdirSync(observationDir, { recursive: true });
    const probeBytes = Buffer.from(`${JSON.stringify({
      schema_version: 2, contract_version: '2.0.0', product: 'trae', host: 'cli', status: 'accessible',
      detail: 'fixture', region: 'unknown', edition: 'unknown', capabilities: [], observed_argv: [], host_readiness: 'pending',
      binary: { path: '/fixture/trae', sha256: 'a'.repeat(64) },
    })}\n`);
    fs.writeFileSync(path.join(probeDir, 'trae-cli.json'), probeBytes);
    const sessionsPath = path.join(fixture, '.lazytrae', 'state', 'sessions.json');
    const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    sessions.current_session_id = 'session:current';
    fs.writeFileSync(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`);
    const bound = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];
    const observation = {
      schema_version: 2,
      contract_version: '2.0.0',
      host: 'trae-cli',
      evidence_fingerprint: bound.evidence_fingerprint,
      probe_sha256: crypto.createHash('sha256').update(probeBytes).digest('hex'),
      session_id: 'session:current',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      registration: { status: 'observed' },
      mcp: { status: 'registered' },
      observation: { status: 'observed' },
    };
    fs.writeFileSync(path.join(observationDir, 'trae-cli.json'), `${JSON.stringify(observation)}\n`);

    // When: status reads registration evidence without a connected MCP observation.
    const registered = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];

    // Then: layers report independently and the host is not promoted.
    assert.equal(registered.probe.status, 'observed');
    assert.equal(registered.registration.status, 'observed');
    assert.equal(registered.session.status, 'observed');
    assert.equal(registered.mcp.status, 'pending');
    assert.equal(registered.host_readiness, 'pending');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('v1 stale malformed and mismatched host evidence cannot promote readiness', () => {
  // Given: a package-ready CLI adapter and a current session with hostile evidence variants.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v2-adversarial-'));
  fs.mkdirSync(path.join(fixture, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: fixture }).status, 0);
    const initial = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];
    const probeDir = path.join(fixture, '.lazytrae', 'state', 'host-probes');
    const observationDir = path.join(fixture, '.lazytrae', 'state', 'host-observations');
    fs.mkdirSync(probeDir, { recursive: true });
    fs.mkdirSync(observationDir, { recursive: true });
    const probePath = path.join(probeDir, 'trae-cli.json');
    const observationPath = path.join(observationDir, 'trae-cli.json');
    const sessionsPath = path.join(fixture, '.lazytrae', 'state', 'sessions.json');
    const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    sessions.current_session_id = 'session:current';
    fs.writeFileSync(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`);
    fs.writeFileSync(probePath, '{"schema_version":1,"product":"trae","host":"cli","status":"accessible","binary":{"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}\n');
    fs.writeFileSync(observationPath, '{malformed\n');

    // When: status inspects v1/malformed evidence, then a stale v2 probe.
    const legacy = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];
    const v2Probe = `${JSON.stringify({ schema_version: 2, contract_version: '2.0.0', product: 'trae', host: 'cli', status: 'accessible', detail: 'fixture', region: 'unknown', edition: 'unknown', binary: { path: '/fixture/trae', sha256: 'a'.repeat(64) }, capabilities: [], observed_argv: [], host_readiness: 'pending' })}\n`;
    fs.writeFileSync(probePath, v2Probe);
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(probePath, old, old);
    const stale = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: fixture }).stdout).profiles[0];

    // Then: every hostile variant remains pending and changes evidence identity.
    assert.equal(legacy.probe.status, 'pending');
    assert.equal(legacy.observation.status, 'pending');
    assert.equal(legacy.host_readiness, 'pending');
    assert.equal(stale.probe.status, 'pending');
    assert.equal(stale.host_readiness, 'pending');
    assert.notEqual(legacy.host_fingerprint, initial.host_fingerprint);
    assert.notEqual(stale.host_fingerprint, legacy.host_fingerprint);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
