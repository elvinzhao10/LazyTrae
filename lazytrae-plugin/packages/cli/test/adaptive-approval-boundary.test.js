'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { makeFixture } = require('./test-helpers');

const CASES = [
  ['Use Playwright to automate the browser.', 'browser-or-desktop-control'],
  ['Add an MCP connector to the host settings.', 'host-mcp-settings-mutation'],
  ['Configure the MCP settings.', 'host-mcp-settings-mutation'],
  ['Rotate the CI deploy token before the release.', 'credentials-auth-or-paid-service'],
  ['Push the repository changes to origin main.', 'remote-data-egress'],
  ['Push changes to feature/release-1.0.3.', 'remote-data-egress'],
  ['Push the branch release/v1 to GitHub.', 'remote-data-egress'],
  ['Delete the deploy token.', 'credentials-auth-or-paid-service'],
  ['Update the CI secret.', 'credentials-auth-or-paid-service'],
];

function directiveLines(output) {
  return output.split('\n').filter((line) => line.startsWith('{"lazytraeAdaptive"'));
}

test('discussion of credentials without a concrete action does not require approval', () => {
  const decision = classifyAdaptiveDecision('Document the secret rotation policy.');
  assert.deepEqual(decision.approval_classes, []);
  assert.equal(decision.approval_required, false);
});

test('approval negation is local to the requested action', () => {
  for (const [prompt, expected] of [
    ['Never push changes to origin main.', []],
    ['Do not push changes to origin main.', []],
    ['Push changes to origin main. Do not send logs.', ['remote-data-egress']],
    ['Do not send logs then push changes upstream.', ['remote-data-egress']],
    ['Never rotate the token. Update the CI secret.', ['credentials-auth-or-paid-service']],
    ['Do not update documentation then rotate the deploy token.', ['credentials-auth-or-paid-service']],
    ['Do not push changes to origin main, but push the release branch to GitHub.', ['remote-data-egress']],
    ['Never delete the old deploy token; update the CI secret.', ['credentials-auth-or-paid-service']],
  ]) {
    assert.deepEqual(classifyAdaptiveDecision(prompt).approval_classes, expected);
  }
});

test('credential discussions and arbitrary Git push targets preserve the approval boundary', () => {
  assert.deepEqual(classifyAdaptiveDecision('Discuss how to rotate credentials.').approval_classes, []);
  assert.deepEqual(classifyAdaptiveDecision('Explain how to rotate the deploy token.').approval_classes, []);
  assert.deepEqual(classifyAdaptiveDecision('Git push upstream feature/foo.').approval_classes, ['remote-data-egress']);
  assert.deepEqual(classifyAdaptiveDecision('Push feature/foo.').approval_classes, ['remote-data-egress']);
  assert.deepEqual(classifyAdaptiveDecision('Please explain how to push a repository to origin main.').approval_classes, []);
  assert.deepEqual(classifyAdaptiveDecision('Review the changes and push the branch to GitHub.').approval_classes, ['remote-data-egress']);
  assert.deepEqual(classifyAdaptiveDecision('Discuss the rollout and rotate the deploy token.').approval_classes, ['credentials-auth-or-paid-service']);
  assert.deepEqual(classifyAdaptiveDecision('Please review the plan and rotate the deploy token.').approval_classes, ['credentials-auth-or-paid-service']);
  assert.deepEqual(classifyAdaptiveDecision('Discuss how to push feature/foo and then push release/bar.').approval_classes, ['remote-data-egress']);
  assert.deepEqual(classifyAdaptiveDecision('Push origin main.').approval_classes, ['remote-data-egress']);
  assert.deepEqual(classifyAdaptiveDecision('Push main.').approval_classes, ['remote-data-egress']);
  assert.deepEqual(classifyAdaptiveDecision('Push a button to production.').approval_classes, []);
  assert.deepEqual(classifyAdaptiveDecision('Push a notification to production.').approval_classes, []);
});

for (const [prompt, expectedClass] of CASES) {
  test(`${expectedClass} classifies concrete action: ${prompt}`, () => {
    // Given/When
    const decision = classifyAdaptiveDecision(prompt);

    // Then
    assert.deepEqual(decision.approval_classes, [expectedClass]);
    assert.equal(decision.approval_required, true);
    assert.deepEqual(decision.authority_boundary.approval_required, [expectedClass]);
  });

  test(`installed hook blocks concrete approval action: ${prompt}`, (t) => {
    // Given
    const root = makeFixture('lazytrae-adaptive-concrete-approval-');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    // When
    const result = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
      cwd: root,
      input: JSON.stringify({ prompt }),
      encoding: 'utf8',
    });

    // Then
    assert.equal(result.status, 0, result.stderr);
    assert.equal(directiveLines(result.stdout).length, 1);
    const directive = JSON.parse(directiveLines(result.stdout)[0]).lazytraeAdaptive;
    assert.equal(directive.dispatch, 'blocked:approval-required');
    assert.deepEqual(directive.approval.requiredClasses, [expectedClass]);
    assert.deepEqual(directive.workflowSurfaces, []);
  });
}
