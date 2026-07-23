'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fixture = require('../contracts/fixtures/v103/07-explicit-workflow-override.json');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');

const MACHINE_DECISION_FIELDS = [
  'mode', 'stages', 'responsibilities', 'capabilities', 'approval_required',
  'approval_classes', 'verification_level', 'allowed_substitutions',
  'authority_boundary', 'ownership', 'not_selected',
];

test('W4.1 plan-only fixture remains authoritative with a structured plan boundary', () => {
  const decision = classifyAdaptiveDecision(fixture.request, fixture.context);
  for (const field of MACHINE_DECISION_FIELDS) {
    assert.deepEqual(decision[field], fixture.expected_decision[field], field);
  }
  assert.equal(decision.explicitWorkflow, 'lazy-ulw-plan');
  assert.equal(decision.stages.includes('implement'), false);
  assert.deepEqual(decision.snapshot.approval, {
    requiredClasses: [],
    status: 'not-required',
  });
  assert.equal(typeof decision.snapshot.nextAction, 'string');
  assert.ok(decision.snapshot.nextAction.length > 0);
  assert.ok(decision.reasons.length > 0);
  assert.ok(decision.reasons.every((reason) => typeof reason === 'string'));
  assert.deepEqual(
    Object.keys(decision.user_explanation).sort(),
    ['approval', 'evidence', 'not_selected', 'selected'],
  );
});

test('W4.1 explicit direct, review, and long-horizon workflows are not substituted', () => {
  const direct = classifyAdaptiveDecision('Do this directly; do not create a plan.');
  const review = classifyAdaptiveDecision('Use lazy-review-work for this review.');
  const loop = classifyAdaptiveDecision('Use lazy-ulw-loop for this migration.');
  assert.equal(direct.mode, 'direct');
  assert.equal(direct.stages.includes('plan'), false);
  assert.equal(review.mode, 'orchestrated');
  assert.equal(review.stages.includes('review'), true);
  assert.equal(loop.mode, 'long-horizon');
  assert.equal(loop.stages.includes('continue'), true);
});

test('W4.1 explicit plan-only authority never grants execution authority', () => {
  const decision = classifyAdaptiveDecision('Create a plan only.', {
    named_workflow_class: 'plan-only',
    authoritative_instruction: true,
  });
  assert.deepEqual(decision.authority_boundary.automatic, [
    'existing-capability-use',
    'read-only-local-inspection',
  ]);
  assert.equal(decision.responsibilities.includes('implementation'), false);
});
