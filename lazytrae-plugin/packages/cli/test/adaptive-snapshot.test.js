'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const {
  REQUIRED_FIELDS,
  clearAdaptiveSnapshot,
  readAdaptiveSnapshot,
  validateAdaptiveSnapshot,
  writeAdaptiveSnapshot,
} = require('../src/lib/adaptive-snapshot');
const { defaultLoop } = require('../src/lib/loop-store');

function validSnapshot() {
  return classifyAdaptiveDecision('Fix one typo in one file.').snapshot;
}

test('canonical snapshot accepts exactly the portable camelCase fields', () => {
  const snapshot = validSnapshot();
  assert.equal(validateAdaptiveSnapshot(snapshot), true);
  assert.deepEqual(Object.keys(snapshot).sort(), [...REQUIRED_FIELDS].sort());
  assert.deepEqual([...REQUIRED_FIELDS].sort(), [
    'approval', 'blocker', 'capabilityClasses', 'capabilitySubstitutions', 'currentStage',
    'decisionId', 'escalationCount', 'escalationHistory', 'hostFingerprint', 'mode',
    'nextAction', 'reasons', 'requestDigest', 'responsibilities', 'revisionFingerprint',
    'risk', 'scopeFingerprint', 'stages', 'verificationLevel', 'version',
  ].sort());
  assert.equal('single_writer' in snapshot, false);
  assert.equal('updated_at' in snapshot, false);
});

test('write stores an exact clone without a translator or timestamp mutation', () => {
  const loop = defaultLoop();
  const snapshot = validSnapshot();
  const written = writeAdaptiveSnapshot(loop, snapshot);
  assert.deepEqual(written, snapshot);
  assert.notEqual(written, snapshot);
  snapshot.stages.push('mutated-after-write');
  assert.equal(loop.adaptive.stages.includes('mutated-after-write'), false);
});

test('read and clear preserve backward-compatible optional state behavior', () => {
  assert.equal(readAdaptiveSnapshot(null), null);
  assert.equal(readAdaptiveSnapshot({ version: 1 }), null);
  assert.equal(readAdaptiveSnapshot({ adaptive: null }), null);
  const loop = defaultLoop();
  assert.equal(loop.adaptive, null);
  writeAdaptiveSnapshot(loop, validSnapshot());
  assert.notEqual(readAdaptiveSnapshot(loop), null);
  clearAdaptiveSnapshot(loop);
  assert.equal(loop.adaptive, null);
});

test('invalid, snake_case, extra-field, and malformed fingerprints fail closed', () => {
  const base = validSnapshot();
  const cases = [
    null,
    { ...base, extra: true },
    { ...base, escalation_count: 0 },
    { ...base, requestDigest: 'slug-not-a-hash' },
    { ...base, revisionFingerprint: { status: 'available', digest: null } },
    { ...base, escalationCount: 3 },
    { ...base, currentStage: 'not-selected' },
  ];
  for (const value of cases) assert.equal(validateAdaptiveSnapshot(value), false);
  const loop = defaultLoop();
  assert.throws(() => writeAdaptiveSnapshot(loop, cases[1]), /canonical v1 shape/);
  assert.equal(loop.adaptive, null);
});

test('schema enums reject unknown capabilities, responsibilities, and stages', () => {
  const capability = validSnapshot();
  capability.capabilityClasses = ['bogus-capability'];
  const responsibility = validSnapshot();
  responsibility.responsibilities = ['bogus-responsibility'];
  const stage = validSnapshot();
  stage.stages = ['bogus-stage'];
  stage.currentStage = 'bogus-stage';
  for (const snapshot of [capability, responsibility, stage]) {
    assert.equal(validateAdaptiveSnapshot(snapshot), false);
  }
});

test('nested schema enums and unknown properties fail closed', () => {
  const approval = validSnapshot();
  approval.approval = {
    requiredClasses: ['bogus-approval'],
    status: 'pending',
  };
  const substitution = validSnapshot();
  substitution.capabilitySubstitutions = [{
    allowedSubstitutionClasses: ['text-search'],
    evidenceDowngrade: 'bogus-downgrade',
    explanation: 'Use text search with compensating verification.',
    requiredClass: 'semantic-navigation',
  }];
  const transition = validSnapshot();
  transition.escalationCount = 1;
  transition.escalationHistory = [{
    fromMode: 'direct',
    sequence: 1,
    stageAdded: 'bogus-stage',
    toMode: 'assisted',
    trigger: 'bogus-trigger',
  }];
  const extraApproval = validSnapshot();
  extraApproval.approval = { ...extraApproval.approval, extra: true };
  const extraRevision = validSnapshot();
  extraRevision.revisionFingerprint = { ...extraRevision.revisionFingerprint, extra: true };
  for (const snapshot of [approval, substitution, transition, extraApproval, extraRevision]) {
    assert.equal(validateAdaptiveSnapshot(snapshot), false);
  }
});

test('blocker accepts only null or the exact canonical camelCase record', () => {
  const canonical = {
    attemptedApproaches: ['debugged'],
    currentEvidence: 'still failing',
    nextRequiredDecision: 'choose an approach',
    reproducedFailure: 'failure reproduced',
    unresolvedDecision: 'external input required',
  };
  for (const blocker of [null, canonical]) {
    assert.equal(validateAdaptiveSnapshot({ ...validSnapshot(), blocker }), true);
  }
  const snakeCase = {
    attempted_approaches: ['debugged'],
    current_evidence: 'still failing',
    exact_next_user_decision: 'choose an approach',
    reproduced_failure: 'failure reproduced',
    unresolved_decision: 'external input required',
  };
  for (const blocker of ['blocked: scope too broad', snakeCase, { ...canonical, extra: true }]) {
    assert.equal(validateAdaptiveSnapshot({ ...validSnapshot(), blocker }), false);
  }
});

test('portable text, decision identifiers, and nullable stage additions match the schema', () => {
  const nonportable = validSnapshot();
  nonportable.reasons = ['.lazytrae/state should be reused'];
  const identifier = validSnapshot();
  identifier.decisionId = 'INVALID_ID';
  const nullableStage = validSnapshot();
  nullableStage.escalationCount = 1;
  nullableStage.escalationHistory = [{
    fromMode: 'direct',
    sequence: 1,
    stageAdded: null,
    toMode: 'assisted',
    trigger: 'broader-scope-revealed',
  }];
  assert.equal(validateAdaptiveSnapshot(nonportable), false);
  assert.equal(validateAdaptiveSnapshot(identifier), false);
  assert.equal(validateAdaptiveSnapshot(nullableStage), true);
});
