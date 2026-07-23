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
];

function directiveLines(output) {
  return output.split('\n').filter((line) => line.startsWith('{"lazytraeAdaptive"'));
}

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
