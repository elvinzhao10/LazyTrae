'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { explicitWorkflow } = require('../src/lib/adaptive-policy');

const MATRIX = [
  ['true negation: direct plan', 'Do not use lazy-ulw-plan.', null],
  ['true negation: direct loop', 'Do not use lazy-ulw-loop.', null],
  ['qualified negation: plan', 'Do not, under any circumstances whatsoever, use the lazy-ulw-plan workflow.', null],
  ['qualified negation: loop', 'Never, even if it seems useful, use lazy-ulw-loop.', null],
  ['rhetorical affirmative: forget plan', 'Do not forget to use lazy-ulw-plan for this migration.', 'lazy-ulw-plan'],
  ['rhetorical affirmative: hesitate loop', "Don't hesitate to use lazy-ulw-loop for this migration.", 'lazy-ulw-loop'],
  ['rhetorical affirmative: typographic hesitate loop', 'Don’t hesitate to use lazy-ulw-loop for this migration.', 'lazy-ulw-loop'],
  ['same-clause replacement selects loop', 'Do not use lazy-ulw-plan, use lazy-ulw-loop instead.', 'lazy-ulw-loop'],
];

for (const [label, request, workflow] of MATRIX) {
  test(`explicit workflow policy: ${label}`, () => {
    const result = explicitWorkflow(request, {});
    if (workflow === null) {
      assert.equal(result, null);
    } else {
      assert.equal(result.workflow, workflow);
    }
  });
}
