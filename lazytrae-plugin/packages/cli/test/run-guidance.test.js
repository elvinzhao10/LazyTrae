'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const { makeGitFixture, runCli } = require('./test-helpers');

test('run guidance omits global runner commands and directs users to TraeCode', (t) => {
  // Given: an initialized project without a trae-agent executable on PATH.
  const root = makeGitFixture('lazytrae-run-guidance-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // When: the real run command falls back to guidance-only execution.
  const result = runCli(['run', '--agent', 'atlas', '--category', 'quick', 'Repair one test.'], {
    cwd: root,
    env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
  });

  // Then: it supplies the supported project-local IDE route without global package guidance.
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Open TraeCode in this project\./);
  assert.match(result.stdout, /Continue with the project-local TraeCode route above\./);
  assert.doesNotMatch(result.stdout, /npm install -g trae-agent|npx trae-agent/);
});
