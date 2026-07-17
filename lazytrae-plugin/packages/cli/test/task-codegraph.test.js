const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { indexTaskScoped } = require('../src/lib/task-codegraph');

test('task scoped CodeGraph rejects missing approval and serializes a stale lock without persistent MCP state', async () => {
  // Given: a workspace with a stale index lock and a mock indexer.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-task-codegraph-'));
  const lock = path.join(root, '.codegraph', '.lazytrae-index.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, 'stale');
  const old = new Date(Date.now() - 10 * 60 * 1000);
  fs.utimesSync(lock, old, old);
  let calls = 0;
  try {
    // When: indexing is denied, then allowed against the stale lock.
    const denied = await indexTaskScoped({ workspace: root, approval: { kind: 'prompt-required' }, initialize: async () => { calls += 1; } });
    const allowed = await indexTaskScoped({ workspace: root, approval: { kind: 'allowed' }, initialize: async () => { calls += 1; fs.writeFileSync(path.join(root, '.codegraph', 'codegraph.db'), 'index'); } });

    // Then: only the approved request runs and its temporary lock is removed.
    assert.deepEqual(denied, { status: 'denied', code: 'AUTOMATIC_TOOLING_PERMISSION_DENIED' });
    assert.deepEqual(allowed, { status: 'success', index: path.join(fs.realpathSync(root), '.codegraph', 'codegraph.db'), ownership: 'caller' });
    assert.equal(calls, 1);
    assert.equal(fs.existsSync(lock), false);
    assert.equal(fs.existsSync(path.join(root, '.trae', 'mcp.json')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('task scoped CodeGraph enforces source threshold and removes a newly oversized index', async () => {
  // Given: a workspace whose source count exceeds the request and a quota-limited indexer.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-task-codegraph-limits-'));
  fs.writeFileSync(path.join(root, 'one.js'), 'one');
  fs.writeFileSync(path.join(root, 'two.js'), 'two');
  try {
    // When: the indexer is asked to exceed maxFiles, then writes beyond quota.
    const threshold = await indexTaskScoped({ workspace: root, approval: { kind: 'allowed' }, maxFiles: 1, initialize: async () => { throw new Error('must not run'); } });
    const quota = await indexTaskScoped({ workspace: root, approval: { kind: 'allowed' }, maxFiles: 2, quotaBytes: 1, initialize: async () => fs.writeFileSync(path.join(root, '.codegraph', 'codegraph.db'), 'too-large') });

    // Then: both limits are typed and the generated oversized database is cleaned up.
    assert.deepEqual(threshold, { status: 'unavailable', code: 'AUTOMATIC_TOOLING_INDEX_THRESHOLD_EXCEEDED' });
    assert.deepEqual(quota, { status: 'unavailable', code: 'AUTOMATIC_TOOLING_INDEX_QUOTA_EXCEEDED' });
    assert.equal(fs.existsSync(path.join(root, '.codegraph', 'codegraph.db')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
