const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  REQUIRED_FIELDS,
  VALID_MODES,
  validateAdaptiveSnapshot,
  readAdaptiveSnapshot,
  writeAdaptiveSnapshot,
  clearAdaptiveSnapshot,
} = require('../src/lib/adaptive-snapshot');
const { defaultLoop } = require('../src/lib/loop-store');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CHECKED_IN_SCHEMA = path.join(
  REPO_ROOT, '.lazytrae', 'schemas', 'active-loop.schema.json',
);
const TEMPLATE_SCHEMA = path.join(
  REPO_ROOT, 'packages', 'cli', 'templates', 'schemas', 'active-loop.schema.json',
);
const STATE_TEMPLATE = path.join(
  REPO_ROOT, 'packages', 'cli', 'templates', 'state', 'active-loop.json',
);

function validSnapshot(overrides = {}) {
  return {
    mode: 'planned',
    stages: ['understand', 'plan', 'implement', 'verify'],
    responsibilities: ['planning', 'implementation', 'verification'],
    capabilities: ['text-search', 'semantic-navigation'],
    not_selected: {
      stages: ['debug', 'review', 'continue'],
      capabilities: ['structural-search'],
    },
    approval_required: false,
    reasons: ['cross-file change', 'unfamiliar subsystem'],
    started_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    completed_at: null,
    escalation_count: 0,
    escalation_history: [],
    last_resolution: null,
    single_writer: 'orchestrator',
    ...overrides,
  };
}

test('validateAdaptiveSnapshot accepts a complete Section 11 snapshot', () => {
  assert.equal(validateAdaptiveSnapshot(validSnapshot()), true);
  for (const mode of VALID_MODES) {
    assert.equal(validateAdaptiveSnapshot(validSnapshot({ mode })), true, `mode=${mode}`);
  }
});

test('readAdaptiveSnapshot returns null when adaptive is absent or null', () => {
  assert.equal(readAdaptiveSnapshot({}), null);
  assert.equal(readAdaptiveSnapshot({ adaptive: null }), null);
  assert.equal(readAdaptiveSnapshot(null), null);
  assert.equal(readAdaptiveSnapshot(undefined), null);
  assert.equal(readAdaptiveSnapshot('string'), null);
});

test('writeAdaptiveSnapshot sets updated_at to a current ISO timestamp', () => {
  const loopState = { adaptive: null };
  const before = Date.now();
  const written = writeAdaptiveSnapshot(loopState, validSnapshot({ updated_at: null }));
  const after = Date.now();
  assert.equal(typeof written.updated_at, 'string');
  const parsed = Date.parse(written.updated_at);
  assert.ok(parsed >= before && parsed <= after, 'updated_at must be the current time');
  assert.equal(loopState.adaptive, written);
  assert.equal(validateAdaptiveSnapshot(written), true);
});

test('clearAdaptiveSnapshot sets adaptive to null', () => {
  const loopState = { adaptive: validSnapshot() };
  assert.notEqual(loopState.adaptive, null);
  clearAdaptiveSnapshot(loopState);
  assert.equal(loopState.adaptive, null);
  // Idempotent.
  clearAdaptiveSnapshot(loopState);
  assert.equal(loopState.adaptive, null);
});

test('v1.0.2 state files (without adaptive) still load through readAdaptiveSnapshot', () => {
  // A v1.0.2 state file has no `adaptive` field at all.
  const v102State = {
    version: 1,
    loop_state: 'idle',
    goals: [],
    created_at: '2026-07-09T00:00:00Z',
    updated_at: '2026-07-09T00:00:00Z',
  };
  assert.equal(readAdaptiveSnapshot(v102State), null);
  assert.equal(Object.prototype.hasOwnProperty.call(v102State, 'adaptive'), false);
  // Writing then clearing leaves the field present but null — v1.0.2 readers ignore it.
  writeAdaptiveSnapshot(v102State, validSnapshot());
  clearAdaptiveSnapshot(v102State);
  assert.equal(readAdaptiveSnapshot(v102State), null);
});

test('single-writer rule: snapshot.single_writer must equal "orchestrator"', () => {
  assert.equal(validSnapshot().single_writer, 'orchestrator');
  assert.equal(validateAdaptiveSnapshot(validSnapshot()), true);
  assert.equal(
    validateAdaptiveSnapshot(validSnapshot({ single_writer: 'mcp' })),
    false,
  );
  assert.equal(
    validateAdaptiveSnapshot(validSnapshot({ single_writer: 'agent' })),
    false,
  );
});

test('schema extension: active-loop schema declares adaptive as optional, version stays 1', () => {
  const schema = JSON.parse(fs.readFileSync(CHECKED_IN_SCHEMA, 'utf8'));
  assert.equal(
    Object.prototype.hasOwnProperty.call(schema.properties, 'adaptive'),
    true,
    'schema must declare the adaptive property',
  );
  assert.deepEqual(schema.properties.adaptive.type, ['object', 'null']);
  assert.equal(schema.required.includes('adaptive'), false, 'adaptive must be optional');
  // Additive extension: schema version remains constrained to 1.
  assert.equal(schema.properties.version.minimum, 1);
  assert.equal(schema.properties.version.maximum, 1);
  // The checked-in schema and the template schema mirror must stay byte-identical
  // (state-contracts.test.js enforces this parity independently).
  const templateSchema = JSON.parse(fs.readFileSync(TEMPLATE_SCHEMA, 'utf8'));
  assert.deepEqual(
    templateSchema,
    schema,
    'checked-in schema and template schema must be identical',
  );
  // All 14 fields appear in the adaptive property schema.
  const adaptiveProps = schema.properties.adaptive.properties;
  for (const field of REQUIRED_FIELDS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(adaptiveProps, field),
      true,
      `adaptive schema must declare ${field}`,
    );
  }
});

test('template active-loop.json ships with adaptive: null default', () => {
  const template = JSON.parse(fs.readFileSync(STATE_TEMPLATE, 'utf8'));
  assert.equal(
    Object.prototype.hasOwnProperty.call(template, 'adaptive'),
    true,
    'template must include adaptive field',
  );
  assert.equal(template.adaptive, null);
  assert.equal(template.version, 1);
});

test('defaultLoop() includes adaptive: null and preserves version=1', () => {
  const loop = defaultLoop();
  assert.equal(Object.prototype.hasOwnProperty.call(loop, 'adaptive'), true);
  assert.equal(loop.adaptive, null);
  assert.equal(loop.version, 1);
  // Existing fields remain intact (surgical change).
  assert.equal(loop.loop_state, 'idle');
  assert.equal(loop.loop_mode, 'ultrawork');
  assert.deepEqual(loop.goals, []);
});

test('adversarial: malformed snapshots are rejected by validateAdaptiveSnapshot', () => {
  // Empty object — missing all 14 fields.
  assert.equal(validateAdaptiveSnapshot({}), false);
  // Missing exactly one field.
  const missingOne = validSnapshot();
  delete missingOne.last_resolution;
  assert.equal(validateAdaptiveSnapshot(missingOne), false);
  // Wrong types.
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ mode: 42 })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ stages: 'implement' })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ responsibilities: 'planning' })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ capabilities: 'text-search' })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ approval_required: 'no' })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ reasons: 'just because' })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ escalation_count: -1 })), false);
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ escalation_count: 1.5 })), false);
  assert.equal(
    validateAdaptiveSnapshot(validSnapshot({ escalation_history: [{}, 'not-object'] })),
    false,
  );
  // not_selected missing capabilities array.
  assert.equal(
    validateAdaptiveSnapshot(validSnapshot({ not_selected: { stages: [] } })),
    false,
  );
  // last_resolution wrong type.
  assert.equal(
    validateAdaptiveSnapshot(validSnapshot({ last_resolution: 'string' })),
    false,
  );
  // single_writer wrong value.
  assert.equal(
    validateAdaptiveSnapshot(validSnapshot({ single_writer: 'agent' })),
    false,
  );
  // Invalid mode enum.
  assert.equal(validateAdaptiveSnapshot(validSnapshot({ mode: 'ultra' })), false);
  // Null and non-object inputs.
  assert.equal(validateAdaptiveSnapshot(null), false);
  assert.equal(validateAdaptiveSnapshot(undefined), false);
  assert.equal(validateAdaptiveSnapshot([]), false);
  assert.equal(validateAdaptiveSnapshot('string'), false);
  assert.equal(validateAdaptiveSnapshot(42), false);
});

test('writeAdaptiveSnapshot throws on invalid snapshot without mutating loopState', () => {
  const loopState = { adaptive: null };
  assert.throws(
    () => writeAdaptiveSnapshot(loopState, { mode: 'bad' }),
    /Section 11 shape/,
  );
  assert.equal(loopState.adaptive, null);
  assert.throws(
    () => writeAdaptiveSnapshot(null, validSnapshot()),
    /loopState/,
  );
  assert.throws(
    () => writeAdaptiveSnapshot('string', validSnapshot()),
    /loopState/,
  );
});

test('REQUIRED_FIELDS lists exactly the 14 Section 11 fields', () => {
  assert.equal(REQUIRED_FIELDS.length, 14);
  const expected = [
    'mode', 'stages', 'responsibilities', 'capabilities', 'not_selected',
    'approval_required', 'reasons', 'started_at', 'updated_at', 'completed_at',
    'escalation_count', 'escalation_history', 'last_resolution', 'single_writer',
  ];
  for (const field of expected) {
    assert.equal(REQUIRED_FIELDS.includes(field), true, `missing ${field}`);
  }
});
