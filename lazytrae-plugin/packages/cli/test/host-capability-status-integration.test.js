'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { canonicalDigest } = require('../src/lib/host-adapter-fingerprint');
const { runCli } = require('./test-helpers');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-host-status-'));
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'sessions.json'), '{"current_session_id":"session:current"}\n');
  fs.mkdirSync(path.join(root, '.trae'), { recursive: true });
  fs.writeFileSync(path.join(root, '.trae', 'mcp.json'), '{"mcpServers":{}}\n');
  return root;
}

function executable(root, version, help = 'TraeCode CLI help') {
  const target = path.join(root, `traecli-${version}`);
  fs.writeFileSync(target, `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' 'TraeCode CLI ${version}'; else printf '%b\\n' '${help}'; fi\n`, { mode: 0o755 });
  return target;
}

function createProbe(root, version, help) {
  const binary = executable(root, version, help);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  const result = runCli(['host-probe', '--host', 'cli', '--executable', binary, '--expected-sha256', digest, '--json'], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const target = path.join(root, `probe-${version}.json`);
  fs.writeFileSync(target, result.stdout);
  return target;
}

function status(root, host, options = []) {
  const result = runCli(['status', '--host', host, ...options, '--json'], { cwd: root });
  assert.ok([0, 1].includes(result.status), result.stderr);
  return JSON.parse(result.stdout).profiles[0];
}

function statuses(profile) {
  return Object.fromEntries(profile.capability_matrix.capabilities.map(item => [item.capability_id, item.status]));
}

test('status obtains missing current old stale conflict and malformed results from the host adapter', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const missing = statuses(status(root, 'cli'));
  const v2Probe = createProbe(root, '2.4.0', 'TraeCode CLI help\\n  config show');
  const now = new Date(fs.statSync(v2Probe).mtimeMs + 60_000).toISOString();
  const current = statuses(status(root, 'cli', ['--capability-probe', v2Probe, '--session-id', 'session:current', '--now', now]));
  const v1Probe = createProbe(root, '1.9.0', 'TraeCode CLI help');
  const v1Now = new Date(fs.statSync(v1Probe).mtimeMs + 60_000).toISOString();
  const old = statuses(status(root, 'cli', ['--capability-probe', v1Probe, '--session-id', 'session:current', '--now', v1Now]));

  fs.utimesSync(v2Probe, new Date(Date.parse(now) - 16 * 60_000), new Date(Date.parse(now) - 16 * 60_000));
  const stale = statuses(status(root, 'cli', ['--capability-probe', v2Probe, '--session-id', 'session:current', '--now', now]));
  const conflictProbe = createProbe(root, '2.4.0', 'TraeCode CLI help');
  const conflict = JSON.parse(fs.readFileSync(conflictProbe, 'utf8'));
  conflict.capabilities = [
    { name: 'config-yaml', status: 'accessible' },
    { name: 'config-toml', status: 'accessible' },
  ];
  fs.writeFileSync(conflictProbe, `${JSON.stringify(conflict)}\n`);
  const conflictNow = new Date(fs.statSync(conflictProbe).mtimeMs + 60_000).toISOString();
  const ambiguous = statuses(status(root, 'cli', ['--capability-probe', conflictProbe, '--session-id', 'session:current', '--now', conflictNow]));
  fs.writeFileSync(path.join(root, '.trae', 'mcp.json'), '{malformed\n');
  const malformed = statuses(status(root, 'cli'));

  assert.equal(missing.version, 'unavailable');
  assert.equal(current.version, 'host-executed');
  assert.equal(current['config-read'], 'host-observed');
  assert.equal(old['config-yaml-candidate'], 'descriptor-only');
  assert.equal(old['config-toml-candidate'], 'unavailable');
  assert.equal(stale.version, 'unavailable');
  assert.equal(ambiguous['config-yaml-candidate'], 'unavailable');
  assert.equal(ambiguous['config-toml-candidate'], 'unavailable');
  assert.equal(malformed['project-mcp-json'], 'unavailable');
});

test('status lifecycle rejects a fresh receipt bound to another stable host', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = status(root, 'ide', ['--now', '2026-08-27T12:00:00Z']).capability_matrix;
  const receiptPath = path.join(root, 'cross-host-receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify({
    schema_version: 1,
    contract_version: '1.2.0',
    host: 'trae-work',
    client: base.client,
    execution: base.execution,
    build_version: '3.4.5',
    build_sha256: 'b'.repeat(64),
    session_id: 'session:current',
    observed_at: '2026-08-27T11:55:00Z',
    expires_at: '2026-08-27T12:05:00Z',
    descriptor_sha256: base.descriptor_sha256,
    capabilities: [{ capability_id: base.capabilities[0].capability_id, artifact_sha256: 'c'.repeat(64) }],
  })}\n`);

  const crossed = status(root, 'ide', ['--capability-receipt', receiptPath, '--now', '2026-08-27T12:00:00Z']);
  assert.equal(crossed.host, 'trae-ide');
  assert.ok(crossed.capability_matrix.capabilities.every(item => item.status === 'unavailable'));
});

test('all status lifecycle profiles expose byte-stable adapter host identifiers', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = runCli(['status', '--json'], { cwd: root });
  assert.ok([0, 1].includes(result.status), result.stderr);
  const profiles = JSON.parse(result.stdout).profiles;
  assert.deepEqual(profiles.map(item => item.host), ['trae-cli', 'trae-ide', 'trae-work']);
  assert.deepEqual(profiles.map(item => item.capability_matrix.host), ['trae-cli', 'trae-ide', 'trae-work']);
});

test('status validation binds a rehashed promoted matrix to the enclosing host fingerprint', t => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const generated = runCli(['status', '--host', 'ide', '--json'], { cwd: root });
  assert.ok([0, 1].includes(generated.status), generated.stderr);
  const report = JSON.parse(generated.stdout);
  const validPath = path.join(root, 'valid-status.json');
  fs.writeFileSync(validPath, `${JSON.stringify(report)}\n`);

  const valid = runCli(['status', '--validate', validPath], { cwd: root });
  assert.equal(valid.status, 0, valid.stderr);

  const forged = structuredClone(report);
  const promoted = forged.profiles[0].capability_matrix.capabilities[0];
  promoted.status = 'host-observed';
  promoted.evidence.observed_at = '2026-08-27T11:55:00Z';
  promoted.evidence.expires_at = '2026-08-27T12:05:00Z';
  promoted.evidence.session_id = 'session:forged';
  promoted.evidence.build_version = '9.9.9';
  promoted.evidence.build_sha256 = 'f'.repeat(64);
  const matrix = forged.profiles[0].capability_matrix;
  const { matrix_sha256: ignored, ...matrixMaterial } = matrix;
  matrix.matrix_sha256 = canonicalDigest(matrixMaterial);
  const forgedPath = path.join(root, 'forged-status.json');
  fs.writeFileSync(forgedPath, `${JSON.stringify(forged)}\n`);

  const rejected = runCli(['status', '--validate', forgedPath], { cwd: root });
  assert.notEqual(rejected.status, 0);
  assert.deepEqual(JSON.parse(rejected.stderr), { error: 'STATUS_HOST_FINGERPRINT_STALE' });
});
