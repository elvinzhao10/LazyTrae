'use strict';

// W4.1 Explicit Override integration tests for the v1.0.3 Adaptive Harness.
//
// Purpose: prove that explicit user workflow requests remain authoritative
// and are not silently downgraded or replaced by the adaptive classifier.
// Mirrors the LazyBuddy test_lazybuddy_adaptive_w4_1_explicit_override.py
// for behavioral parity per plan Section 6 (resolution order step 1) and
// the 07-explicit-workflow-override.json fixture.
//
// Scenarios covered (equivalent coverage in both repos):
//   1. Fixture regression — 07-explicit-workflow-override.json
//   2. "create a plan only" → planned mode, no implement stage
//   3. "do this directly; do not create a plan" → direct mode, no plan stage
//   4. "run an independent review" → orchestrated mode with review responsibility
//   5. "use lazy-ulw-loop for this" → long-horizon mode
//   6. Negative — explicit lazy-ulw-plan must NOT be downgraded to direct
//   7. Negative — explicit lazy-review-work must NOT be silently replaced
//   8. Authority — explicit selection preserved when boundaries are present

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');

const FIXTURE_PATH = path.join(
  __dirname, '..', 'contracts', 'fixtures', 'v103', '07-explicit-workflow-override.json',
);

const REVIEW_RESPONSIBILITIES = ['quality-review', 'security-review', 'release-review'];

// Fixture regression: the explicit-override fixture must drive the classifier
// to its expected_decision shape. This is the W4.1 acceptance criterion
// "Explicit-override fixture passes in both repos".
test('W4.1 fixture: 07-explicit-workflow-override produces expected planned decision', () => {
  const fx = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const decision = classifyAdaptiveDecision(fx.request, fx.context);

  assert.equal(decision.mode, fx.expected_decision.mode,
    'fixture mode must match expected');
  assert.deepEqual(decision.stages, fx.expected_decision.stages,
    'fixture stages must match expected (no implement stage)');
  assert.equal(decision.stages.includes('implement'), false,
    'plan-only request must not include the implement stage');
  assert.deepEqual(decision.responsibilities, fx.expected_decision.responsibilities,
    'fixture responsibilities must match expected');
  assert.equal(decision.verification_level, fx.expected_decision.verification_level,
    'fixture verification_level must match expected');
  assert.notEqual(decision.mode, 'direct',
    'explicit plan-only request must not be downgraded to direct');
});

// Scenario 1: explicit plan-only request → planned mode, no implement stage.
test('W4.1 scenario 1: "create a plan only" selects planned mode with no implement stage', () => {
  const request = 'Create a plan only — do not implement yet. Use the lazy-ulw-plan workflow and stop after planning.';
  const decision = classifyAdaptiveDecision(request, {
    signals: { explicit_user_workflow: true },
    named_workflow: 'lazy-ulw-plan',
    authoritative_instruction: true,
    verification_scope: 'targeted',
  });

  assert.equal(decision.mode, 'planned',
    'explicit plan-only request must select planned mode');
  assert.ok(decision.stages.includes('plan'),
    'planned mode must include the plan stage');
  assert.equal(decision.stages.includes('implement'), false,
    'plan-only request must NOT include the implement stage');
  assert.notEqual(decision.mode, 'direct',
    'explicit plan-only request must not be downgraded to direct');
});

// Scenario 2: direct instruction → direct mode, no plan stage.
test('W4.1 scenario 2: "do this directly; do not create a plan" selects direct mode with no plan stage', () => {
  const request = 'Do this directly; do not create a plan';
  const decision = classifyAdaptiveDecision(request, {});

  assert.equal(decision.mode, 'direct',
    'direct instruction must select direct mode');
  assert.equal(decision.stages.includes('plan'), false,
    'direct mode must not include the plan stage');
});

// Scenario 3: independent review → orchestrated mode with review responsibility.
test('W4.1 scenario 3: "run an independent review" produces orchestrated mode with review responsibility', () => {
  const request = 'Run an independent review of the security-critical authorization changes';
  const decision = classifyAdaptiveDecision(request, {
    risk_signals: ['security-sensitive', 'authorization-change'],
    scope_signals: ['touches authorization middleware'],
  });

  assert.equal(decision.mode, 'orchestrated',
    'security-sensitive review request must select orchestrated mode');
  const hasReview = decision.responsibilities.some((r) => REVIEW_RESPONSIBILITIES.includes(r));
  assert.ok(hasReview,
    `orchestrated review must include a review responsibility; got ${JSON.stringify(decision.responsibilities)}`);
});

// Scenario 4: explicit long-horizon workflow → long-horizon mode.
test('W4.1 scenario 4: "use lazy-ulw-loop for this" selects long-horizon mode', () => {
  const request = 'Use lazy-ulw-loop for this multi-session migration';
  const decision = classifyAdaptiveDecision(request, {
    session_scope: 'multi-session',
    checkpoint_requirement: 'durable',
  });

  assert.equal(decision.mode, 'long-horizon',
    'lazy-ulw-loop multi-session request must select long-horizon mode');
  assert.ok(decision.stages.includes('continue'),
    'long-horizon mode must include the continue stage');
});

// Negative test 1: classifier must NOT silently downgrade an explicit
// lazy-ulw-plan request to direct mode.
test('W4.1 negative 1: explicit lazy-ulw-plan is not downgraded to direct mode', () => {
  const request = 'Use lazy-ulw-plan for this small one-file typo fix';
  // Even with a context that would normally select direct mode (small, clear,
  // low-risk), the explicit lazy-ulw-plan pattern must remain authoritative.
  const decision = classifyAdaptiveDecision(request, {
    scope: 'bounded',
    file_count: 1,
  });

  assert.equal(decision.mode, 'planned',
    'explicit lazy-ulw-plan must not be downgraded');
  assert.notEqual(decision.mode, 'direct',
    'explicit lazy-ulw-plan must not silently become direct');
  assert.ok(decision.stages.includes('plan'),
    'planned mode must include the plan stage');
  assert.equal(decision.stages.includes('implement'), false,
    'plan-only override must not include the implement stage');
});

// Negative test 2: classifier must NOT silently replace an explicit
// lazy-review-work request with an unrelated workflow (e.g., direct mode
// ignoring the review requirement).
test('W4.1 negative 2: explicit lazy-review-work is not silently replaced with an unrelated workflow', () => {
  const request = 'Run lazy-review-work on the recent authorization changes';
  // With security risk context, the classifier must produce a review-responsibility
  // decision rather than silently defaulting to direct mode (which would drop the review).
  const decision = classifyAdaptiveDecision(request, {
    risk_signals: ['security-sensitive', 'authorization-change'],
  });

  assert.notEqual(decision.mode, 'direct',
    'review request must not be silently replaced with direct mode');
  const hasReview = decision.responsibilities.some((r) => REVIEW_RESPONSIBILITIES.includes(r));
  assert.ok(hasReview,
    'review request must include a review responsibility');
});

// Authority test: classifier may add approval/verification boundaries to
// explicit requests, but must not REMOVE the explicit selection.
test('W4.1 authority: classifier preserves explicit selection when boundaries are present', () => {
  const request = 'Create a plan only — do not implement. Use lazy-ulw-plan.';
  // The classifier may add approval boundaries when risk signals are present,
  // but the explicit mode selection must remain (not removed, not replaced).
  const decision = classifyAdaptiveDecision(request, {
    risk_signals: ['security-sensitive'],
    scope_signals: ['touches authorization middleware'],
  });

  assert.equal(decision.mode, 'planned',
    'explicit lazy-ulw-plan mode must be preserved even with risk context');
  assert.ok(decision.stages.includes('plan'),
    'plan stage must remain when explicit lazy-ulw-plan is set');
  // approval_required may be true (boundary added) or false (no boundary added);
  // the key invariant is that the explicit selection is not removed.
  assert.ok(typeof decision.approval_required === 'boolean',
    'approval_required must be a boolean (boundary indicator)');
});
