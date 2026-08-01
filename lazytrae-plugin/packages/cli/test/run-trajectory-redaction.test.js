'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { makeGitFixture, runCli } = require('./test-helpers');

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

test('run trajectory retains routing metadata without persisting the raw prompt', () => {
  // Given: an installed project and a distinctive secret-like prompt.
  const root = makeGitFixture('lazytrae-run-trajectory-redaction-');
  const prompt = 'sk_live_LT_TRAJECTORY_SECRET_7c91d8a4';

  try {
    // When: the CLI records its guidance-only trajectory entry.
    const result = runCli(['run', '--agent', 'atlas', '--category', 'quick', prompt], {
      cwd: root,
      env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
    });

    // Then: only a digest and non-sensitive execution metadata are persisted.
    assert.equal(result.status, 0, result.stderr);
    const lines = fs.readFileSync(
      path.join(root, '.lazytrae', 'logs', 'trajectory.ndjson'),
      'utf8',
    ).trim().split('\n');
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(JSON.stringify(entry).includes(prompt), false, 'trajectory entry persisted raw prompt bytes');
    assert.equal(Object.hasOwn(entry, 'prompt'), false);
    assert.equal(entry.prompt_digest, digest(prompt));
    assert.deepEqual({
      agent: entry.agent,
      category: entry.category,
      runner_used: entry.runner_used,
      status: entry.status,
    }, {
      agent: 'atlas',
      category: 'quick',
      runner_used: false,
      status: 'guidance_only',
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
