const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeFixture, runCli } = require('./test-helpers');

test('post-tool-use emits matching dynamic rule guidance for a changed file', () => {
  // Given: an installed project rule that matches a real changed TypeScript file.
  const fixture = makeFixture('lazytrae-dynamic-rules-');
  const changedFile = path.join(fixture, 'src', 'dynamic-rule-target.ts');
  const rulePath = path.join(fixture, '.trae', 'rules', 'ts.md');
  fs.mkdirSync(path.dirname(changedFile), { recursive: true });
  fs.writeFileSync(changedFile, 'export const dynamicRuleTarget = true;\n');
  fs.writeFileSync(rulePath, 'Review TypeScript changes.\n');

  try {
    // When: the real post-tool-use dispatcher receives the Write event.
    const result = runCli(['hook', 'post-tool-use'], {
      cwd: fixture,
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { filePath: 'src/dynamic-rule-target.ts' },
      }),
    });

    // Then: the companion dynamic-rules script surfaces the matching guidance.
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[LazyTrae\] Dynamic rules matched:.*ts/);
    assert.match(result.stdout, /\[LazyTrae\] Review relevant rules before proceeding with changes\./);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
