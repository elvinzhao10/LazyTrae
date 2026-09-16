'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

// Both active-plan consumers (cli and mcp runtime) must behave identically for
// the v1.3.0 additive fields (execution_intent normalization + milestone flags).
const cli = require('../src/lib/active-plan');
const mcp = require(path.resolve(__dirname, '..', '..', '..', 'packages', 'mcp', 'src', 'runtime', 'active-plan'));

const PLAN = `# Expense tracker

## Milestones
- M1: discovery and scaffold
  - depends: (none)
  - provisional: false
  - parent_plan_id: plan-root
- M2: billing integration
  - depends: M1
  - provisional: true
  - parent_plan_id: plan-root

## Decision Gates
### G1
question: Which billing provider should the billing milestone integrate?
recommendation: Provider X (existing contract, lowest integration cost).
alternatives: provider-x (Existing contract provider; tradeoffs: lower cost) | provider-y (New provider; tradeoffs: more features)
owner: product-owner
affected_tasks: T1
needed_by: M2
status: open
assumptions: Billing is the only consequential product decision now.
`;

const STATE_VARIANTS = [
  {},
  { execution_intent: 'execute', workflow_mode: 'planned', current_stage: 'implement' },
  { execution_intent: 'bogus', mode: 'direct' },
  { workflow_mode: 'assisted' },
];

for (const variant of STATE_VARIANTS) {
  test(`normalizeExecutionState consistent (cli vs mcp): ${JSON.stringify(variant)}`, () => {
    const a = cli.normalizeExecutionState(variant);
    const b = mcp.normalizeExecutionState(variant);
    assert.deepEqual(a, b, 'cli and mcp must normalize execution state identically');
    assert.ok(['plan_only', 'execute'].includes(a.execution_intent));
  });
}

test('milestone validation consistent (cli vs mcp) for a complex plan', () => {
  const a = cli.parsePlanMilestones(PLAN, { knownParentPlanIds: ['plan-root'] });
  const b = mcp.parsePlanMilestones(PLAN, { knownParentPlanIds: ['plan-root'] });
  assert.deepEqual(a.valid, b.valid);
  assert.deepEqual(a.errors, b.errors);
  assert.deepEqual(a.milestones.length, b.milestones.length);
});

test('computeExecutableMilestones consistent (cli vs mcp)', () => {
  const a = cli.computeExecutableMilestones(PLAN, { knownParentPlanIds: ['plan-root'] });
  const b = mcp.computeExecutableMilestones(PLAN, { knownParentPlanIds: ['plan-root'] });
  assert.deepEqual(a, b, 'executable milestone computation must match across consumers');
});

test('validateDecisionGate consistent (cli vs mcp)', () => {
  const gate = {
    question: 'q', recommendation: 'r', alternatives: [{ id: 'x', summary: 's' }, { id: 'y', summary: 't' }],
    owner: 'o', affected_tasks: ['T1'], needed_by: 'M2', status: 'open', assumptions: [],
  };
  const a = cli.validateDecisionGate(gate);
  const b = mcp.validateDecisionGate(gate);
  assert.deepEqual(a.valid, b.valid);
  assert.deepEqual(a.errors, b.errors);
});
