'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { makeGitFixture } = require('./test-helpers');

const NAMED_WORKFLOWS = [
  ['lazy-init-deep', 'assisted', ['lazy-init-deep']],
  ['lazy-start-work', 'assisted', ['lazy-start-work']],
  ['lazy-ulw-plan', 'planned', ['lazy-ulw-plan']],
  ['lazy-review-work', 'orchestrated', ['lazy-review-work']],
  ['lazy-ulw-loop', 'long-horizon', ['lazy-ulw-loop']],
  ['lazy-ultrawork', 'orchestrated', ['lazy-ultrawork']],
  ['lazy-verifier', 'direct', ['lazy-verifier']],
];
const EQUIVALENT_RISK_REQUEST = 'Install a provider and upload this repository to a remote service.';

function directiveLines(output) {
  return output.split('\n').filter((line) => line.startsWith('{"lazytraeAdaptive"'));
}

for (const [workflow, expectedMode, expectedSurfaces] of NAMED_WORKFLOWS) {
  test(`installed hook keeps bare ${workflow} authoritative`, (t) => {
    // Given
    const root = makeGitFixture(`lazytrae-explicit-${workflow}-`);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    // When
    const result = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
      cwd: root,
      input: JSON.stringify({ prompt: workflow }),
      encoding: 'utf8',
    });

    // Then
    assert.equal(result.status, 0, result.stderr);
    assert.equal(directiveLines(result.stdout).length, 1);
    const directive = JSON.parse(directiveLines(result.stdout)[0]).lazytraeAdaptive;
    assert.equal(directive.mode, expectedMode);
    if (workflow === 'lazy-ulw-plan') assert.deepEqual(directive.stages, ['understand', 'plan']);
    assert.deepEqual(directive.workflowSurfaces, expectedSurfaces);
  });
}

for (const [workflow, expectedMode] of NAMED_WORKFLOWS) {
  test(`classifier preserves structured semantics for bare ${workflow}`, () => {
    // Given/When
    const decision = classifyAdaptiveDecision(workflow);

    // Then
    assert.equal(decision.explicitWorkflow, workflow);
    assert.equal(decision.mode, expectedMode);
    assert.equal(decision.snapshot.mode, expectedMode);
    assert.deepEqual(decision.snapshot.stages, decision.stages);
    assert.equal(decision.approval_required, false);
    assert.deepEqual(decision.snapshot.approval, {
      requiredClasses: [],
      status: 'not-required',
    });
    if (workflow === 'lazy-ulw-plan') {
      assert.deepEqual(decision.stages, ['understand', 'plan']);
    }
  });
}

test('equivalent installation and egress request has shared risk policy', () => {
  // Given/When
  const decision = classifyAdaptiveDecision(EQUIVALENT_RISK_REQUEST);

  // Then
  assert.equal(decision.mode, 'orchestrated');
  assert.deepEqual(decision.approval_classes, [
    'install-or-download',
    'remote-data-egress',
  ]);
  assert.equal(decision.approval_required, true);
});
