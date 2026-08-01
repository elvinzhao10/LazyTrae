'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { validateAdaptiveSnapshot } = require('../src/lib/adaptive-snapshot');

const FIXTURES_DIR = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
const FIXTURES = MANIFEST.fixtures.map((entry) => JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, entry.file), 'utf8'),
));

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

test('all ten fixtures produce the contract machine decision and canonical snapshot', () => {
  assert.equal(FIXTURES.length, 10);
  const fields = [
    'mode', 'stages', 'responsibilities', 'capabilities', 'approval_required',
    'approval_classes', 'verification_level', 'allowed_substitutions', 'authority_boundary',
    'ownership', 'not_selected',
  ];
  const snapshotFields = [
    'approval', 'blocker', 'capabilityClasses', 'capabilitySubstitutions', 'currentStage',
    'decisionId', 'escalationCount', 'escalationHistory', 'hostFingerprint', 'mode',
    'responsibilities', 'revisionFingerprint', 'scopeFingerprint',
    'stages', 'verificationLevel', 'version',
  ];
  const actualRisks = [];
  for (const fixture of FIXTURES) {
    const expectedSnapshot = fixture.expected_snapshot.adaptive;
    const identity = {
      decisionId: expectedSnapshot.decisionId,
      hostFingerprint: expectedSnapshot.hostFingerprint,
      revisionFingerprint: expectedSnapshot.revisionFingerprint,
      scopeFingerprint: expectedSnapshot.scopeFingerprint,
    };
    const decision = classifyAdaptiveDecision(fixture.request, {
      ...fixture.context,
      ...identity,
    });
    for (const field of fields) {
      assert.deepEqual(
        decision[field],
        fixture.expected_decision[field],
        `${fixture.id}: ${field}`,
      );
    }
    assert.deepEqual(
      Object.keys(decision.user_explanation).sort(),
      ['approval', 'evidence', 'not_selected', 'selected'],
      `${fixture.id}: user explanation shape`,
    );
    for (const value of Object.values(decision.user_explanation)) {
      assert.equal(typeof value, 'string', `${fixture.id}: user explanation value type`);
      assert.ok(value.length > 0, `${fixture.id}: user explanation value presence`);
    }
    assert.ok(decision.reasons.length > 0, `${fixture.id}: decision reasons presence`);
    assert.ok(decision.reasons.every((reason) => typeof reason === 'string'), `${fixture.id}: decision reasons shape`);
    for (const field of snapshotFields) {
      assert.deepEqual(
        decision.snapshot[field],
        expectedSnapshot[field],
        `${fixture.id}: snapshot.${field}`,
      );
    }
    assert.equal(typeof decision.snapshot.nextAction, 'string', `${fixture.id}: snapshot.nextAction type`);
    assert.ok(decision.snapshot.nextAction.length > 0, `${fixture.id}: snapshot.nextAction presence`);
    assert.ok(decision.snapshot.reasons.length > 0, `${fixture.id}: snapshot.reasons presence`);
    assert.ok(decision.snapshot.reasons.every((reason) => typeof reason === 'string'), `${fixture.id}: snapshot.reasons shape`);
    actualRisks.push([fixture.id, decision.snapshot.risk]);
    assert.equal(decision.snapshot.requestDigest, digest(fixture.request), fixture.id);
    assert.equal(validateAdaptiveSnapshot(decision.snapshot), true, fixture.id);
  }
  assert.deepEqual(
    actualRisks,
    FIXTURES.map((fixture) => [fixture.id, fixture.expected_snapshot.adaptive.risk]),
  );
});

test('explicit workflows remain authoritative without silently adding implementation', () => {
  const planOnly = classifyAdaptiveDecision('Create a plan only; do not implement.', {
    named_workflow_class: 'plan-only',
  });
  const direct = classifyAdaptiveDecision('Do this directly; do not create a plan.');
  const review = classifyAdaptiveDecision('Run an independent review workflow.');
  const loop = classifyAdaptiveDecision('Use lazy-ulw-loop for this migration.');
  assert.deepEqual(planOnly.stages, ['understand', 'plan']);
  assert.equal(planOnly.verification_level, 'targeted');
  assert.equal(direct.mode, 'direct');
  assert.equal(direct.stages.includes('plan'), false);
  assert.equal(review.mode, 'orchestrated');
  assert.equal(loop.mode, 'long-horizon');
});

test('named workflow recognition ignores negated and incidental mentions', () => {
  // Given/When: one prompt replaces a negated workflow and another only discusses it.
  const replacement = classifyAdaptiveDecision('Do not use lazy-ulw-plan, use lazy-ulw-loop instead.');
  const incidental = classifyAdaptiveDecision(
    'Discuss lazy-ulw-plan as an example, then fix directly.',
  );

  // Then: only the affirmative named request is authoritative.
  assert.equal(replacement.explicitWorkflow, 'lazy-ulw-loop');
  assert.equal(replacement.mode, 'long-horizon');
  assert.deepEqual(replacement.stages, ['understand', 'plan', 'implement', 'verify', 'continue']);
  assert.equal(incidental.explicitWorkflow, null);
  assert.equal(incidental.mode, 'direct');
});

test('negated and incidental lazy-ulw-loop mentions remain ordinary direct work', () => {
  const negated = classifyAdaptiveDecision('Do not use lazy-ulw-loop. Fix one typo.');
  const incidental = classifyAdaptiveDecision(
    'Discuss lazy-ulw-loop as an example, then fix one typo.',
  );

  assert.equal(negated.explicitWorkflow, null);
  assert.equal(negated.mode, 'direct');
  assert.equal(incidental.explicitWorkflow, null);
  assert.equal(incidental.mode, 'direct');
});

for (const [workflow, prompt] of [
  [
    'lazy-ulw-plan',
    'Do not, under any circumstances whatsoever, use the lazy-ulw-plan workflow; fix the typo directly.',
  ],
  [
    'lazy-ulw-loop',
    'Never, even if it seems useful, use lazy-ulw-loop. Fix one typo.',
  ],
]) {
  test(`qualified negation does not select ${workflow}`, () => {
    // Given/When: the named workflow follows an unambiguously negated qualifier.
    const decision = classifyAdaptiveDecision(prompt);

    // Then: the request stays ordinary direct work.
    assert.equal(decision.explicitWorkflow, null);
    assert.equal(decision.mode, 'direct');
    assert.deepEqual(decision.stages, ['implement', 'verify']);
  });
}

test('review responsibilities are automatic while requested action classes require approval', () => {
  const security = classifyAdaptiveDecision('Change security authorization logic.');
  const release = classifyAdaptiveDecision('Prepare release artifacts without publishing.', {
    risk_signals: ['release-change'],
  });
  const action = classifyAdaptiveDecision('Install a provider and upload repository data.');
  assert.equal(security.approval_required, false);
  assert.equal(security.responsibilities.includes('security-review'), true);
  assert.equal(release.approval_required, false);
  assert.equal(release.responsibilities.includes('release-review'), true);
  assert.deepEqual(action.approval_classes, ['install-or-download', 'remote-data-egress']);
});

test('real-world scope language selects the lowest sufficient non-direct mode', () => {
  assert.equal(
    classifyAdaptiveDecision('Investigate why test_format_result is failing in the calculator module.').mode,
    'assisted',
  );
  assert.equal(
    classifyAdaptiveDecision('Refactor the calculator module to add input validation for all public functions.').mode,
    'planned',
  );
  assert.equal(
    classifyAdaptiveDecision('Migrate the test suite to pytest-bdd across the next week.').mode,
    'long-horizon',
  );
});

test('automatic escalation is adjacent, bounded at two, then produces a blocker', () => {
  const first = classifyAdaptiveDecision('Fix the failing test.', {
    initial_mode: 'direct',
    scope_revealed_broader: true,
    signals: { verification_failure: true },
  });
  assert.equal(first.mode, 'assisted');
  assert.equal(first.snapshot.escalationCount, 2);
  assert.equal(first.snapshot.blocker, null);
  const next = classifyAdaptiveDecision('Fix the failing test.', {
    priorSnapshot: first.snapshot,
    signals: { verification_failure: true },
  });
  assert.equal(next.snapshot.escalationCount, 2);
  assert.notEqual(next.snapshot.blocker, null);
  assert.equal(next.snapshot.blocker.attemptedApproaches.length > 0, true);
});

test('continuation resumes only when every fingerprint, risk, and approval value matches', () => {
  const prompt = 'Continue the multi-session migration.';
  const identity = {
    revisionFingerprint: { status: 'available', digest: digest('revision') },
    scopeFingerprint: digest('scope'),
    hostFingerprint: digest('host'),
  };
  const first = classifyAdaptiveDecision(prompt, { ...identity, decisionId: 'decision-stable' });
  first.snapshot.currentStage = 'verify';
  const resumed = classifyAdaptiveDecision(prompt, { ...identity, priorSnapshot: first.snapshot });
  const stale = classifyAdaptiveDecision(prompt, {
    ...identity,
    priorSnapshot: first.snapshot,
    revisionFingerprint: { status: 'available', digest: digest('changed') },
  });
  assert.equal(resumed.snapshot.decisionId, 'decision-stable');
  assert.equal(resumed.snapshot.currentStage, 'verify');
  assert.notEqual(stale.snapshot.decisionId, 'decision-stable');
  assert.notDeepEqual(stale.snapshot.revisionFingerprint, resumed.snapshot.revisionFingerprint);
  assert.equal(stale.snapshot.currentStage, 'understand');
  assert.ok(stale.reasons.length > 0);
});
