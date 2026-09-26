'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const ec = require('../src/lib/execution-convergence');

test('canonical commands declare their route and authorization intent', () => {
  assert.deepEqual(ec.COMMAND_INTENTS, {
    'lazy-start-work': { intent: 'execute', route: 'explicit-execution' },
    'start-work': { intent: 'execute', route: 'explicit-execution' },
    'lazy-ulw-plan': { intent: 'plan_only', route: 'explicit-planning' },
    'ulw-plan': { intent: 'plan_only', route: 'explicit-planning' },
  });
  assert.equal(ec.resolveExecutionIntent('/lazy-ulw-plan', {}), 'plan_only');
  assert.equal(ec.routeFor('/lazy-ulw-plan'), 'explicit-planning');
  assert.equal(ec.commandFor('/lazy-start-work-example'), null);
  assert.equal(ec.resolveExecutionIntent('/lazy-start-work-example', {}), 'plan_only');
  assert.equal(ec.routeFor('/lazy-start-work-example'), 'automatic-activation');
});

test('non-execution prompts never create execution authority', () => {
  const cases = [
    '',
    '`run tests`',
    '"run tests"',
    'Pause and wait for approval',
    'Fix this, but wait for approval before implementing.',
    'Please do not implement; run tests after approval.',
    'Update me on the current status.',
    'Delete nothing; explain the plan.',
    'Run no tests; just explain.',
    'Create a plan for the migration.',
    'Write a plan for this fix.',
    'Please write an implementation plan.',
    'Can you create a plan?',
    'Plan this fix before we make changes.',
    'Explain how to implement the plan.',
    '先不要执行，只解释计划',
    'No ejecutes; solo explica el plan.',
    '実行せず、計画だけ説明してください。',
  ];
  for (const request of cases) {
    assert.equal(
      ec.resolveExecutionIntent(request, {}),
      'plan_only',
      `${JSON.stringify(request)} must not authorize execution`,
    );
  }
});

test('clear implementation requests retain execution authority', () => {
  const cases = [
    '/lazy-start-work plan-a',
    'Fix the typo in the welcome label.',
    'Please run tests',
    'Can you fix this bug?',
    'Add a stop button.',
    'Fix the pause handler.',
    'Implement this change and explain it.',
    'After you explain, fix the bug.',
    'Explain the bug, then fix it.',
    'I need you to fix the bug.',
    'Go ahead and run the tests.',
    'Make the requested change.',
    'Proceed with the implementation.',
    '请修复这个错误',
  ];
  for (const request of cases) {
    assert.equal(ec.resolveExecutionIntent(request, {}), 'execute', request);
  }
});

// Table-driven route cases (behaviors a + b, scenarios S1-S5, S13, S14).
const ROUTE_CASES = [
  {
    name: 'S1 explicit start with plan routes to explicit-execution',
    request: '/lazy-start-work lazyseries-v1.3.0-adaptive-planning-and-memory',
    context: {},
    expect: { route: 'explicit-execution', intent: 'execute' },
  },
  {
    name: 'S3 typo fix natural-language routes to automatic-activation and executes',
    request: 'Fix the typo in the welcome label.',
    context: {},
    expect: { route: 'automatic-activation', intent: 'execute' },
  },
  {
    name: 'S4 explanation request does not execute and does not mutate product files',
    request: 'Explain how the billing module works and show the command to run the migration.',
    context: {},
    expect: { route: 'automatic-activation', intent: 'plan_only', executes: false, mutates: false },
  },
  {
    name: 'S5 plan-only request sets plan_only and does not mutate product files',
    request: 'Plan only; do not implement.',
    context: {},
    expect: { route: 'automatic-activation', intent: 'plan_only', mutates: false },
    followUp: {
      request: 'Implement this plan',
      expect: { intent: 'execute' },
    },
  },
  {
    name: 'S14 missing host hook offers explicit entry with pending (not PASS) status',
    request: 'Build the feature',
    context: { hostHookSupport: false },
    expect: { route: 'automatic-activation', missingHook: true, status: 'pending' },
  },
];

for (const c of ROUTE_CASES) {
  test(`route convergence: ${c.name}`, () => {
    const r = ec.classifyAdaptiveRoute(c.request, c.context);
    assert.equal(r.route, c.expect.route);
    if (c.expect.intent !== undefined) assert.equal(r.execution_intent, c.expect.intent);
    if (c.expect.executes === false) assert.equal(r.guard.plan_only_invariant.ok, true);
    if (c.expect.mutates === false) {
      const inv = ec.checkPlanOnlyInvariant(r.execution_intent, { mutatesProductFiles: true });
      assert.equal(inv.ok, false, 'plan_only intent must forbid product mutation');
    }
    if (c.expect.missingHook) {
      assert.ok(r.missing_host_hook, 'missing hook detected');
      assert.equal(r.missing_host_hook.status, c.expect.status);
      assert.equal(r.missing_host_hook.silent_automatic_claim, false);
    }
    if (c.followUp) {
      const f = ec.classifyAdaptiveRoute(c.followUp.request, { ...c.context, priorExecutionIntent: r.execution_intent });
      assert.equal(f.execution_intent, c.followUp.expect.intent, 'explicit later execution request flips to execute');
    }
  });
}

// Plan-only invariant: explanation / quoted / explicit plan-only never mutate product files.
test('plan-only invariant: explanation and quoted commands never set execute', () => {
  assert.equal(ec.isExplanationRequest('Explain how the billing module works and show the command to run the migration.'), true);
  assert.equal(ec.isPlanOnlyRequest('Plan only; do not implement.'), true);
  assert.equal(ec.resolveExecutionIntent('Explain the architecture and `rm -rf build`', {}), 'plan_only');
  const inv = ec.checkPlanOnlyInvariant('plan_only', { mutatesProductFiles: true, setsExecute: true });
  assert.equal(inv.ok, false);
  assert.equal(inv.reason.includes('plan_only'), true);
});

// Ambiguous approval: a vague "yes" with multiple pending questions cannot grant execution.
test('ambiguous approval with multiple pending questions cannot grant execution', () => {
  const intent = ec.resolveExecutionIntent('yes', { pendingQuestions: 3 });
  assert.equal(intent, 'plan_only');
  const intentSingle = ec.resolveExecutionIntent('yes', { pendingQuestions: 1 });
  // a single pending question is not "ambiguous"; but still not an execution request,
  // so default plan_only applies (no execution authority from a bare yes).
  assert.equal(intentSingle, 'plan_only');
  // an explicit execution request still flips regardless of pending count.
  assert.equal(ec.resolveExecutionIntent('Implement this plan', { pendingQuestions: 3 }), 'execute');
});

// Default execution_intent is plan_only unless an explicit execution request is made.
test('execution_intent defaults to plan_only', () => {
  assert.equal(ec.resolveExecutionIntent('What do you think about the design?', {}), 'plan_only');
  assert.equal(ec.resolveExecutionIntent('Implement this plan', {}), 'execute');
});

// S13: duplicate host events must not duplicate dispatch.
test('duplicate host events do not duplicate dispatch', () => {
  const guard = ec.makeDuplicateGuard();
  const key = 'prompt:fix-typo:run-42';
  assert.equal(guard(key), false, 'first event dispatched');
  assert.equal(guard(key), true, 'duplicate suppressed');
  assert.equal(guard('prompt:other:run-43'), false, 'different event dispatched');
  assert.equal(guard(key), true, 'same key still suppressed');
});

// Resume: select a single compatible run or ask only when ambiguous.
test('resume selects single compatible run, asks when ambiguous, fresh when none', () => {
  const single = ec.selectResumeRun(
    [{ run_id: 'r1', plan_id: 'plan-a' }],
    { plan_id: 'plan-a' },
  );
  assert.equal(single.ask, false);
  assert.equal(single.run.run_id, 'r1');
  assert.equal(single.fresh, false);

  const ambiguous = ec.selectResumeRun(
    [{ run_id: 'r1', plan_id: 'plan-a' }, { run_id: 'r2', plan_id: 'plan-a' }],
    { plan_id: 'plan-a' },
  );
  assert.equal(ambiguous.ask, true, 'multiple compatible runs require a clarifying question');
  assert.equal(ambiguous.run, null);

  const fresh = ec.selectResumeRun([], { plan_id: 'plan-a' });
  assert.equal(fresh.ask, false);
  assert.equal(fresh.fresh, true, 'no compatible run -> fresh start');
});

// Both entry routes converge on the same adaptive authority (mode selection).
test('explicit and automatic routes both yield a valid workflow mode', () => {
  const explicit = ec.classifyAdaptiveRoute('/lazy-start-work my-plan', {});
  const auto = ec.classifyAdaptiveRoute('Fix the typo in the welcome label.', {});
  assert.ok(['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'].includes(explicit.mode));
  assert.ok(['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'].includes(auto.mode));
  assert.equal(explicit.route, 'explicit-execution');
  assert.equal(auto.route, 'automatic-activation');
});
