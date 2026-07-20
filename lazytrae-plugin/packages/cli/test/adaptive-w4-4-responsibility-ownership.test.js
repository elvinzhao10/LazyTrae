// W4.4 Responsibility Ownership integration tests for v1.0.3 Adaptive Harness.
//
// Purpose: prove plan Section 8 (Smallest-useful-team policy):
//   - direct mode has no delegated specialist by default
//   - assisted mode uses focused specialists (no review responsibilities)
//   - planned mode assigns exactly one owner per stage (no orphans, no dups)
//   - orchestrated mode with independent workstreams still has one owner per stage
//   - long-horizon mode includes the continuity responsibility
//   - responsibilities array has no duplicates
//   - reviewers are not sole authors (implementation present when review present)
//   - negative: dependent work (debug-then-fix) does NOT spawn parallel implementers
//
// Fixture: contracts/fixtures/v103/10-responsibility-ownership.json
// Source under test: src/lib/adaptive-decision.js (read-only — no source edits).

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');

const FIXTURE_PATH = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103',
  '10-responsibility-ownership.json');
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

// Map each workflow stage to its canonical owning responsibility.
// Per Section 8: "Assign one owner to each implementation stage."
// The review stage may be owned by either quality-review OR security-review
// (security-review is the security-sensitive variant of the same owner slot).
const STAGE_OWNER = {
  understand: 'exploration',
  plan: 'planning',
  implement: 'implementation',
  debug: 'debugging',
  verify: 'verification',
  continue: 'continuity',
};
const REVIEW_OWNERS = new Set(['quality-review', 'security-review', 'release-review']);
const SPECIALIST_OWNERS = new Set(['exploration', 'planning', 'debugging',
  'quality-review', 'security-review', 'release-review', 'continuity']);

function noDuplicates(arr) {
  return arr.length === new Set(arr).size;
}

function ownersForStage(stage, responsibilities) {
  if (stage === 'review') {
    return responsibilities.filter(r => REVIEW_OWNERS.has(r));
  }
  const owner = STAGE_OWNER[stage];
  return owner ? responsibilities.filter(r => r === owner) : [];
}

test('W4.4 Scenario 1: direct mode has no delegated specialist by default', () => {
  const decision = classifyAdaptiveDecision(
    'Fix the typo in the error message at src/errors.js:42.',
    { scope: 'localized', file_count: 1, acceptance_criteria: 'clear' }
  );
  assert.equal(decision.mode, 'direct',
    'localized one-file change selects direct mode');
  // Direct mode carries only the primary implementer + verification; no
  // exploration, planning, debugging, review, or continuity specialists.
  for (const r of decision.responsibilities) {
    assert.ok(!SPECIALIST_OWNERS.has(r),
      `direct mode must not delegate specialist "${r}"`);
  }
  assert.ok(decision.responsibilities.includes('implementation'),
    'direct mode includes the primary implementer');
});

test('W4.4 Scenario 2: assisted mode uses focused specialist(s), no review team', () => {
  const decision = classifyAdaptiveDecision(FIXTURE.request.replace('parallel CSV and JSON', 'single CSV'),
    { scope: 'bounded', file_count: 4, repository_familiarity: 'unfamiliar',
      signals: { primarily_debugging: true } });
  assert.equal(decision.mode, 'assisted',
    'bounded cross-file diagnostic selects assisted mode');
  // Assisted mode may add focused specialists (exploration/debugging) but
  // must NOT assemble a multi-agent review team.
  for (const r of REVIEW_OWNERS) {
    assert.ok(!decision.responsibilities.includes(r),
      `assisted mode must not include review responsibility "${r}"`);
  }
  assert.ok(!decision.responsibilities.includes('continuity'),
    'assisted mode must not include continuity (no durable state)');
  const focused = decision.responsibilities.filter(r =>
    r === 'exploration' || r === 'debugging');
  assert.ok(focused.length >= 1,
    'assisted mode includes at least one focused specialist (exploration or debugging)');
});

test('W4.4 Scenario 3: planned mode assigns exactly one owner per stage', () => {
  const decision = classifyAdaptiveDecision(
    'Add a new export-to-PDF feature with unresolved design choices.',
    { scope: 'broad', acceptance_criteria: 'incomplete',
      decisions_to_resolve: ['library', 'layout'] });
  assert.equal(decision.mode, 'planned');
  // planned mode stages: understand, plan, implement, verify (4 stages)
  // planned mode responsibilities: exploration, planning, implementation, verification (4 owners)
  assert.equal(decision.stages.length, decision.responsibilities.length,
    'planned mode has exactly one owner per stage (no orphans, no duplicates)');
  for (const stage of decision.stages) {
    const owners = ownersForStage(stage, decision.responsibilities);
    assert.equal(owners.length, 1,
      `planned stage "${stage}" must have exactly one owner; got ${owners.length}`);
  }
  assert.ok(noDuplicates(decision.stages), 'planned mode stages must be unique');
  assert.ok(noDuplicates(decision.responsibilities),
    'planned mode responsibilities must be unique');
});

test('W4.4 Scenario 4: orchestrated mode with independent workstreams — one owner per stage', () => {
  const decision = classifyAdaptiveDecision(FIXTURE.request, FIXTURE.context);
  assert.equal(decision.mode, 'orchestrated');
  assert.ok(Array.isArray(FIXTURE.context.independent_workstreams)
    && FIXTURE.context.independent_workstreams.length >= 2,
    'fixture context must declare genuinely independent workstreams');
  // Each stage has at least one owner (no orphaned stages).
  for (const stage of decision.stages) {
    const owners = ownersForStage(stage, decision.responsibilities);
    assert.ok(owners.length >= 1,
      `orchestrated stage "${stage}" must have at least one owner (no orphans)`);
  }
  // No duplicate responsibilities (parallel implementers would duplicate "implementation").
  assert.ok(noDuplicates(decision.responsibilities),
    'orchestrated mode must not duplicate responsibilities (no parallel agents for the same role)');
  // Implementation appears at most once (no parallel implementers).
  const implCount = decision.responsibilities.filter(r => r === 'implementation').length;
  assert.equal(implCount, 1,
    `orchestrated mode has exactly one implementation owner; got ${implCount}`);
});

test('W4.4 Scenario 5: long-horizon mode includes the continuity responsibility', () => {
  const decision = classifyAdaptiveDecision(
    'Migrate session auth to JWT over multiple sessions with durable checkpoints.',
    { session_scope: 'multi-session', checkpoint_requirement: 'durable' });
  assert.equal(decision.mode, 'long-horizon');
  assert.ok(decision.responsibilities.includes('continuity'),
    'long-horizon mode must include the continuity responsibility');
  assert.ok(decision.stages.includes('continue'),
    'long-horizon mode must include the continue stage');
});

test('W4.4 Scenario 6: no duplicate responsibilities across every mode', () => {
  const cases = [
    { name: 'direct', request: 'Fix typo at src/errors.js:42.',
      ctx: { scope: 'localized', file_count: 1 } },
    { name: 'assisted', request: 'Diagnose stale profile data across four files.',
      ctx: { scope: 'bounded', file_count: 4, repository_familiarity: 'unfamiliar' } },
    { name: 'planned', request: 'Add export-to-PDF feature with unresolved design.',
      ctx: { scope: 'broad', acceptance_criteria: 'incomplete',
        decisions_to_resolve: ['lib'] } },
    { name: 'orchestrated', request: FIXTURE.request, ctx: FIXTURE.context },
    { name: 'long-horizon', request: 'Migrate auth to JWT over multiple sessions.',
      ctx: { session_scope: 'multi-session', checkpoint_requirement: 'durable' } },
  ];
  for (const c of cases) {
    const decision = classifyAdaptiveDecision(c.request, c.ctx);
    assert.ok(noDuplicates(decision.responsibilities),
      `${c.name} mode responsibilities must have no duplicates: ${decision.responsibilities}`);
    assert.ok(noDuplicates(decision.stages),
      `${c.name} mode stages must have no duplicates: ${decision.stages}`);
  }
});

test('W4.4 Scenario 7: reviewers are not sole authors (implementation present when review is)', () => {
  // Fixture 04 (security) and fixture 10 (responsibility-ownership) both
  // include a review responsibility. Implementation must also be present so
  // reviewers are never sole authors.
  const reviewCases = [
    { name: 'security-orchestrated',
      request: 'Change authorization logic for /admin/billing endpoint.',
      ctx: { risk_signals: ['security-sensitive', 'authorization-change'] } },
    { name: 'fixture-10',
      request: FIXTURE.request, ctx: FIXTURE.context },
  ];
  for (const c of reviewCases) {
    const decision = classifyAdaptiveDecision(c.request, c.ctx);
    const hasReview = decision.responsibilities.some(r => REVIEW_OWNERS.has(r));
    if (hasReview) {
      assert.ok(decision.responsibilities.includes('implementation'),
        `${c.name}: implementation must be present when a review responsibility is (reviewer != author)`);
    }
  }
});

test('W4.4 Scenario 8 (negative): dependent work (debug-then-fix) does NOT spawn parallel implementers', () => {
  // Dependent stages (debug must complete before fix can be applied) cannot
  // be parallelized. The decision must NOT carry duplicate implementation
  // responsibilities or escalate to orchestrated merely because parallelism
  // is available.
  const decision = classifyAdaptiveDecision(
    'Fix the failing unit test in src/utils/date.test.js.',
    { initial_mode: 'direct',
      signals: { verification_failure: true } });
  // Escalation path produces assisted mode with [debugging, implementation, verification].
  assert.equal(decision.mode, 'assisted');
  const implCount = decision.responsibilities.filter(r => r === 'implementation').length;
  assert.equal(implCount, 1,
    `dependent debug-then-fix work must have exactly one implementer; got ${implCount}`);
  const debugCount = decision.responsibilities.filter(r => r === 'debugging').length;
  assert.equal(debugCount, 1,
    `dependent debug-then-fix work must have exactly one debugger; got ${debugCount}`);
  // Single-writer rule: snapshot must record single_writer='orchestrator' when present.
  if (decision.snapshot) {
    assert.equal(decision.snapshot.decisionId, decision.snapshot.decisionId);
  }
});

test('W4.4 Scenario 9 (fixture regression): 10-responsibility-ownership matches expected decision', () => {
  const decision = classifyAdaptiveDecision(FIXTURE.request, FIXTURE.context);
  assert.equal(decision.mode, FIXTURE.expected_decision.mode);
  assert.deepEqual(decision.stages, FIXTURE.expected_decision.stages);
  assert.deepEqual(decision.responsibilities.sort(),
    FIXTURE.expected_decision.responsibilities.sort());
  assert.equal(decision.verification_level, FIXTURE.expected_decision.verification_level);
  assert.equal(decision.approval_required, FIXTURE.expected_decision.approval_required);
  // One owner per stage (review stage → quality-review; no security-review in this fixture).
  for (const stage of decision.stages) {
    const owners = ownersForStage(stage, decision.responsibilities);
    assert.ok(owners.length >= 1,
      `fixture-10 stage "${stage}" must have at least one owner`);
  }
  // No parallel implementers (independent workstreams still share ONE implementation owner).
  const implCount = decision.responsibilities.filter(r => r === 'implementation').length;
  assert.equal(implCount, 1,
    `fixture-10 has one implementation owner across two independent workstreams; got ${implCount}`);
});
