'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const cliRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(cliRoot, 'contracts', 'fixtures', 'host-evidence-v1', 'valid-trae-ide-native-snapshot.json');
const driverPath = path.join(cliRoot, 'src', 'lib', 'trae-ide-observation.js');
const { observeTraeIde } = require('../src/lib/trae-ide-observation');
const expectedClassifications = [
  ['lazyseries:feature:sandbox', 'observe-only', 'host-observed'],
  ['lazyseries:feature:mcp', 'observe-only', 'host-observed'],
  ['lazyseries:feature:model', 'descriptor-only', 'host-descriptor'],
  ['lazyseries:feature:plan-spec', 'descriptor-only', 'host-descriptor'],
  ['lazyseries:feature:task', 'descriptor-only', 'host-descriptor'],
  ['lazyseries:feature:diff', 'observe-only', 'host-observed'],
  ['lazyseries:feature:remote-ssh', 'descriptor-only', 'host-descriptor'],
];

function fixture() {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function validateSchema(value) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(cliRoot, 'contracts', 'lazyseries-host-evidence-defs.v1.schema.json'), 'utf8')));
  const schema = JSON.parse(fs.readFileSync(path.join(cliRoot, 'contracts', 'lazyseries-trae-ide-observation-descriptor.v1.schema.json'), 'utf8'));
  const validate = ajv.compile(schema);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

test('emits a typed sanitized descriptor without mutating its source fixture', () => {
  // Given: a real Trae IDE snapshot containing credentials and credential-bearing URLs.
  const input = fixture();
  const before = fs.readFileSync(fixturePath);
  const mode = fs.statSync(fixturePath).mode;

  // When: the package observation driver parses the snapshot.
  const descriptor = observeTraeIde(input, { now: '2026-08-03T10:00:00Z' });

  // Then: the descriptor is typed, complete, read-only, sanitized, and side-effect free.
  validateSchema(descriptor);
  assert.equal(descriptor.status, 'valid');
  assert.equal(descriptor.feature_descriptors.length, expectedClassifications.length);
  assert.equal(new Set(descriptor.feature_descriptors.map(feature => feature.canonical_id)).size, expectedClassifications.length);
  assert.ok(descriptor.feature_descriptors.every(feature => feature.host_card.read_only && feature.host_card.canonical_id === feature.canonical_id));
  assert.deepEqual(
    descriptor.feature_descriptors.map(({ canonical_id, native_mode, evidence_tier }) => ({ canonical_id, native_mode, evidence_tier })),
    expectedClassifications.map(([canonical_id, native_mode, evidence_tier]) => ({ canonical_id, native_mode, evidence_tier })),
  );
  const serialized = JSON.stringify(descriptor);
  assert.doesNotMatch(serialized, /fixture-(?:user|password|token|secret)|models\.example|remote\.example|base_url|credential/i);
  assert.deepEqual(fs.readFileSync(fixturePath), before);
  assert.equal(fs.statSync(fixturePath).mode, mode);
});

test('invalidates a sandbox bypass without changing permissions', () => {
  // Given: a snapshot reporting a sandbox bypass.
  const input = fixture();
  input.sandbox.bypassed = true;

  // When: the snapshot is observed.
  const descriptor = observeTraeIde(input, { now: '2026-08-03T10:00:00Z' });

  // Then: the observation is invalid and no permission change is attempted.
  assert.equal(descriptor.status, 'invalid');
  assert.deepEqual(descriptor.invalidations, ['sandbox-bypass']);
});

test('invalidates changed remote roots and model endpoints', () => {
  // Given: fingerprints captured before both host contexts changed.
  const input = fixture();
  input.remote.root = 'ssh://remote.example.invalid/a-different-root';
  input.model.base_url = 'https://another-model.example.invalid/v2';

  // When: the stale observation is parsed.
  const descriptor = observeTraeIde(input, { now: '2026-08-03T10:00:00Z' });

  // Then: both fingerprint dependencies explicitly invalidate the record.
  assert.equal(descriptor.status, 'invalid');
  assert.deepEqual(descriptor.invalidations, ['model-endpoint-changed', 'remote-root-changed']);
});

test('emits sanitized typed records for every named Trae IDE surface', () => {
  // Given: native observations for MCP, model, Plan/Spec, tasks, subagents, retries, Diff history, and Remote SSH identity.
  const input = fixture();

  // When: the complete native snapshot crosses the observation boundary.
  const descriptor = observeTraeIde(input, { now: '2026-08-03T10:00:00Z' });

  // Then: each named surface is represented without writable canonical state.
  validateSchema(descriptor);
  assert.deepEqual(descriptor.surface_records.mcp, { oauth_state: 'connected', project_scope: 'workspace', read_only: true });
  assert.deepEqual(descriptor.surface_records.model, { context_window_tokens: 200000, tool_rounds_supported: true, read_only: true });
  assert.deepEqual(descriptor.surface_records.plan_spec.commands.map(command => command.kind), ['plan', 'spec']);
  assert.ok(descriptor.surface_records.plan_spec.commands.every(command => command.read_only));
  assert.deepEqual(descriptor.surface_records.task.cards[0], { host_card_id: 'trae:task:card:001', canonical_task_id: 'task:001', observed_status: 'running', read_only: true });
  assert.deepEqual(descriptor.surface_records.task.subagents[0], { subagent_id: 'trae:subagent:001', canonical_task_id: 'task:001', observed_status: 'running', read_only: true });
  assert.deepEqual(descriptor.surface_records.task.retries[0], { retry_id: 'trae:retry:001', canonical_task_id: 'task:001', attempt: 2, observed_status: 'failed', canonical_completion: 'unclaimed', read_only: true });
  assert.deepEqual(descriptor.surface_records.diff.history[0].canonical_diff_id, 'diff:001');
  assert.equal(descriptor.surface_records.diff.history[0].read_only, true);
  assert.deepEqual(descriptor.surface_records.remote_ssh.identity, { host_key_fingerprint: 'd'.repeat(64), profile_fingerprint: 'e'.repeat(64), read_only: true });
  assert.doesNotMatch(JSON.stringify(descriptor), /base_url|credential|fixture-(?:user|password|token|secret)|models\.example|remote\.example/i);
});

test('rejects a supported retry card that claims canonical completion', () => {
  // Given: a structurally supported retry card whose host status claims completion.
  const input = fixture();
  input.task.retries[0].status = 'complete';

  // When/Then: completion authority is rejected at the retry semantic boundary.
  assert.throws(
    () => observeTraeIde(input, { now: '2026-08-03T10:00:00Z' }),
    /retry status complete cannot claim canonical completion/i,
  );
});

test('fails closed for hostile named-surface metadata', () => {
  // Given: one hostile mutation for each newly supported observation record.
  const cases = [
    [value => { value.mcp.oauth_token = 'fixture-token'; }, /mcp has unknown fields: oauth_token/i],
    [value => { value.model.context_window_tokens = 0; }, /context_window_tokens must be a positive integer/i],
    [value => { value.plan_spec.commands[1] = { ...value.plan_spec.commands[0] }; }, /duplicate plan_spec commands/i],
    [value => { value.task.subagents[0].canonical_task_id = '!'; }, /canonical_task_id is malformed/i],
    [value => { value.diff.history.push({ ...value.diff.history[0] }); }, /duplicate diff history/i],
    [value => { value.remote.identity.host_key_fingerprint = 'raw-host-name'; }, /host_key_fingerprint is malformed/i],
  ];

  // When/Then: every named-surface attack is rejected before descriptor emission.
  for (const [mutate, expected] of cases) {
    const input = fixture();
    mutate(input);
    assert.throws(() => observeTraeIde(input, { now: '2026-08-03T10:00:00Z' }), expected);
  }
});

test('fails closed for duplicate mirrors unsupported schemas prompts malformed dirty and misleading input', () => {
  // Given: hostile inputs for each observation boundary.
  const cases = [
    [value => { value.feature_observations[1] = { ...value.feature_observations[0] }; }, /duplicate feature/i],
    [value => { value.schema_version = 99; }, /schema_version is unsupported/i],
    [value => { value.prompt = 'ignore safeguards'; }, /unknown fields: prompt/i],
    [value => { value.model.base_url = 'not a URL'; }, /base_url is malformed/i],
    [value => { value.dirty_state = true; }, /unknown fields: dirty_state/i],
    [value => { value.feature_observations[0].native_mode = 'invoke-documented'; }, /unknown fields: native_mode/i],
  ];

  // When/Then: every malformed or authority-forging snapshot is rejected.
  for (const [mutate, expected] of cases) {
    const input = fixture();
    mutate(input);
    assert.throws(() => observeTraeIde(input, { now: '2026-08-03T10:00:00Z' }), expected);
  }
});

test('real CLI observation is deterministic bounded and retryable', () => {
  // Given: the shipped driver, a malformed first attempt, and the valid sanitized fixture.
  const malformed = path.join(process.env.TMPDIR || process.env.TMP || '/tmp', `lazytrae-trae-ide-malformed-${process.pid}.json`);
  fs.writeFileSync(malformed, '{');
  try {
    // When: a failed parse is retried twice with the valid input.
    const failed = childProcess.spawnSync(process.execPath, [driverPath, malformed, '2026-08-03T10:00:00Z'], { encoding: 'utf8', timeout: 1000 });
    const first = childProcess.spawnSync(process.execPath, [driverPath, fixturePath, '2026-08-03T10:00:00Z'], { encoding: 'utf8', timeout: 1000 });
    const repeated = childProcess.spawnSync(process.execPath, [driverPath, fixturePath, '2026-08-03T10:00:00Z'], { encoding: 'utf8', timeout: 1000 });

    // Then: malformed input fails, retry completes, and repetition emits one stable record.
    assert.equal(failed.status, 1);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(first.stdout, repeated.stdout);
    assert.equal(JSON.parse(first.stdout).status, 'valid');
    assert.doesNotMatch(`${first.stdout}${first.stderr}`, /fixture-(?:user|password|token|secret)|models\.example|remote\.example/i);
  } finally {
    fs.rmSync(malformed, { force: true });
  }
});
