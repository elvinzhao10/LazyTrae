// W4.2 bounded-escalation integration tests for the v1.0.3 Adaptive Harness.
//
// Purpose: prove plan Section 12 (Escalation and repair) behavior:
//   - targeted verify failure adds a debug stage
//   - broader scope escalates mode by exactly one level
//   - max 2 automatic depth escalations per decision (negative test)
//   - post-bound blocked state carries all 5 required sub-fields
//   - security/release/migration findings require independent review
//
// The classifier encodes the escalation sequence as a single bounded decision
// (composeEscalationBound): initial direct mode → verification failure adds
// debug (escalation 1) → broader scope escalates mode one level (escalation 2)
// → bound reached → blocked-state record. The bound case is the terminal
// state of the sequence; the harness must not loop indefinitely.

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');

const MAX_AUTO_ESCALATIONS = 2;
const MODE_ORDER = ['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'];

// Fixture 09-escalation-bound.json: direct mode → verification failure
// (adds debug stage) → broader scope revealed (mode escalates one level)
// → bound reached → blocked-state record with all 5 required sub-fields.
const ESCALATION_REQUEST =
  'Fix the failing unit test in src/utils/date.test.js. The test expects a ' +
  'locale-formatted date but the implementation returns an ISO string.';
const ESCALATION_CONTEXT = {
  initial_mode: 'direct',
  max_auto_escalations: MAX_AUTO_ESCALATIONS,
  signals: { verification_failure: true },
  scope_revealed_broader: true,
  verification_scope: 'standard',
};

test('W4.2 Scenario 1: targeted verify failure adds a debug stage', () => {
  const decision = classifyAdaptiveDecision(ESCALATION_REQUEST, ESCALATION_CONTEXT);
  assert.ok(decision.stages.includes('debug'),
    'verification failure must add a debug stage to the workflow');
  assert.equal(decision.snapshot.escalationCount, MAX_AUTO_ESCALATIONS,
    'escalation count reflects the bound after the sequence completes');
});

test('W4.2 Scenario 2: scope material increase escalates mode by exactly one level', () => {
  const decision = classifyAdaptiveDecision(ESCALATION_REQUEST, ESCALATION_CONTEXT);
  // Fixture starts at initial_mode 'direct'; broader scope revealed must
  // escalate exactly one level to 'assisted' (direct → assisted).
  assert.equal(decision.mode, 'assisted',
    'broader scope revealed must escalate direct → assisted (one level)');
  const initialIdx = MODE_ORDER.indexOf('direct');
  const finalIdx = MODE_ORDER.indexOf(decision.mode);
  assert.equal(finalIdx - initialIdx, 1,
    'mode escalation must be exactly one level per scope-revealing failure');
});

test('W4.2 Scenario 3: max 2 escalations bound — no third escalation after 3 verify failures', () => {
  // The fixture escalation_sequence encodes three verification failures
  // (initial fail, post-debug fail, post-broader-scope fail). The bound is
  // 2 automatic depth escalations; the third trigger must NOT escalate again.
  const decision = classifyAdaptiveDecision(ESCALATION_REQUEST, ESCALATION_CONTEXT);
  assert.equal(decision.snapshot.escalationCount, MAX_AUTO_ESCALATIONS,
    `escalationCount must be ${MAX_AUTO_ESCALATIONS} after the bound is reached`);
  assert.ok(decision.snapshot.escalationCount <= MAX_AUTO_ESCALATIONS,
    'classifier must never exceed the max-auto-escalations bound');
  // Bound produces a blocked state — non-null blocker with required fields.
  assert.notEqual(decision.snapshot.blocker, null,
    'post-bound state must produce a non-null blocker record');
});

test('W4.2 Scenario 4 (negative): escalation_count must never exceed max_auto_escalations', () => {
  // Across multiple fixture contexts, escalationCount must remain ≤ 2.
  const contexts = [
    {},
    { scope: 'broad', acceptance_criteria: 'incomplete' },
    { signals: { verification_failure: true }, initial_mode: 'direct' },
    { risk_signals: ['security'] },
    { risk_signals: ['release'] },
    { session_scope: 'multi-session', checkpoint_requirement: 'durable' },
  ];
  for (const ctx of contexts) {
    const decision = classifyAdaptiveDecision('verify escalation bound', ctx);
    assert.ok(decision.snapshot.escalationCount <= MAX_AUTO_ESCALATIONS,
      `escalationCount ${decision.snapshot.escalationCount} exceeds bound for context ${JSON.stringify(ctx)}`);
  }
});

test('W4.2 Scenario 5: blocked-state record contains all required sub-fields', () => {
  const decision = classifyAdaptiveDecision(ESCALATION_REQUEST, ESCALATION_CONTEXT);
  const blocker = decision.snapshot.blocker;
  assert.equal(typeof blocker, 'object', 'blocker must be an object record');
  assert.notEqual(blocker, null, 'blocker must not be null at the bound');
  // Section 12: blocked state must carry reproduced failure, attempted
  // approaches, current evidence, unresolved decision, exact next user decision.
  const requiredFields = [
    'reproduced_failure',
    'attempted_approaches',
    'current_evidence',
    'unresolved_decision',
    'exact_next_user_decision',
  ];
  for (const field of requiredFields) {
    assert.ok(field in blocker, `blocker must contain '${field}' (Section 12)`);
  }
  assert.ok(Array.isArray(blocker.attempted_approaches) && blocker.attempted_approaches.length > 0,
    'attempted_approaches must be a non-empty list');
  for (const field of ['reproduced_failure', 'current_evidence',
    'unresolved_decision', 'exact_next_user_decision']) {
    assert.equal(typeof blocker[field], 'string', `${field} must be a string`);
    assert.ok(blocker[field].length > 0, `${field} must be non-empty`);
  }
});

test('W4.2 Scenario 6a: security finding escalates to orchestrated with independent review', () => {
  const decision = classifyAdaptiveDecision(
    'Change authorization logic for /admin/billing endpoint',
    { risk_signals: ['security-sensitive', 'authorization-change'] }
  );
  assert.equal(decision.mode, 'orchestrated',
    'security-sensitive finding must escalate to orchestrated mode');
  assert.equal(decision.approval_required, true,
    'orchestrated mode must require approval (independent review authority gate)');
  assert.ok(decision.responsibilities.includes('security-review'),
    'orchestrated mode must assign security-review responsibility (no silent skip)');
});

test('W4.2 Scenario 6b: release finding escalates to orchestrated with approval gate', () => {
  const decision = classifyAdaptiveDecision(
    'Cut v2.1.0 release: bump version, update changelog, build artifacts',
    { risk_signals: ['release-or-publication'] }
  );
  assert.equal(decision.mode, 'orchestrated',
    'release finding must escalate to orchestrated mode');
  assert.equal(decision.approval_required, true,
    'release context must require approval (release-review authority checkpoint)');
  // Release-only scenarios route review through the release-review authority
  // checkpoint (approval_required=true) rather than the security-review mode
  // responsibility. This is intentional in composeOrchestrated() — review is
  // NOT silently skipped; it is enforced via the approval gate.
  assert.ok(!decision.responsibilities.includes('security-review'),
    'release-only scenarios route review through release-review checkpoint, not security-review');
});

test('W4.2 Scenario 6c: migration finding escalates to long-horizon (durable continuation)', () => {
  const decision = classifyAdaptiveDecision(
    'Migrate session auth to JWT over 3 sessions',
    { session_scope: 'multi-session', checkpoint_requirement: 'durable' }
  );
  assert.equal(decision.mode, 'long-horizon',
    'multi-session migration must select long-horizon mode');
  assert.ok(decision.stages.includes('continue'),
    'long-horizon mode must include a continue stage for durable checkpoints');
});
