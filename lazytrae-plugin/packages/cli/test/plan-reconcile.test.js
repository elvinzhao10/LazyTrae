'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { acceptResult, classifyPlanEdits } = require('../src/lib/plan-reconcile');

const BASE = `# Plan

## TODOs

- [ ] T1: Scaffold
  - depends: (none)
  - Acceptance: files exist
- [ ] T2: Billing
  - depends: T1
  - Acceptance: billing works
- [ ] T3: Navigation
  - depends: (none)
  - Acceptance: nav works
`;

function planWith({ t2Acceptance, t2Qa, checked = [] } = {}) {
  let text = BASE;
  if (t2Acceptance) text = text.replace('  - Acceptance: billing works', `  - Acceptance: ${t2Acceptance}`);
  if (t2Qa) text = text.replace('- [ ] T2: Billing', `- [ ] T2: Billing\n  - QA: ${t2Qa}`);
  for (const tid of checked) text = text.replace(`- [ ] ${tid}:`, `- [x] ${tid}:`);
  return text;
}

test('whitespace-only edit is unchanged', () => {
  const r = classifyPlanEdits(BASE, BASE + '\n\n');
  assert.strictEqual(r.classification, 'unchanged');
  assert.deepStrictEqual(r.invalidations, []);
});

test('human check is a cosmetic assertion', () => {
  const r = classifyPlanEdits(BASE, planWith({ checked: ['T1'] }));
  assert.strictEqual(r.classification, 'cosmetic');
  assert.deepStrictEqual(r.invalidations, []);
  assert.deepStrictEqual(r.reopen, []);
});

test('human uncheck reopens the task', () => {
  const checked = planWith({ checked: ['T1'] });
  const r = classifyPlanEdits(checked, BASE);
  assert.deepStrictEqual(r.reopen, ['T1']);
});

test('acceptance change is semantic and scoped to the affected task', () => {
  const r = classifyPlanEdits(BASE, planWith({ t2Acceptance: 'billing works differently' }));
  assert.strictEqual(r.classification, 'semantic');
  const ids = r.invalidations.map((i) => i.task).sort();
  assert.ok(ids.includes('T2'));
  assert.ok(!ids.includes('T3'), 'independent task must not be invalidated');
});

test('verification-command change is semantic', () => {
  const r = classifyPlanEdits(BASE, planWith({ t2Qa: 'run billing and payment tests' }));
  assert.strictEqual(r.classification, 'semantic');
  assert.ok(r.invalidations.some((i) => i.task === 'T2'));
});

test('added task requires eligibility without invalidating existing work', () => {
  const next = BASE + '- [ ] T4: Reporting\n  - depends: T2\n  - Acceptance: reports\n';
  const r = classifyPlanEdits(BASE, next);
  assert.strictEqual(r.classification, 'semantic');
  assert.deepStrictEqual(r.added, ['T4']);
  assert.ok(!r.invalidations.some((i) => i.task === 'T1'));
});

test('removed task stops dispatch', () => {
  const next = BASE.replace('- [ ] T2: Billing\n  - depends: T1\n  - Acceptance: billing works\n', '');
  const r = classifyPlanEdits(BASE, next);
  assert.deepStrictEqual(r.removed, ['T2']);
  assert.ok(r.invalidations.some((i) => i.task === 'T2'));
});

test('reordering tasks is cosmetic', () => {
  const lines = BASE.trimEnd().split('\n');
  const t2 = lines.findIndex((l) => l.includes('T2:'));
  const t3 = lines.findIndex((l) => l.includes('T3:'));
  const t2Block = lines.slice(t2, t2 + 3);
  const t3Block = lines.slice(t3, t3 + 3);
  const reordered = [...lines.slice(0, t2), ...t3Block, ...t2Block, ...lines.slice(t3 + 3)].join('\n') + '\n';
  const r = classifyPlanEdits(BASE, reordered);
  assert.strictEqual(r.classification, 'cosmetic', JSON.stringify(r.summary));
});

test('classifying twice is idempotent', () => {
  const a = classifyPlanEdits(BASE, planWith({ t2Acceptance: 'x' }));
  const b = classifyPlanEdits(BASE, planWith({ t2Acceptance: 'x' }));
  assert.deepStrictEqual(a, b);
});

test('stale result rejected, fresh result accepted', () => {
  assert.strictEqual(acceptResult({ plan_sha256: 'aaa' }, 'aaa').ok, true);
  const stale = acceptResult({ plan_sha256: 'aaa' }, 'bbb');
  assert.strictEqual(stale.ok, false);
  assert.match(stale.reason, /stale/i);
  const missing = acceptResult({}, 'bbb');
  assert.strictEqual(missing.ok, false);
  assert.match(missing.reason, /no plan_sha256/);
});
