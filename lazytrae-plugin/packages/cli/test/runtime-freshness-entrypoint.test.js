'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const CLI = path.resolve(__dirname, '..', 'bin', 'lazytrae.js');
const MCP = path.resolve(__dirname, '..', '..', 'mcp', 'src', 'index.js');

function sha(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function runtimeContext() {
  const binding = {
    plan_hash: sha('plan'), git_head: 'a'.repeat(40), package_version: '1.2.1',
    task_namespace: 'task-10', capability_fingerprint: sha('capability'),
    context_digest: sha('context'),
  };
  const summary = { next_action: 'continue targeted criterion' };
  const context_state = 'fresh-handoff';
  return {
    current: binding,
    handoff: {
      schema_version: 'lazyseries.handoff-snapshot.v1', binding, context_state, summary,
      snapshot_sha256: sha(JSON.stringify({ binding, context_state, summary })),
    },
    capacity: { available: true },
  };
}

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-runtime-entry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q', root]);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'fixture\n');
  spawnSync('git', ['-C', root, 'add', 'tracked.txt']);
  spawnSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=f@example.invalid', 'commit', '-qm', 'fixture']);
  return root;
}

function run(root, context) {
  const contextPath = path.join(root, 'runtime-context.json');
  fs.writeFileSync(contextPath, JSON.stringify(context));
  const completed = spawnSync(process.execPath, [CLI, '--root', root, 'run', '--runtime-context', contextPath, 'Fix the bounded task.'], { encoding: 'utf8' });
  assert.equal(completed.status, 0, completed.stderr);
  return JSON.parse(completed.stdout.split('\n').find(line => line.startsWith('{')));
}

test('shipped run command resumes fresh handoff without replay', t => {
  const output = run(project(t), runtimeContext()).lazytraeAdaptive;
  assert.equal(output.continuation.status, 'resumed');
  assert.equal(output.continuation.replay_required, false);
});

test('shipped run command blocks every stale binding and compressed context', t => {
  const root = project(t);
  for (const field of ['plan_hash', 'git_head', 'package_version', 'task_namespace', 'capability_fingerprint', 'context_digest']) {
    const context = runtimeContext();
    context.current[field] += '-stale';
    const output = run(root, context).lazytraeAdaptive;
    assert.equal(output.dispatch, 'blocked:stale-context', field);
    assert.equal(output.continuation.requires_handoff_snapshot, true, field);
  }
  const cached = runtimeContext();
  cached.handoff.context_state = 'compressed-session-cache';
  assert.equal(run(root, cached).lazytraeAdaptive.dispatch, 'blocked:stale-context');
});

test('shipped run command blocks quota before presenting ready work', t => {
  const context = runtimeContext();
  context.capacity = { available: false, reason: 'quota-denied' };
  const output = run(project(t), context).lazytraeAdaptive;
  assert.equal(output.dispatch, 'blocked:capacity');
  assert.equal(output.continuation.completion, 'blocked');
});

test('shipped MCP namespaces evidence, blocks collision, escalates repeated flake, and blocks quota', t => {
  const root = project(t);
  const base = { gate_type: 'manual_qa', task_namespace: 'task-10', criterion_id: 'criterion-a', worker_id: 'worker-a', evidence_name: 'result.log', verdict: 'pass', notes: 'first', capacity: { available: true } };
  const calls = [
    base,
    { ...base, notes: 'overwrite' },
    { ...base, evidence_name: 'flake.log', verdict: 'fail', flake_assertion: 'same assertion', notes: 'failure one' },
    { ...base, evidence_name: 'flake.log', verdict: 'fail', flake_assertion: 'same assertion', notes: 'failure two' },
    { ...base, evidence_name: 'quota.log', capacity: { available: false, reason: 'quota-denied' } },
  ].map((arguments_, index) => JSON.stringify({ jsonrpc: '2.0', id: index + 1, method: 'tools/call', params: { name: 'lazytrae.record_evidence', arguments: arguments_ } }));
  const completed = spawnSync(process.execPath, [MCP], { cwd: root, input: calls.join('\n') + '\n', encoding: 'utf8' });
  assert.equal(completed.status, 0, completed.stderr);
  const responses = completed.stdout.trim().split('\n').map(JSON.parse);
  assert.match(responses[0].result.content[0].text, /task-10.*criterion-a.*worker-a/);
  assert.match(responses[1].error.message, /EVIDENCE_NAME_COLLISION/);
  assert.match(responses[2].result.content[0].text, /retryable/);
  assert.match(responses[3].result.content[0].text, /comprehensive/);
  assert.match(responses[4].result.content[0].text, /quota-denied/);
});
