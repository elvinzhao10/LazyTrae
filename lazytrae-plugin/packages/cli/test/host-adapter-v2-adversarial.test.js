'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawn } = require('node:child_process');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { runCli } = require('./test-helpers');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(PACKAGE_ROOT, 'src', 'index.js');

function profile(root) {
  const result = runCli(['status', '--host', 'cli', '--json'], { cwd: root });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout).profiles[0];
}

function writeBoundEvidence(root, mcpStatus = 'connected') {
  const state = path.join(root, '.lazytrae', 'state');
  const probeDir = path.join(state, 'host-probes');
  const observationDir = path.join(state, 'host-observations');
  fs.mkdirSync(probeDir, { recursive: true });
  fs.mkdirSync(observationDir, { recursive: true });
  const probeBytes = Buffer.from(`${JSON.stringify({
    schema_version: 2, contract_version: '2.0.0', product: 'trae', host: 'cli', status: 'accessible',
    detail: 'fixture', region: 'unknown', edition: 'unknown', capabilities: [], observed_argv: [], host_readiness: 'pending',
    binary: { path: '/fixture/trae', sha256: 'a'.repeat(64) },
  })}\n`);
  fs.writeFileSync(path.join(probeDir, 'trae-cli.json'), probeBytes);
  const sessionsPath = path.join(state, 'sessions.json');
  const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
  sessions.current_session_id = 'session:current';
  fs.writeFileSync(sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`);
  const bound = profile(root);
  const observation = {
    schema_version: 2,
    contract_version: '2.0.0',
    host: 'trae-cli',
    evidence_fingerprint: bound.evidence_fingerprint,
    probe_sha256: crypto.createHash('sha256').update(probeBytes).digest('hex'),
    session_id: 'session:current',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    registration: { status: 'observed' },
    mcp: { status: mcpStatus },
    observation: { status: 'observed' },
  };
  fs.writeFileSync(path.join(observationDir, 'trae-cli.json'), `${JSON.stringify(observation)}\n`);
  return { observation, sessionsPath, observationPath: path.join(observationDir, 'trae-cli.json') };
}

test('v2 evidence promotes only a connected current host and fingerprints every mutation', () => {
  // Given: generated assets and fresh v2 probe/session/observation evidence bound to their bytes.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v2-ready-'));
  fs.mkdirSync(path.join(root, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: root }).status, 0);
    const evidence = writeBoundEvidence(root);
    const ready = profile(root);
    const repeat = profile(root);
    assert.equal(ready.host_readiness, 'observed');
    assert.equal(repeat.host_fingerprint, ready.host_fingerprint);

    // When: the current session changes and then an observation makes a misleading registered-only claim.
    const sessions = JSON.parse(fs.readFileSync(evidence.sessionsPath, 'utf8'));
    sessions.current_session_id = 'session:replacement';
    fs.writeFileSync(evidence.sessionsPath, `${JSON.stringify(sessions, null, 2)}\n`);
    const changedSession = profile(root);
    evidence.observation.mcp.status = 'registered';
    fs.writeFileSync(evidence.observationPath, `${JSON.stringify(evidence.observation)}\n`);
    const misleading = profile(root);

    // Then: both byte-level mutations change identity and fail closed without false readiness.
    assert.equal(changedSession.host_readiness, 'pending');
    assert.equal(misleading.host_readiness, 'pending');
    assert.notEqual(changedSession.host_fingerprint, ready.host_fingerprint);
    assert.notEqual(misleading.host_fingerprint, changedSession.host_fingerprint);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('malformed public status arguments fail deterministically without mutating generated state', () => {
  // Given: a clean initialized CLI adapter and its generated receipt bytes.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v2-malformed-'));
  fs.mkdirSync(path.join(root, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: root }).status, 0);
    const receipt = path.join(root, '.traecli', 'candidate-receipt.v1.json');
    const before = fs.readFileSync(receipt);

    // When: the real CLI receives the same malformed host selection twice.
    const first = runCli(['status', '--host', 'bogus', '--json'], { cwd: root });
    const second = runCli(['status', '--host', 'bogus', '--json'], { cwd: root });

    // Then: both invocations fail identically and the receipt remains byte-identical.
    assert.notEqual(first.status, 0);
    assert.equal(second.status, first.status);
    assert.equal(second.stderr, first.stderr);
    assert.deepEqual(fs.readFileSync(receipt), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('public status probe and observation artifacts satisfy the exact v2 schemas', () => {
  // Given: actual CLI status/probe output and the exact persisted observation shape.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v2-schema-'));
  fs.mkdirSync(path.join(root, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: root }).status, 0);
    const evidence = writeBoundEvidence(root);
    const status = JSON.parse(runCli(['status', '--host', 'cli', '--json'], { cwd: root }).stdout);
    const executable = path.join(root, 'trae-cli');
    fs.writeFileSync(executable, '#!/bin/sh\nprintf "Trae CLI 1.2.3\\nregion: global\\nedition: enterprise\\n"\n');
    fs.chmodSync(executable, 0o755);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
    const probeResult = runCli(['host-probe', '--host', 'cli', '--executable', executable, '--expected-sha256', digest, '--json'], { cwd: root });
    assert.equal(probeResult.status, 0, `${probeResult.stdout}\n${probeResult.stderr}`);
    const probe = JSON.parse(probeResult.stdout);
    const observation = JSON.parse(fs.readFileSync(evidence.observationPath, 'utf8'));
    const ajv = new Ajv2020({ strict: true });
    addFormats(ajv);

    // When: every public artifact is validated against its published v2 contract.
    const cases = [
      ['status', 'lazyseries-trae-host-status.v2.schema.json', status],
      ['probe', 'lazyseries-trae-host-probe.v2.schema.json', probe],
      ['observation', 'lazyseries-trae-host-observation.v2.schema.json', observation],
    ];

    // Then: all real artifacts validate without schema coercion or ignored fields.
    for (const [label, schemaFile, value] of cases) {
      const schema = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'contracts', schemaFile), 'utf8'));
      const validate = ajv.compile(schema);
      assert.equal(validate(value), true, `${label}: ${ajv.errorsText(validate.errors)}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an interrupted real status process leaves deterministic state for resume', async () => {
  // Given: an initialized CLI adapter and an in-flight public status process.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v2-interrupt-'));
  fs.mkdirSync(path.join(root, '.git'));
  try {
    assert.equal(runCli(['init', '--host', 'cli'], { cwd: root }).status, 0);
    const receipt = path.join(root, '.traecli', 'candidate-receipt.v1.json');
    const before = fs.readFileSync(receipt);
    const child = spawn(process.execPath, [CLI, 'status', '--host', 'cli', '--json'], {
      cwd: root,
      stdio: 'ignore',
    });

    // When: the process is cancelled and the same public command is resumed.
    const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
    child.kill('SIGTERM');
    const interruption = await closed;
    const resumed = runCli(['status', '--host', 'cli', '--json'], { cwd: root });
    const repeated = runCli(['status', '--host', 'cli', '--json'], { cwd: root });

    // Then: interruption is observable while resumed output and owned bytes are deterministic.
    assert.equal(interruption.signal, 'SIGTERM');
    assert.equal(resumed.status, 0, `${resumed.stdout}\n${resumed.stderr}`);
    assert.equal(repeated.stdout, resumed.stdout);
    assert.deepEqual(fs.readFileSync(receipt), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
