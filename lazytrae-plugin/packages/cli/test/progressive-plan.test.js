'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  computeExecutableMilestones,
  parseDecisionGates,
  validateDecisionGate,
  validateMilestones,
} = require('../src/lib/progressive-plan');

// --- Plan fixtures (T3: progressive milestones + decision gates) ---

const COMPLEX_PLAN = `# Expense tracker

## Milestones
- M1: discovery and scaffold
  - depends: (none)
  - provisional: false
  - parent_plan_id: plan-root
- M2: billing integration
  - depends: M1
  - provisional: true
  - parent_plan_id: plan-root
  - T1: integrate provider-x
- M3: reporting
  - depends: M2
  - provisional: true

## Decision Gates
### G1
question: Which billing provider should the billing milestone integrate?
recommendation: Provider X (existing contract, lowest integration cost).
alternatives: provider-x (Existing contract provider; tradeoffs: lower cost, fewer features) | provider-y (New provider; tradeoffs: more features, new procurement)
owner: product-owner
affected_tasks: T1
needed_by: M2
status: open
assumptions: Billing is the only consequential product decision surfaced now.
`;

const CYCLIC_PLAN = `# Cyclic

## Milestones
- M1: first
  - depends: M2
  - provisional: false
- M2: second
  - depends: M1
  - provisional: false
`;

const MISSING_ID_PLAN = `# Missing

## Milestones
- M1: first
  - depends: M9
  - provisional: false
`;

const DANGLING_PARENT_PLAN = `# Dangling

## Milestones
- M1: first
  - depends: (none)
  - provisional: false
  - parent_plan_id: ghost-plan
`;

const ALL_PROVISIONAL_PLAN = `# All provisional

## Milestones
- M1: first
  - provisional: true
- M2: second
  - provisional: true
`;

const FLAT_PLAN = `# Flat

## Milestones
- M1: first
  - depends: (none)
  - provisional: false
- M2: second
  - depends: M1
  - provisional: false
`;

// Table-driven route cases for milestone validation (behavior c + S7).
const VALIDATION_CASES = [
  {
    name: 'complex plan parses with authoritative parent and provisional later milestones',
    plan: COMPLEX_PLAN,
    expect: { valid: true, milestoneCount: 3, firstExecutable: 'M1', laterProvisional: ['M2', 'M3'] },
  },
  {
    name: 'dependency cycle is rejected',
    plan: CYCLIC_PLAN,
    expect: { valid: false, rejects: 'cycle' },
  },
  {
    name: 'missing milestone id is rejected',
    plan: MISSING_ID_PLAN,
    expect: { valid: false, rejects: 'missing' },
  },
  {
    name: 'dangling child link to unknown parent is rejected',
    plan: DANGLING_PARENT_PLAN,
    expect: { valid: false, rejects: 'dangling' },
  },
  {
    name: 'flat plan with resolved parent validates and executes first milestone',
    plan: FLAT_PLAN,
    expect: { valid: true, milestoneCount: 2, firstExecutable: 'M1' },
  },
];

for (const c of VALIDATION_CASES) {
  test(`milestone validation: ${c.name}`, () => {
    const result = validateMilestones(c.plan, { knownParentPlanIds: ['plan-root'] });
    if (c.expect.valid) {
      assert.equal(result.valid, true, `expected valid; errors=${JSON.stringify(result.errors)}`);
      assert.equal(result.milestones.length, c.expect.milestoneCount);
      const executable = computeExecutableMilestones(c.plan, { knownParentPlanIds: ['plan-root'] });
      const exec = executable.find((m) => m.executable);
      assert.equal(exec && exec.id, c.expect.firstExecutable);
      for (const id of c.expect.laterProvisional || []) {
        const m = executable.find((x) => x.id === id);
        assert.equal(m.provisional, true, `${id} must be provisional`);
        assert.equal(m.may_dispatch, false, `${id} MUST NOT dispatch`);
      }
    } else {
      assert.equal(result.valid, false);
      const joined = result.errors.join(' ').toLowerCase();
      if (c.expect.rejects === 'cycle') assert.match(joined, /cycle/);
      if (c.expect.rejects === 'missing') assert.match(joined, /missing/);
      if (c.expect.rejects === 'dangling') assert.match(joined, /dangling/);
    }
  });
}

// Next milestone executable; later milestones provisional (behavior c).
test('next milestone executable; later milestones forced provisional and cannot dispatch', () => {
  const exec = computeExecutableMilestones(FLAT_PLAN, { knownParentPlanIds: [] });
  assert.equal(exec.length, 2);
  assert.equal(exec[0].id, 'M1');
  assert.equal(exec[0].executable, true);
  assert.equal(exec[0].may_dispatch, true);
  // M2 comes after the executable milestone -> forced provisional, no dispatch
  assert.equal(exec[1].id, 'M2');
  assert.equal(exec[1].provisional, true, 'later milestone forced provisional');
  assert.equal(exec[1].may_dispatch, false, 'later milestone MUST NOT dispatch');
});

test('all-provisional plan dispatches nothing (provisional non-dispatch)', () => {
  const exec = computeExecutableMilestones(ALL_PROVISIONAL_PLAN, {});
  assert.equal(exec.every((m) => m.may_dispatch === false), true);
  assert.equal(exec.some((m) => m.executable), false);
});

test('open decision gate blocks only its needed milestone (S6 gate_effect)', () => {
  const result = validateMilestones(COMPLEX_PLAN, { knownParentPlanIds: ['plan-root'] });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  const exec = computeExecutableMilestones(COMPLEX_PLAN, { knownParentPlanIds: ['plan-root'] });
  // M1 executable even though G1 (needed_by M2) is open; independent work proceeds.
  const m1 = exec.find((m) => m.id === 'M1');
  assert.equal(m1.executable, true);
  const m2 = exec.find((m) => m.id === 'M2');
  assert.equal(m2.may_dispatch, false, 'M2 blocked by open gate cannot dispatch');
});

// Decision gate canonical shape (behavior d).
const VALID_GATE = {
  question: 'Which billing provider?',
  recommendation: 'Provider X',
  alternatives: [
    { id: 'provider-x', summary: 'Existing contract', tradeoffs: 'lower cost' },
    { id: 'provider-y', summary: 'New provider', tradeoffs: 'more features' },
  ],
  owner: 'product-owner',
  affected_tasks: ['T1'],
  needed_by: 'M2',
  status: 'open',
  assumptions: ['only consequential decision now'],
};

test('decision gate valid canonical shape passes', () => {
  const r = validateDecisionGate(VALID_GATE);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

const GATE_INVALID_CASES = [
  { name: 'missing required field', gate: { ...VALID_GATE, owner: '' }, expect: /owner/ },
  { name: 'no alternatives', gate: { ...VALID_GATE, alternatives: [] }, expect: /alternatives/ },
  { name: 'only the recommended option', gate: { ...VALID_GATE, alternatives: [{ id: 'provider-x', summary: 'only' }] }, expect: /non-recommended/ },
  { name: 'bad status', gate: { ...VALID_GATE, status: 'maybe' }, expect: /status/ },
];

for (const c of GATE_INVALID_CASES) {
  test(`decision gate invalid: ${c.name}`, () => {
    const r = validateDecisionGate(c.gate);
    assert.equal(r.valid, false);
    assert.match(r.errors.join(' '), c.expect);
  });
}

test('decision gate never auto-approves (status stays open)', () => {
  const r = validateDecisionGate({ ...VALID_GATE, status: 'answered' });
  assert.equal(r.valid, true);
  assert.equal(r.gate.status, 'answered');
  // "answered" is an explicit human state, not a timeout-driven auto-approval.
  // An open gate would have blocked; the validator does not flip open->answered.
  const open = validateDecisionGate(VALID_GATE);
  assert.equal(open.gate.status, 'open');
});

test('parseDecisionGates reconstructs canonical shape from markdown', () => {
  const gates = parseDecisionGates(COMPLEX_PLAN);
  assert.equal(gates.length, 1);
  assert.equal(gates[0].id, 'G1');
  assert.equal(gates[0].needed_by, 'M2');
  assert.equal(gates[0].status, 'open');
  assert.equal(gates[0].alternatives.length, 2);
  assert.equal(gates[0].assumptions[0], 'Billing is the only consequential product decision surfaced now.');
  const r = validateDecisionGate(gates[0]);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});
