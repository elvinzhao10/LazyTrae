'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');

const { parsePlanCheckboxes, validatePlanCheckboxes, HEADINGS } = require('../src/lib/plan-checkbox-parser');

// Canonical plan (## TODOs) — the source of truth for "same intended tasks".
const CANONICAL_PLAN = `# Plan

## TODOs
- [ ] T1: first task
- [ ] T2: second task
- [ ] T3: third task

## Final Verification Wave
- [ ] end to end
- [ ] all tests pass
`;

// Legacy plan (## Todos, lowercase verification) — must enumerate the SAME tasks.
const LEGACY_PLAN = `# Plan

## Todos
- [ ] T1: first task
- [ ] T2: second task
- [ ] T3: third task

## Final verification wave
- [ ] end to end
- [ ] all tests pass
`;

function canonicalTaskTitles(plan) {
  return parsePlanCheckboxes(plan)
    .filter((b) => b.section === 'TODOs' || b.section === 'Todos')
    .map((b) => b.id)
    .sort();
}

test('canonical plan enumerates the three intended tasks', () => {
  const boxes = parsePlanCheckboxes(CANONICAL_PLAN);
  const taskBoxes = boxes.filter((b) => b.section === 'TODOs');
  assert.equal(taskBoxes.length, 3);
  assert.deepEqual(taskBoxes.map((b) => b.id).sort(), ['T1', 'T2', 'T3']);
  assert.equal(validatePlanCheckboxes(CANONICAL_PLAN), null);
});

test('legacy plan enumerates the SAME intended tasks as canonical', () => {
  assert.deepEqual(canonicalTaskTitles(LEGACY_PLAN), canonicalTaskTitles(CANONICAL_PLAN));
  assert.equal(validatePlanCheckboxes(LEGACY_PLAN), null);
});

test('parser accepts both TODOs and Todos headings (case-exact)', () => {
  assert.ok(HEADINGS.has('TODOs'));
  assert.ok(HEADINGS.has('Todos'));
  assert.ok(HEADINGS.has('Final Verification Wave'));
  // arbitrary casing is NOT accepted
  assert.ok(!HEADINGS.has('todos'));
  assert.ok(!HEADINGS.has('TODOS'));
});

test('zero-task guard: non-empty plan with unrecognised heading errors', () => {
  const plan = '# Plan\n## Tasks\n- [ ] T1: a\n';
  assert.match(validatePlanCheckboxes(plan), /no checkboxes parsed/);
});

test('zero-task guard (empty-section): recognised heading, no checkboxes, errors', () => {
  const plan = '# Plan\n## TODOs\nSome prose but no checkboxes here.\n';
  assert.match(validatePlanCheckboxes(plan), /no checkboxes parsed/);
});

test('zero-task guard rejects a truly empty plan', () => {
  assert.match(validatePlanCheckboxes(''), /no checkboxes parsed/);
  assert.match(validatePlanCheckboxes('   \n  \n'), /no checkboxes parsed/);
});

test('duplicate task id errors', () => {
  const plan = '## TODOs\n- [ ] T1: a\n- [ ] T1: b\n';
  const err = validatePlanCheckboxes(plan);
  assert.ok(err, 'expected duplicate-id error');
  assert.match(err, /duplicate task id 'T1'/);
});

test('missing task id in a task section errors', () => {
  const plan = '## TODOs\n- [ ] just a task with no id\n';
  const err = validatePlanCheckboxes(plan);
  assert.ok(err, 'expected missing-id error');
  assert.match(err, /missing a task id/);
});

test('verification section id-less checkboxes are exempt from missing-id', () => {
  const plan = '## TODOs\n- [ ] T1: work\n## Final Verification Wave\n- [ ] end to end\n- [ ] all tests pass\n';
  assert.equal(validatePlanCheckboxes(plan), null);
  const boxes = parsePlanCheckboxes(plan).filter(box => box.section === 'Final Verification Wave');
  assert.equal(boxes.length, 2);
  assert.ok(boxes.every((b) => b.section === 'Final Verification Wave'));
});

test('checked checkboxes are parsed with checked=true', () => {
  const plan = '## TODOs\n- [x] T1: done\n- [ ] T2: todo\n';
  const boxes = parsePlanCheckboxes(plan);
  assert.equal(boxes[0].checked, true);
  assert.equal(boxes[1].checked, false);
});

// Adversarial: malformed checkbox syntax (not a real checkbox) is ignored, and a
// non-empty plan that yields zero parsed checkboxes fails the zero-task guard.
test('adversarial: malformed checkbox syntax does not silently succeed', () => {
  const plan = '# Plan\n## TODOs\n* [ ] T1: not a dash\n- ( ) T2: wrong brackets\n';
  const err = validatePlanCheckboxes(plan);
  assert.ok(err, 'malformed checkboxes must trip the zero-task guard');
  assert.match(err, /no checkboxes parsed/);
});

test('legacy dot IDs preserve task identity and nested criteria are not tasks', () => {
  const plan = '## Todos\n- [ ] A1. work\n  - [ ] acceptance\n';
  assert.equal(validatePlanCheckboxes(plan), null);
  assert.deepEqual(parsePlanCheckboxes(plan).map(box => box.id), ['A1']);
});

test('active-plan runtime rejects invalid plan content', () => {
  const { validateActivePlan } = require('../src/lib/active-plan');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-runtime-'));
  try {
    fs.mkdirSync(path.join(root, '.lazytrae/plans'), { recursive: true });
    fs.writeFileSync(path.join(root, '.lazytrae/plans/test.md'), '');
    const result = validateActivePlan(root, '.lazytrae/plans/test.md');
    assert.equal(result.valid, false);
    assert.match(result.error, /no checkboxes parsed/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [name, text, error] of [
  ['canonical', '## TODOs\n- [ ] T1: work\n', null],
  ['legacy', '## Todos\n- [ ] A1. work\n  - [ ] acceptance\n', null],
  ['empty', '', /no checkboxes parsed/],
  ['duplicate', '## TODOs\n- [ ] T1: work\n- [ ] T1. duplicate\n', /duplicate task id/],
  ['missing', '## TODOs\n- [ ] work\n', /missing a task id/],
]) {
  test(`CLI doctor and MCP plan consumers validate ${name} plans`, () => {
    const { makeCompletionFixture, runCli } = require('./test-helpers');
    const root = makeCompletionFixture('plan-cli-', false);
    try {
      const statePath = path.join(root, '.lazytrae/state/boulder.json');
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.works['work-1'].tasks = [{ id: name === 'legacy' ? 'A1' : 'T1', description: 'work', status: 'pending' }];
      fs.writeFileSync(statePath, JSON.stringify(state));
      fs.writeFileSync(path.join(root, '.lazytrae/plans/demo.md'), text);
      const cli = runCli(['doctor'], { cwd: root });
      const output = cli.stdout + cli.stderr;
      assert.match(output, /Active plan validation/);
      for (const handlers of [require('../src/mcp/handlers-read'), require('../../mcp/src/handlers-read')]) {
        const plan = handlers.handleGetActivePlan(root);
        const next = handlers.handleGetNextTask(root);
        if (error) {
          assert.match(output, error);
          assert.equal(plan.error, 'INVALID_ACTIVE_PLAN');
          assert.match(plan.message, error);
          assert.equal(next.error, 'INVALID_ACTIVE_PLAN');
        } else {
          assert.equal(plan.error, undefined);
          assert.equal(next.next_task.id, name === 'legacy' ? 'A1' : 'T1');
        }
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('verification-only plan is not a task plan', () => {
  assert.match(validatePlanCheckboxes('## Final Verification Wave\n- [ ] tests pass'), /no task checkboxes parsed/);
});
