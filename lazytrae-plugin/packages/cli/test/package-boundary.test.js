const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT, makeFixture, runCli } = require('./test-helpers');

const OPERATIONAL_FILES = [
  'packages/cli/src/commands/run.js',
  'packages/cli/src/lib/parity-check.js',
  'packages/cli/src/mcp/parity.js',
  'packages/cli/src/mcp/tool-defs.js',
  'packages/mcp/src/parity.js',
  'packages/mcp/src/tool-defs.js',
  'packages/cli/templates/hooks.json',
  '.trae/hooks.json',
  'packages/cli/templates/skills/lazy-librarian/SKILL.md',
  '.trae/skills/lazy-librarian/SKILL.md',
];

test('installed LazyTrae operations do not require repository docs or dev directories', () => {
  // Given: a consumer repository created exclusively from packaged templates.
  const fixture = makeFixture('lazytrae-no-parent-docs-');

  try {
    // When: the operational lifecycle runs without consumer docs or dev directories.
    fs.rmSync(path.join(fixture, 'docs'), { recursive: true, force: true });
    fs.rmSync(path.join(fixture, 'dev'), { recursive: true, force: true });
    const doctor = runCli(['doctor'], { cwd: fixture });
    const verify = runCli(['verify'], { cwd: fixture });
    const sync = runCli(['sync'], { cwd: fixture });

    // Then: every command succeeds without a parent documentation dependency.
    assert.equal(doctor.status, 0, doctor.stdout);
    assert.equal(verify.status, 0, verify.stdout);
    assert.equal(sync.status, 0, sync.stdout);

    for (const relativePath of OPERATIONAL_FILES) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      assert.doesNotMatch(source, /docs\/lazytrae-|\.\.\/docs|\.\.\/dev/, relativePath);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
