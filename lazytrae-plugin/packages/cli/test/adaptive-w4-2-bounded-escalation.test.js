'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fixture = require('../contracts/fixtures/v103/09-escalation-bound.json');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { validateAdaptiveSnapshot } = require('../src/lib/adaptive-snapshot');

test('W4.2 verification failure then broader scope consumes two adjacent transitions', () => {
  const decision = classifyAdaptiveDecision(fixture.request, fixture.context);
  assert.equal(decision.mode, 'assisted');
  assert.equal(decision.snapshot.escalationCount, 2);
  assert.deepEqual(decision.snapshot.escalationHistory.map((entry) => entry.trigger), [
    'verification-failure',
    'broader-scope-revealed',
  ]);
  assert.equal(decision.snapshot.escalationHistory[1].fromMode, 'direct');
  assert.equal(decision.snapshot.escalationHistory[1].toMode, 'assisted');
  assert.equal(decision.snapshot.blocker, null);
});

test('W4.2 a further trigger cannot deepen mode and yields a complete blocker', () => {
  const bounded = classifyAdaptiveDecision(fixture.request, fixture.context);
  const stopped = classifyAdaptiveDecision(fixture.request, {
    priorSnapshot: bounded.snapshot,
    signals: { verification_failure: true },
  });
  assert.equal(stopped.snapshot.escalationCount, 2);
  assert.notEqual(stopped.snapshot.blocker, null);
  assert.deepEqual(Object.keys(stopped.snapshot.blocker).sort(), [
    'attemptedApproaches',
    'currentEvidence',
    'nextRequiredDecision',
    'reproducedFailure',
    'unresolvedDecision',
  ]);
  assert.equal(validateAdaptiveSnapshot(stopped.snapshot), true);
});

test('W4.2 risk changes select review responsibilities without conflating approval', () => {
  const security = classifyAdaptiveDecision('Change authorization behavior.', {
    risk_signals: ['security-sensitive'],
  });
  const release = classifyAdaptiveDecision('Prepare release artifacts without publishing.', {
    risk_signals: ['release-change'],
  });
  assert.equal(security.mode, 'orchestrated');
  assert.equal(security.responsibilities.includes('security-review'), true);
  assert.equal(security.approval_required, false);
  assert.equal(release.mode, 'orchestrated');
  assert.equal(release.responsibilities.includes('release-review'), true);
  assert.equal(release.approval_required, false);
});

test('W4.2 requested publication and durable migration take their distinct boundaries', () => {
  const publish = classifyAdaptiveDecision('Publish these release artifacts.');
  const migration = classifyAdaptiveDecision('Migrate this over three sessions.', {
    session_scope: 'multi-session',
    checkpoint_requirement: 'durable',
  });
  assert.deepEqual(publish.approval_classes, ['account-marketplace-or-publish-mutation']);
  assert.equal(migration.mode, 'long-horizon');
  assert.equal(migration.stages.includes('continue'), true);
  assert.equal(migration.authority_boundary.automatic.includes('package-owned-local-state'), true);
});
