'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { deriveContextCapsule } = require('../src/lib/context-capsule');
const { runCli } = require('./test-helpers');

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function nativeState() {
  return {
    boulder: {
      schema_version: 2,
      active_work_id: 'work-1',
      works: {
        'work-1': {
          work_id: 'work-1',
          objective: 'Ship the bounded change',
          active_plan: '.lazytrae/plans/release.md',
          plan_revision: digest('plan-v2'),
          tasks: [
            { id: 'task-1', description: 'Finished setup', status: 'complete', evidence_paths: ['.lazytrae/evidence/setup.txt'] },
            {
              id: 'task-2', description: 'Implement the bounded change', status: 'in_progress',
              owned_paths: ['src/feature.js'], criteria: ['focused tests pass'], plan_section: 'Todo 2',
              commands: ['node --test test/feature.test.js'], manual_qa_surface: 'cli',
            },
          ],
          blockers: [],
        },
      },
    },
    loop: {
      run_id: 'run-1', loop_state: 'active', active_goal_id: 'goal-2',
      adaptive: {
        requestDigest: digest('Implement the bounded change'),
        revisionFingerprint: { status: 'available', digest: digest('head') },
        scopeFingerprint: digest('scope'),
      },
      checkpoints: [{ id: 'cp-1', status: 'complete', summary: 'Setup accepted.', evidence_paths: ['.lazytrae/evidence/setup.txt'] }],
      review_blockers: [],
    },
    sessions: { current_session_id: 'session-1' },
    evidenceFiles: ['setup.txt', 'unrelated-long-history.md'],
  };
}

test('automatic intensity chooses the lowest sufficient workflow without model-specific policy', () => {
  // Given: ordinary, bounded complex, and materially risky requests.
  const requests = [
    ['Fix one typo in README.md.', {}, 'direct'],
    ['Implement the parser across the API, state, and CLI modules.', { scope: 'broad' }, 'planned'],
    ['Change authorization handling for the release.', {}, 'orchestrated'],
  ];

  // When/Then: the semantic mode is driven by task signals and is model invariant.
  for (const [prompt, context, expected] of requests) {
    const stronger = classifyAdaptiveDecision(prompt, { ...context, model: 'stronger-model' });
    const weaker = classifyAdaptiveDecision(prompt, { ...context, model: 'weaker-model' });
    assert.equal(stronger.mode, expected);
    assert.deepEqual(weaker, stronger);
  }
});

test('native context capsule is bounded, complete, and contains accepted boundaries only', () => {
  // Given: verbose native Boulder, loop, session, and evidence state.
  const state = nativeState();
  const rawBytes = Buffer.byteLength(JSON.stringify(state));

  // When: the disposable current-task capsule is derived.
  const result = deriveContextCapsule(state);
  const packetBytes = Buffer.byteLength(JSON.stringify(result.capsule));

  // Then: required dispatch fields survive without replaying unrelated history.
  assert.equal(result.status, 'current');
  assert.deepEqual(result.capsule.identity, {
    work_id: 'work-1', run_id: 'run-1', task_id: 'task-2',
    request_digest: digest('Implement the bounded change'),
    revision_fingerprint: { status: 'available', digest: digest('head') },
    scope_fingerprint: digest('scope'), plan_revision: digest('plan-v2'),
  });
  assert.deepEqual(result.capsule.owned_paths, ['src/feature.js']);
  assert.deepEqual(result.capsule.criteria, ['focused tests pass']);
  assert.deepEqual(result.capsule.commands, ['node --test test/feature.test.js']);
  assert.deepEqual(result.capsule.accepted_boundaries, [{
    id: 'cp-1', summary: 'Setup accepted.', evidence_paths: ['.lazytrae/evidence/setup.txt'],
  }]);
  assert.deepEqual(result.capsule.evidence_pointers, ['.lazytrae/evidence/setup.txt']);
  assert.equal(JSON.stringify(result.capsule).includes('unrelated-long-history'), false);
  assert.ok(packetBytes < rawBytes, `${packetBytes} must be smaller than ${rawBytes}`);
});

test('native context capsule selects current active work before queued pending work', () => {
  // Given: a queued future task appears before an in-progress or blocked current task.
  for (const currentStatus of ['in_progress', 'blocked']) {
    const state = nativeState();
    state.boulder.works['work-1'].tasks[1].status = currentStatus;
    state.boulder.works['work-1'].tasks.unshift({
      id: 'task-future', description: 'Queued follow-up', status: 'pending',
    });

    // When: current context is derived from native task order.
    const result = deriveContextCapsule(state);

    // Then: the active task is selected instead of the earlier queue entry.
    assert.equal(result.capsule.identity.task_id, 'task-2', currentStatus);
  }
});

test('post-compaction identity comparison ignores object key order', () => {
  // Given: the same required identity fields arrive in a different serialization order.
  const state = nativeState();
  const current = deriveContextCapsule(state);
  const identity = current.capsule.identity;
  const reordered = {
    plan_revision: identity.plan_revision,
    scope_fingerprint: identity.scope_fingerprint,
    revision_fingerprint: {
      digest: identity.revision_fingerprint.digest,
      status: identity.revision_fingerprint.status,
    },
    request_digest: identity.request_digest,
    task_id: identity.task_id,
    run_id: identity.run_id,
    work_id: identity.work_id,
  };

  // When: post-compaction reuse compares the reordered identity.
  const result = deriveContextCapsule(state, reordered);

  // Then: semantic equality resumes rather than reporting stale context.
  assert.equal(result.status, 'resumed');
  assert.equal(result.capsule.identity.task_id, 'task-2');
});

test('post-compaction reuse rejects every stale identity and malformed native state', () => {
  // Given: one current capsule identity.
  const state = nativeState();
  const current = deriveContextCapsule(state);
  assert.equal(current.status, 'current');

  // When/Then: exact identity resumes, while every material mismatch is diagnostic only.
  assert.equal(deriveContextCapsule(state, current.capsule.identity).status, 'resumed');
  for (const field of ['work_id', 'run_id', 'task_id', 'request_digest', 'revision_fingerprint', 'scope_fingerprint', 'plan_revision']) {
    const expected = structuredClone(current.capsule.identity);
    expected[field] = field === 'revision_fingerprint'
      ? { status: 'available', digest: digest('changed') }
      : `${expected[field]}-changed`;
    const stale = deriveContextCapsule(state, expected);
    assert.equal(stale.status, 'stale', field);
    assert.equal(stale.capsule, null, field);
  }
  assert.equal(deriveContextCapsule({ ...state, boulder: '{bad' }).status, 'malformed');
});

test('handoff CLI emits the bounded capsule through the native session adapter', (t) => {
  // Given: current identity-bound native state in a real project entry path.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v122-handoff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.git'));
  const state = nativeState();
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  for (const [name, value] of [
    ['boulder.json', state.boulder], ['active-loop.json', state.loop], ['sessions.json', state.sessions],
  ]) fs.writeFileSync(path.join(root, '.lazytrae', 'state', name), `${JSON.stringify(value)}\n`);

  // When: the public handoff adapter renders JSON.
  const result = runCli(['handoff', '--json'], { cwd: root });
  const handoff = JSON.parse(result.stdout);

  // Then: it presents current bounded context without claiming host execution.
  assert.equal(result.status, 0);
  assert.equal(handoff.contextStatus, 'current');
  assert.equal(handoff.contextCapsule.identity.task_id, 'task-2');
  assert.deepEqual(JSON.parse(handoff.nextPrompt), handoff.contextCapsule);
  assert.equal(Object.hasOwn(handoff.contextCapsule, 'hostExecution'), false);
});
