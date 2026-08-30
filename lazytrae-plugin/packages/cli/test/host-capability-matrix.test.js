'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildCapabilityMatrix } = require('../src/lib/host-capability-matrix');
const { runCli } = require('./test-helpers');

const NOW = '2026-08-27T12:00:00Z';
const STATUSES = new Set(['host-executed', 'host-observed', 'descriptor-only', 'unavailable']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-host-matrix-'));
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'sessions.json'), '{"current_session_id":"session:current"}\n');
  fs.mkdirSync(path.join(root, '.trae'), { recursive: true });
  fs.writeFileSync(path.join(root, '.trae', 'mcp.json'), '{"mcpServers":{}}\n');
  return root;
}

function probe(root, version, capabilities = []) {
  const target = path.join(root, 'trae-cli-probe.json');
  const value = {
    schema_version: 2,
    contract_version: '2.0.0',
    product: 'trae',
    host: 'cli',
    status: 'accessible',
    detail: 'fixture',
    region: 'global',
    edition: 'enterprise',
    binary: { path: '/fixture/traecli', sha256: 'a'.repeat(64), version },
    capabilities,
    observed_argv: [['--version'], ['--help']],
    host_readiness: 'pending',
  };
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`);
  fs.utimesSync(target, new Date('2026-08-27T11:55:00Z'), new Date('2026-08-27T11:55:00Z'));
  return target;
}

function receipt(root, matrix, overrides = {}) {
  const target = path.join(root, 'host-receipt.json');
  const value = {
    schema_version: 1,
    contract_version: '1.2.0',
    host: matrix.host,
    client: matrix.client,
    execution: matrix.execution,
    build_version: '3.4.5',
    build_sha256: 'b'.repeat(64),
    session_id: 'session:current',
    observed_at: '2026-08-27T11:55:00Z',
    expires_at: '2026-08-27T12:05:00Z',
    descriptor_sha256: matrix.descriptor_sha256,
    capabilities: [{ capability_id: matrix.capabilities[0].capability_id, artifact_sha256: 'c'.repeat(64) }],
    ...overrides,
  };
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`);
  return target;
}

function statuses(matrix) {
  return Object.fromEntries(matrix.capabilities.map(item => [item.capability_id, item.status]));
}

function executable(root, body) {
  const target = path.join(root, 'traecli');
  fs.writeFileSync(target, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return target;
}

test('all three stable hosts emit only the four approved statuses with fingerprint evidence', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const matrices = [
    buildCapabilityMatrix(root, 'trae-ide', { now: NOW }),
    buildCapabilityMatrix(root, 'trae-cli', { now: NOW }),
    buildCapabilityMatrix(root, 'trae-work', { now: NOW, client: 'web', execution: 'cloud' }),
  ];

  assert.deepEqual(matrices.map(item => item.host), ['trae-ide', 'trae-cli', 'trae-work']);
  for (const matrix of matrices) {
    assert.match(matrix.descriptor_sha256, /^[0-9a-f]{64}$/);
    assert.match(matrix.matrix_sha256, /^[0-9a-f]{64}$/);
    assert.ok(matrix.capabilities.every(item => STATUSES.has(item.status)));
    assert.ok(matrix.capabilities.every(item => /^[0-9a-f]{64}$/.test(item.evidence.fingerprint)));
  }
});

test('fresh fingerprinted v2 probe promotes only executed and advertised TraeCode CLI features', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const probePath = probe(root, '2.4.0', [{ name: 'config-read', status: 'accessible' }]);

  const matrix = buildCapabilityMatrix(root, 'trae-cli', {
    now: NOW, probePath, sessionId: 'session:current',
  });

  assert.deepEqual(statuses(matrix), {
    version: 'host-executed',
    help: 'host-executed',
    'config-read': 'host-observed',
    'project-mcp-json': 'descriptor-only',
    'config-yaml-candidate': 'unavailable',
    'config-toml-candidate': 'descriptor-only',
    'skills-traecli-candidate': 'descriptor-only',
    'skills-trae-compat-candidate': 'descriptor-only',
  });
  assert.equal(matrix.capabilities[0].evidence.session_id, 'session:current');
  assert.equal(matrix.capabilities[0].evidence.expires_at, '2026-08-27T12:10:00.000Z');
  assert.equal(matrix.capabilities[0].evidence.build_version, '2.4.0');
  assert.equal(matrix.capabilities[0].evidence.build_sha256, 'a'.repeat(64));
  assert.equal(matrix.capabilities[0].evidence.fingerprint, sha256(fs.readFileSync(probePath)));
});

test('mocked current traecli version and help produce a validated executable matrix', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const invocations = path.join(root, 'invocations');
  const binary = executable(root, [
    `printf '%s\\n' "$*" >> "${invocations}"`,
    'if [ "$1" = "--version" ]; then printf "TraeCode CLI 2.4.0\\n"; else printf "TraeCode CLI help\\n  config show\\n"; fi',
  ].join('\n'));
  const digest = sha256(fs.readFileSync(binary));
  const probed = runCli(['host-probe', '--host', 'cli', '--executable', binary, '--expected-sha256', digest, '--json'], { cwd: root });
  assert.equal(probed.status, 0, probed.stderr);
  const probePath = path.join(root, 'validated-probe.json');
  fs.writeFileSync(probePath, probed.stdout);
  const observedAt = fs.statSync(probePath).mtimeMs;
  const now = new Date(observedAt + 60_000).toISOString();

  const result = runCli([
    'host-capabilities', '--host', 'cli', '--probe', probePath,
    '--session-id', 'session:current', '--now', now, '--json',
  ], { cwd: root });

  assert.equal(result.status, 0, result.stderr);
  const matrix = JSON.parse(result.stdout);
  assert.equal(statuses(matrix).version, 'host-executed');
  assert.equal(statuses(matrix).help, 'host-executed');
  assert.equal(statuses(matrix)['config-read'], 'host-observed');
  assert.deepEqual(fs.readFileSync(invocations, 'utf8').trim().split('\n'), ['--version', '--help']);
});

test('probe fixture cannot forge a config-read capability absent from actual help', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binary = executable(root, 'if [ "$1" = "--version" ]; then printf "TraeCode CLI 2.4.0\\n"; else printf "TraeCode CLI help\\n"; fi');
  const fixturePath = path.join(root, 'fixture.json');
  fs.writeFileSync(fixturePath, `${JSON.stringify({
    schema_version: 2, contract_version: '2.0.0', product: 'trae', host: 'cli',
    region: 'unknown', edition: 'unknown', capabilities: [{ name: 'config-read', status: 'accessible' }],
  })}\n`);

  const result = runCli([
    'host-probe', '--host', 'cli', '--executable', binary,
    '--expected-sha256', sha256(fs.readFileSync(binary)), '--fixture', fixturePath, '--json',
  ], { cwd: root });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).capabilities.some(item => item.name === 'config-read'), false);
});

test('absent old stale ambiguous and malformed CLI inputs fail closed per feature', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const absent = statuses(buildCapabilityMatrix(root, 'trae-cli', { now: NOW }));
  const v1 = statuses(buildCapabilityMatrix(root, 'trae-cli', {
    now: NOW, probePath: probe(root, '1.9.0'), sessionId: 'session:current',
  }));
  const ambiguousPath = probe(root, '2.4.0', [
    { name: 'config-yaml', status: 'accessible' },
    { name: 'config-toml', status: 'accessible' },
  ]);
  const ambiguous = statuses(buildCapabilityMatrix(root, 'trae-cli', {
    now: NOW, probePath: ambiguousPath, sessionId: 'session:current',
  }));
  fs.utimesSync(ambiguousPath, new Date('2026-08-27T11:00:00Z'), new Date('2026-08-27T11:00:00Z'));
  const stale = statuses(buildCapabilityMatrix(root, 'trae-cli', {
    now: NOW, probePath: ambiguousPath, sessionId: 'session:current',
  }));
  fs.writeFileSync(path.join(root, '.trae', 'mcp.json'), '{bad json\n');
  const malformed = statuses(buildCapabilityMatrix(root, 'trae-cli', { now: NOW }));

  assert.equal(absent.version, 'unavailable');
  assert.equal(v1['config-yaml-candidate'], 'descriptor-only');
  assert.equal(v1['config-toml-candidate'], 'unavailable');
  assert.equal(ambiguous['config-yaml-candidate'], 'unavailable');
  assert.equal(ambiguous['config-toml-candidate'], 'unavailable');
  assert.equal(stale.version, 'unavailable');
  assert.equal(stale.help, 'unavailable');
  assert.equal(malformed['project-mcp-json'], 'unavailable');
});

test('fresh IDE receipt promotes only its exact capability while stale and cross-host receipts do not', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = buildCapabilityMatrix(root, 'trae-ide', { now: NOW });
  const receiptPath = receipt(root, base);

  const current = buildCapabilityMatrix(root, 'trae-ide', { now: NOW, receiptPath });
  assert.equal(current.capabilities[0].status, 'host-observed');
  assert.equal(current.capabilities[0].evidence.build_version, '3.4.5');
  assert.equal(current.capabilities[0].evidence.build_sha256, 'b'.repeat(64));
  assert.ok(current.capabilities.slice(1).every(item => item.status === 'descriptor-only'));

  receipt(root, base, { observed_at: '2026-08-27T11:00:00Z', expires_at: '2026-08-27T13:00:00Z' });
  const stale = buildCapabilityMatrix(root, 'trae-ide', { now: NOW, receiptPath });
  assert.ok(stale.capabilities.every(item => item.status === 'unavailable'));

  receipt(root, base, { host: 'trae-work' });
  const crossed = buildCapabilityMatrix(root, 'trae-ide', { now: NOW, receiptPath });
  assert.ok(crossed.capabilities.every(item => item.status === 'unavailable'));
});

test('TraeWork profiles distinguish desktop web mobile and local cloud without native claims', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const profiles = [
    ['desktop', 'local'], ['desktop', 'cloud'], ['web', 'cloud'], ['mobile', 'local'], ['mobile', 'cloud'],
  ].map(([client, execution]) => buildCapabilityMatrix(root, 'trae-work', { now: NOW, client, execution }));

  for (const matrix of profiles) {
    const result = statuses(matrix);
    assert.equal(result[`client-${matrix.client}`], 'descriptor-only');
    assert.equal(result[`execution-${matrix.execution}`], 'descriptor-only');
    for (const forbidden of ['native-cli', 'native-worktree', 'durable-checkpoint', 'a2a', 'nested-delegation']) {
      assert.equal(result[forbidden], 'unavailable');
    }
    assert.ok(matrix.capabilities.every(item => item.status !== 'host-executed'));
  }
  assert.throws(() => buildCapabilityMatrix(root, 'trae-work', { now: NOW, client: 'web', execution: 'local' }));
});

test('real CLI matrix command validates a fresh Work receipt and emits deterministic JSON', t => {
  const root = project();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = buildCapabilityMatrix(root, 'trae-work', { now: NOW, client: 'desktop', execution: 'local' });
  const receiptPath = receipt(root, base);

  const args = ['host-capabilities', '--host', 'work', '--client', 'desktop', '--execution', 'local', '--receipt', receiptPath, '--now', NOW, '--json'];
  const first = runCli(args, { cwd: root });
  const repeat = runCli(args, { cwd: root });

  assert.equal(first.status, 0, first.stderr);
  assert.equal(repeat.stdout, first.stdout);
  const matrix = JSON.parse(first.stdout);
  assert.equal(matrix.host, 'trae-work');
  assert.equal(matrix.capabilities[0].status, 'host-observed');
  assert.ok(matrix.capabilities.every(item => item.status !== 'host-executed'));
});
