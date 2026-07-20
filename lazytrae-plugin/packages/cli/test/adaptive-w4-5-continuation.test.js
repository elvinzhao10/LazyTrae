// W4.5 Continuation integration tests for the v1.0.3 Adaptive Harness.
//
// Purpose: prove plan Section 11 (State rules) behavior:
//   - a compatible snapshot resumes from the saved stage (mode + escalationCount preserved)
//   - an incompatible revision forces reclassification (stale snapshot preserved)
//   - an incompatible request forces a fresh decision from `understand`
//   - a stale snapshot cannot satisfy completion verification
//   - the original snapshot is not mutated invisibly during reclassification
//   - no snapshot and null snapshot both produce fresh decisions
//
// Fixture: contracts/fixtures/v103/06-long-horizon-migration.json (long-horizon).
// No dedicated stale-snapshot fixture exists in v103/; this test synthesizes
// stale snapshots by altering revisionMarker and requestDigest on a valid shape.
//
// Implementation gap: classifyAdaptiveDecision does not yet read context.snapshot
// to implement Section 6 step 2 (compatible continuation). The three
// compatible-resume scenarios are marked test.expectFailure per W4.5 task
// instructions; the gap is documented in the evidence file.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const {
  validateAdaptiveSnapshot,
  readAdaptiveSnapshot,
  writeAdaptiveSnapshot,
} = require('../src/lib/adaptive-snapshot');
const { defaultLoop } = require('../src/lib/loop-store');

const FIXTURE_PATH = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103',
  '06-long-horizon-migration.json');
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

// A valid snake_case snapshot for the persistence-layer tests (matches the
// shape accepted by writeAdaptiveSnapshot / validateAdaptiveSnapshot).
function validStoredSnapshot(overrides = {}) {
  return {
    mode: 'long-horizon',
    stages: ['understand', 'plan', 'implement', 'verify', 'continue'],
    responsibilities: ['continuity', 'exploration', 'implementation', 'planning', 'verification'],
    capabilities: ['text-search', 'structural-search', 'semantic-navigation',
      'architecture-context', 'documentation', 'execution', 'task-state', 'outcome-verification'],
    not_selected: { stages: ['debug', 'review'], capabilities: [] },
    approval_required: false,
    reasons: ['multi-session work explicitly required'],
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

// A valid camelCase Section 11 snapshot embedded in classifier context.
function contextSnapshot(currentStage, escalationCount, mode) {
  return {
    version: 1,
    decisionId: 'prior-session-decision',
    requestDigest: 'sha256:placeholder',
    mode: mode || 'long-horizon',
    stages: ['understand', 'plan', 'implement', 'verify', 'continue'],
    currentStage: currentStage || 'implement',
    responsibilities: ['continuity', 'exploration', 'implementation', 'planning', 'verification'],
    capabilityClasses: ['text-search', 'structural-search', 'semantic-navigation',
      'architecture-context', 'documentation', 'execution', 'task-state', 'outcome-verification'],
    runtimeResolution: {},
    reasons: ['prior session decision'],
    escalationCount: escalationCount || 0,
    revisionMarker: 'git:HEAD',
    blocker: null,
    nextAction: 'resume from saved stage',
  };
}

// --- Compatible resume scenarios (implementation gap: classifier does not
//     read context.snapshot — marked expectFailure per W4.5 task). ---

test.expectFailure('W4.5 GAP: compatible resume — currentStage resumed from snapshot (long-horizon fixture)', () => {
  const fresh = classifyAdaptiveDecision(FIXTURE.request, FIXTURE.context);
  const snapshot = contextSnapshot('implement', 1, 'long-horizon');
  snapshot.requestDigest = fresh.snapshot.requestDigest;
  snapshot.revisionMarker = fresh.snapshot.revisionMarker;
  const decision = classifyAdaptiveDecision(FIXTURE.request, {
    ...FIXTURE.context,
    snapshot,
  });
  assert.equal(decision.snapshot.currentStage, 'implement',
    'compatible snapshot must resume from saved currentStage (not reset to understand)');
});

test.expectFailure('W4.5 GAP: compatible resume — mode preserved from snapshot', () => {
  const request = 'Fix typo in README.md';
  const fresh = classifyAdaptiveDecision(request, {});
  const snapshot = contextSnapshot('implement', 1, 'long-horizon');
  snapshot.requestDigest = fresh.snapshot.requestDigest;
  snapshot.revisionMarker = fresh.snapshot.revisionMarker;
  const decision = classifyAdaptiveDecision(request, { snapshot });
  assert.equal(decision.mode, 'long-horizon',
    'compatible snapshot must preserve mode (not reclassify to direct)');
});

test.expectFailure('W4.5 GAP: compatible resume — escalationCount carried over from snapshot', () => {
  const request = 'Fix typo in README.md';
  const fresh = classifyAdaptiveDecision(request, {});
  const snapshot = contextSnapshot('implement', 1, 'long-horizon');
  snapshot.requestDigest = fresh.snapshot.requestDigest;
  snapshot.revisionMarker = fresh.snapshot.revisionMarker;
  const decision = classifyAdaptiveDecision(request, { snapshot });
  assert.equal(decision.snapshot.escalationCount, 1,
    'compatible snapshot must carry over escalationCount');
});

// --- Incompatible revision: classifier produces a new decision; original
//     snapshot preserved (not overwritten in-place). ---

test('W4.5: incompatible revision — classifier produces a new decision', () => {
  const request = 'Fix typo in README.md';
  const snapshot = contextSnapshot('implement', 1, 'long-horizon');
  snapshot.revisionMarker = 'git:abc123-prior-session'; // incompatible
  const decision = classifyAdaptiveDecision(request, { snapshot });
  assert.ok(decision && typeof decision.mode === 'string',
    'classifier must produce a new decision regardless of stale snapshot');
  assert.equal(decision.snapshot.revisionMarker, 'git:HEAD',
    'new decision carries a fresh revisionMarker');
});

test('W4.5: incompatible revision — original snapshot preserved (not mutated in-place)', () => {
  const request = 'Fix typo in README.md';
  const snapshot = contextSnapshot('implement', 1, 'long-horizon');
  snapshot.revisionMarker = 'git:abc123-prior-session';
  const before = JSON.parse(JSON.stringify(snapshot));
  classifyAdaptiveDecision(request, { snapshot });
  assert.deepEqual(snapshot, before,
    'classifier must not mutate the original snapshot in-place during reclassification');
});

// --- Incompatible request: fresh decision resets escalationCount. ---

test('W4.5: incompatible request — fresh decision resets escalationCount', () => {
  const request = 'Fix typo in README.md';
  const snapshot = contextSnapshot('implement', 1, 'long-horizon');
  snapshot.requestDigest = 'sha256:completely-different-prior-request';
  snapshot.revisionMarker = 'git:HEAD';
  const decision = classifyAdaptiveDecision(request, { snapshot });
  assert.notEqual(decision.snapshot.requestDigest, snapshot.requestDigest,
    'fresh decision must have a new requestDigest');
  assert.equal(decision.snapshot.escalationCount, 0,
    'fresh decision must reset escalationCount (no carryover from stale snapshot)');
});

// --- Stale snapshot cannot be used as completion evidence. ---

test('W4.5: stale snapshot — structurally valid but classifier produces a new decision', () => {
  const stale = validStoredSnapshot({
    escalation_count: 2,
    completed_at: '2026-07-20T00:00:00Z',
  });
  // Persistence layer validates structure only; cannot detect staleness.
  assert.equal(validateAdaptiveSnapshot(stale), true,
    'stale snapshot may be structurally valid (completion requires reclassification)');
  // Stale snapshot preserved for diagnosis (not deleted).
  const loopState = defaultLoop();
  writeAdaptiveSnapshot(loopState, stale);
  const read = readAdaptiveSnapshot(loopState);
  assert.equal(read.completed_at, '2026-07-20T00:00:00Z',
    'stale snapshot preserved for diagnosis');
  // Classifier produces a fresh decision; does not trust stale snapshot.
  const decision = classifyAdaptiveDecision('Fix typo in README.md', { snapshot: stale });
  assert.equal(decision.snapshot.escalationCount, 0,
    'fresh decision must not carry over stale escalationCount');
});

// --- Old goal not mutated invisibly. ---

test('W4.5: old goal not mutated — mode and stages unchanged after reclassification', () => {
  const request = 'Fix typo in README.md';
  const stale = validStoredSnapshot({
    mode: 'long-horizon',
    stages: ['understand', 'plan', 'implement', 'verify', 'continue'],
    escalation_count: 2,
  });
  const before = JSON.parse(JSON.stringify(stale));
  classifyAdaptiveDecision(request, { snapshot: stale });
  assert.deepEqual(stale, before,
    'old stored snapshot must not be mutated in-place during reclassification');
  // writeAdaptiveSnapshot writes a new object; prior reference unchanged.
  const loopState = defaultLoop();
  writeAdaptiveSnapshot(loopState, validStoredSnapshot({ mode: 'direct' }));
  assert.deepEqual(stale, before,
    'prior snapshot reference is not mutated by a new writeAdaptiveSnapshot call');
});

// --- No snapshot: fresh decision. ---

test('W4.5: no snapshot in context — fresh decision from long-horizon fixture', () => {
  const decision = classifyAdaptiveDecision(FIXTURE.request, FIXTURE.context);
  assert.equal(decision.mode, 'long-horizon',
    'long-horizon fixture produces a fresh long-horizon decision without any prior snapshot');
  assert.equal(decision.snapshot.escalationCount, 0,
    'fresh decision has escalationCount=0');
  assert.equal(decision.snapshot.currentStage, 'understand',
    'fresh decision starts from understand (no resume)');
});

// --- Null snapshot: behavior matches no-snapshot. ---

test('W4.5: null snapshot in context — behavior matches no-snapshot case', () => {
  const withNull = classifyAdaptiveDecision(FIXTURE.request, {
    ...FIXTURE.context,
    snapshot: null,
  });
  const without = classifyAdaptiveDecision(FIXTURE.request, FIXTURE.context);
  assert.equal(withNull.mode, without.mode,
    'null snapshot must behave identically to no snapshot');
  assert.equal(withNull.snapshot.currentStage, without.snapshot.currentStage,
    'null snapshot must produce the same currentStage as no snapshot');
  assert.equal(withNull.snapshot.escalationCount, without.snapshot.escalationCount,
    'null snapshot must produce the same escalationCount as no snapshot');
});
