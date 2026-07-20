// W2.5 adaptive-integration tests for the v1.0.3 Adaptive Harness release.
//
// Purpose: cross-module integration tests exercising the full adaptive flow:
//   detector (classifyAdaptiveDecision) → mapping (mapAdaptiveDecisionToSurfaces)
//   → snapshot (writeAdaptiveSnapshot / readAdaptiveSnapshot).
//
// Tests:
//   1. Full flow for each of the 10 fixtures (detector → mapping → snapshot round-trip)
//   2. Round-trip state persistence (write → serialize → parse → read)
//   3. v1.0.2 backward compatibility (state without adaptive field loads cleanly)
//   4. Schema validation (defaultLoop + adaptive block validate against active-loop.schema.json)
//   5. Adversarial — concurrent writes (second overwrites first; updated_at advances)
//   6. Adversarial — malformed inputs (each call handles gracefully or throws specific error)
//
// Test 7 (explanation integration) is deferred until W2.4 lands adaptive-explanation.js;
// the file does not yet exist at the time W2.5 was executed.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { mapAdaptiveDecisionToSurfaces } = require('../src/lib/adaptive-mapping');
const {
  validateAdaptiveSnapshot,
  readAdaptiveSnapshot,
  writeAdaptiveSnapshot,
} = require('../src/lib/adaptive-snapshot');
const { defaultLoop } = require('../src/lib/loop-store');

const FIXTURES_DIR = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103');
const SCHEMA_PATH = path.resolve(
  __dirname, '..', '..', '..', '.lazytrae', 'schemas', 'active-loop.schema.json',
);

const HAS_AJV = (() => {
  try {
    require('ajv');
    require('ajv-formats');
    return true;
  } catch (_) { return false; }
})();

function loadFixtures() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
  return manifest.fixtures.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f.file), 'utf8'));
    return { file: f.file, sha: f.sha256, data };
  });
}

const FIXTURES = loadFixtures();

// Convert an adaptive decision (output of classifyAdaptiveDecision) into a
// loop-state adaptive block that satisfies the 14-field Section 11 schema
// (adaptive-snapshot.js REQUIRED_FIELDS). The decision carries its own
// `snapshot` field with the portable contract shape (decisionId, requestDigest,
// capabilityClasses, escalationCount, ...), which is intentionally distinct
// from the loop-state persistence shape. A real orchestrator performs this
// conversion when persisting a decision to loop state; the integration test
// does the same to exercise the full detector → mapping → snapshot flow.
function decisionToLoopAdaptiveBlock(decision) {
  const s = decision.snapshot;
  return {
    mode: decision.mode,
    stages: decision.stages,
    responsibilities: decision.responsibilities,
    capabilities: decision.capabilities,
    not_selected: {
      stages: decision.not_selected.stages,
      capabilities: decision.not_selected.capabilities,
    },
    approval_required: decision.approval_required,
    reasons: decision.reasons,
    started_at: null,
    updated_at: null,
    completed_at: null,
    escalation_count: s.escalationCount,
    escalation_history: [],
    last_resolution: decision.runtime_resolution,
    single_writer: 'orchestrator',
  };
}

// Test 1: Full flow for each of the 10 fixtures.
test('Test 1: full adaptive flow for each fixture (detector → mapping → snapshot round-trip)', () => {
  assert.equal(FIXTURES.length, 10, 'expected 10 fixtures in manifest');
  for (const f of FIXTURES) {
    const fx = f.data;
    // Step 1+2: classify
    const decision = classifyAdaptiveDecision(fx.request, fx.context);
    // Step 3: map
    const mapping = mapAdaptiveDecisionToSurfaces(decision);
    // Step 4: write snapshot (convert decision to a valid loop-state adaptive block)
    const loopState = defaultLoop();
    const adaptiveBlock = decisionToLoopAdaptiveBlock(decision);
    const written = writeAdaptiveSnapshot(loopState, adaptiveBlock);
    // Step 5: read back
    const read = readAdaptiveSnapshot(loopState);
    // Assertion 6: mode matches expected
    assert.equal(decision.mode, fx.expected_decision.mode, `${fx.id}: mode mismatch`);
    // Assertion 7: workflow_surfaces non-empty (or empty for direct mode)
    if (decision.mode === 'direct') {
      assert.deepEqual(mapping.workflow_surfaces, [],
        `${fx.id}: direct mode must have empty workflow_surfaces`);
    } else {
      assert.ok(mapping.workflow_surfaces.length > 0,
        `${fx.id}: ${decision.mode} mode must have non-empty workflow_surfaces`);
    }
    // Assertion 8: snapshot non-null after write
    assert.notEqual(written, null, `${fx.id}: written snapshot must not be null`);
    assert.equal(validateAdaptiveSnapshot(written), true,
      `${fx.id}: written snapshot must be valid`);
    // Assertion 9: read snapshot matches written snapshot
    assert.deepEqual(read, written, `${fx.id}: read snapshot must match written`);
    assert.equal(read.mode, decision.mode, `${fx.id}: read snapshot mode`);
    assert.equal(read.single_writer, 'orchestrator', `${fx.id}: single_writer preserved`);
  }
});

// Test 2: Round-trip state persistence (simulates saveLoop → loadLoop).
test('Test 2: round-trip state persistence (serialize → parse → read)', () => {
  const loopState = defaultLoop();
  const decision = classifyAdaptiveDecision('Fix the typo in errors.js', {});
  const adaptiveBlock = decisionToLoopAdaptiveBlock(decision);
  const written = writeAdaptiveSnapshot(loopState, adaptiveBlock);

  // Simulate saveLoop → loadLoop round-trip via JSON serialization.
  const serialized = JSON.stringify(loopState);
  const parsed = JSON.parse(serialized);
  const read = readAdaptiveSnapshot(parsed);

  assert.notEqual(read, null, 'snapshot must survive round-trip');
  assert.equal(read.mode, decision.mode, 'mode survives round-trip');
  assert.equal(read.single_writer, 'orchestrator', 'single_writer survives round-trip');
  assert.deepEqual(read.stages, decision.stages, 'stages survive round-trip');
  assert.deepEqual(read.capabilities, decision.capabilities, 'capabilities survive round-trip');
  assert.deepEqual(read.not_selected.stages, decision.not_selected.stages,
    'not_selected.stages survive round-trip');
  assert.equal(validateAdaptiveSnapshot(read), true, 'round-trip snapshot must still be valid');
  assert.deepEqual(read, written, 'round-trip read must equal originally written snapshot');
});

// Test 3: v1.0.2 backward compatibility — state without `adaptive` field loads cleanly.
test('Test 3: v1.0.2 state (without adaptive field) loads without crash', () => {
  const v102State = {
    version: 1,
    run_id: null,
    loop_state: 'idle',
    loop_mode: 'ultrawork',
    goals: [],
    created_at: '2026-07-09T00:00:00Z',
    updated_at: '2026-07-09T00:00:00Z',
  };
  // readAdaptiveSnapshot returns null for v1.0.2 state — no crash, no exception.
  const snapshot = readAdaptiveSnapshot(v102State);
  assert.equal(snapshot, null, 'v1.0.2 state has no adaptive block');
  // validateAdaptiveSnapshot(null) returns false gracefully (no throw).
  assert.equal(validateAdaptiveSnapshot(null), false,
    'validate(null) returns false without throwing');
  // The v1.0.2 state object is not mutated by read attempts.
  assert.equal(Object.prototype.hasOwnProperty.call(v102State, 'adaptive'), false,
    'v1.0.2 state remains without adaptive field after read');
});

// Test 4: Schema validation against active-loop.schema.json.
test('Test 4: active-loop schema accepts defaultLoop and defaultLoop+adaptive', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(schema.properties, 'adaptive'), true,
    'schema must declare the adaptive property');
  assert.equal(schema.required.includes('adaptive'), false,
    'adaptive must remain optional (additive extension)');
  assert.deepEqual(schema.properties.adaptive.type, ['object', 'null'],
    'adaptive type must be [object, null]');

  if (!HAS_AJV) {
    // Without ajv available, the structural assertions above are sufficient.
    return;
  }
  const Ajv = require('ajv');
  const addFormats = require('ajv-formats');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  // defaultLoop() should pass.
  const defLoop = defaultLoop();
  let ok = validate(defLoop);
  assert.equal(ok, true,
    `defaultLoop() must validate: ${JSON.stringify(validate.errors || [])}`);

  // defaultLoop() with an adaptive block should also pass.
  const decision = classifyAdaptiveDecision('Fix typo in errors.js', {});
  const adaptiveBlock = decisionToLoopAdaptiveBlock(decision);
  writeAdaptiveSnapshot(defLoop, adaptiveBlock);
  ok = validate(defLoop);
  assert.equal(ok, true,
    `defaultLoop()+adaptive must validate: ${JSON.stringify(validate.errors || [])}`);

  // State missing required fields should fail.
  const invalidState = { version: 1 };
  ok = validate(invalidState);
  assert.equal(ok, false, 'state missing required fields must fail validation');
});

// Test 5: Adversarial — concurrent writes (no lock at this layer; lock is at state-access.js).
test('Test 5: concurrent writes — second overwrites first; updated_at advances', async () => {
  const loopState = defaultLoop();
  const decision1 = classifyAdaptiveDecision('Fix typo in errors.js', {});
  const block1 = decisionToLoopAdaptiveBlock(decision1);
  block1.mode = 'direct';

  const written1 = writeAdaptiveSnapshot(loopState, block1);
  const ts1 = Date.parse(written1.updated_at);

  // Delay to ensure the ISO timestamp differs (millisecond precision).
  await new Promise((r) => setTimeout(r, 50));

  const decision2 = classifyAdaptiveDecision('Build a feature with unresolved design choices',
    { scope: 'broad', acceptance_criteria: 'incomplete' });
  const block2 = decisionToLoopAdaptiveBlock(decision2);
  block2.mode = 'planned';

  const written2 = writeAdaptiveSnapshot(loopState, block2);
  const ts2 = Date.parse(written2.updated_at);

  // Second write overwrites the first (no lock at this layer).
  assert.ok(ts2 > ts1, 'updated_at must advance after the second write');
  assert.equal(loopState.adaptive, written2,
    'loopState.adaptive must point at the second write');
  assert.equal(readAdaptiveSnapshot(loopState).mode, 'planned',
    'second write (planned) must overwrite the first (direct)');
  assert.equal(validateAdaptiveSnapshot(written2), true,
    'second write must still produce a valid snapshot');
});

// Test 6: Adversarial — malformed inputs (each call handles gracefully or throws specific error).
test('Test 6: malformed inputs handled gracefully or throw specific errors', () => {
  // classifyAdaptiveDecision with null request — must not crash; produces a valid mode.
  const r1 = classifyAdaptiveDecision(null, {});
  assert.ok(['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'].includes(r1.mode),
    'null request must produce a valid mode');

  // classifyAdaptiveDecision with empty string — must not crash; produces a valid mode.
  const r2 = classifyAdaptiveDecision('', {});
  assert.ok(['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'].includes(r2.mode),
    'empty request must produce a valid mode');

  // mapAdaptiveDecisionToSurfaces with null throws ADAPTIVE_MAPPING_INVALID_DECISION.
  assert.throws(() => mapAdaptiveDecisionToSurfaces(null),
    /ADAPTIVE_MAPPING_INVALID_DECISION/);

  // mapAdaptiveDecisionToSurfaces with {} throws (missing mode).
  assert.throws(() => mapAdaptiveDecisionToSurfaces({}),
    /ADAPTIVE_MAPPING_INVALID_DECISION/);

  // writeAdaptiveSnapshot with null snapshot throws a specific error (no crash, no mutation).
  const loopState = defaultLoop();
  assert.throws(() => writeAdaptiveSnapshot(loopState, null),
    /Section 11 shape/);
  assert.equal(loopState.adaptive, null,
    'failed write must not mutate loopState.adaptive');

  // Passing decision.snapshot directly to writeAdaptiveSnapshot throws because
  // the portable contract snapshot shape (decisionId, requestDigest, capabilityClasses,
  // escalationCount, ...) is intentionally distinct from the loop-state persistence
  // shape (capabilities, not_selected, approval_required, escalation_count, ...).
  // A real orchestrator converts between the two; this test pins the defensive behavior.
  const decision = classifyAdaptiveDecision('Fix typo in errors.js', {});
  assert.throws(() => writeAdaptiveSnapshot(defaultLoop(), decision.snapshot),
    /Section 11 shape/);
});
