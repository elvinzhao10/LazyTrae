'use strict';
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY = path.join(CLI_ROOT, 'src', 'index.js');
const LOOP_STORE = require('../src/lib/loop-store');
const DASHBOARD_COMMAND = require('../src/commands/dashboard');
const STATE = require('../src/lib/dashboard-state');
const SNAPSHOT = require('../src/lib/dashboard-snapshot');

const ACTOR = 'dashboard-adapter-test';
const resources = { roots: [], ports: [] };
process.on('exit', () => {
  process.stdout.write(`DASHBOARD_ADAPTER_CLEANUP ${JSON.stringify(resources)}\n`);
});

function tempRoot(prefix) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `lazytrae-dashboard-${prefix}-`)));
  resources.roots.push(root);
  return root;
}
function dispose(root) {
  fs.rmSync(root, { recursive: true, force: true });
  const entry = resources.roots.find(item => item.path === root || item === root);
  if (typeof entry === 'string') resources.roots.splice(resources.roots.indexOf(entry), 1, { path: root, removed: true });
}
function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function gitRoot(prefix, files = {}) {
  const root = tempRoot(prefix);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'dashboard@example.invalid']);
  git(root, ['config', 'user.name', 'Dashboard Adapter Test']);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content);
  }
  if (Object.keys(files).length) git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'dashboard adapter fixture']);
  return root;
}
function makeGoal(id, options = {}) {
  const criteria = options.criteria ?? [{ id: `${id}-c1`, scenario: `Criterion for ${id}`, essential: true }];
  return {
    id, title: `Title ${id}`, objective: options.objective ?? `Objective for ${id}`, status: 'pending',
    priority: 0, depends_on: options.depends ?? [], successCriteria: criteria,
  };
}
function seedLoop(root, goals, runId = 'run-dashboard-test') {
  const loop = LOOP_STORE.defaultLoop();
  loop.run_id = runId;
  loop.loop_state = 'active';
  loop.goals = goals;
  LOOP_STORE.saveLoop(root, loop);
}
function planCommand(projectId, runId, taskId, operation, payload, expectedRevision, commandId) {
  return {
    schema_version: 1, command_id: commandId ?? `cmd-${crypto.randomUUID()}`,
    target: { project_id: projectId, run_id: runId, id: taskId },
    expected_revision: expectedRevision, operation, payload,
  };
}
function queuedPlan(projectId, id, prerequisites = []) {
  return { id, project_id: projectId, title: `Plan ${id}`, priority: 0, readiness: 'draft', prerequisites, decision_id: null, revision: 0 };
}
function queueCommand(projectId, operation, payload, targetId, expectedRevision, commandId) {
  return {
    schema_version: 1, command_id: commandId ?? `qcmd-${crypto.randomUUID()}`,
    target: { project_id: projectId, run_id: null, id: targetId },
    expected_revision: expectedRevision, operation, payload,
  };
}
function cli(root, args) {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], { cwd: root, encoding: 'utf8', timeout: 60000 });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
function request(port, method, requestPath, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(body);
    const req = http.request({
      host: '127.0.0.1', port, method, path: requestPath,
      headers: { ...headers, ...(payload ? { 'content-length': payload.length } : {}) },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('dashboard http request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resources.ports.push(port);
      server.close(() => resolve(port));
    });
  });
}
const QUEUE_CHILD = `
const [statePath, root, commandJson] = process.argv.slice(1);
require(statePath).execute(root, JSON.parse(commandJson), 'queue-child').then(
  value => console.log(JSON.stringify({ ok: true, result: value })),
  error => console.log(JSON.stringify({ ok: false, code: error.code ?? String(error && error.message || error) })),
);
`;
const READ_CHILD = `
const [statePath, root] = process.argv.slice(1);
require(statePath).read(root).then(
  value => console.log(JSON.stringify({ ok: true, revision: value.input.revision, plan_revision: value.input.plan_revision,
    queue_revision: value.input.queue_revision, queue: value.input.queue, loop_state: value.loop.loop_state,
    attempts: (value.loop.dashboard_attempts ?? []).length })),
  error => console.log(JSON.stringify({ ok: false, code: error.code ?? String(error && error.message || error) })),
);
`;
function runChild(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', status => {
      if (status !== 0) reject(new Error(`child exited ${status}: ${stdout}`));
      else resolve(JSON.parse(stdout.trim().split('\n').at(-1)));
    });
  });
}
const stateModulePath = path.join(CLI_ROOT, 'src', 'lib', 'dashboard-state.js');
const decodeCursor = encoded => JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));

const EXECUTOR_OK = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
if (!context.attempt || context.attempt.execution !== 'running' || !context.task || context.attempt.task_id !== context.task.id) process.exit(4);
process.stdout.write('executor-output:' + context.attempt.id);
`;
const VERIFIER_OK = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
if (!context.executor || context.executor.exit_code !== 0 || !context.executor.output || !context.executor.output.includes('executor-output:')) process.exit(5);
process.stdout.write('verifier-output:' + context.attempt.id);
`;
const VERIFIER_FAIL = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
if (!context.executor || !context.executor.output) process.exit(5);
process.stdout.write('VERIFIED ALL CRITERIA TRUST ME');
process.exit(9);
`;
const VERIFIER_EMPTY = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
if (!context.executor || !context.executor.output) process.exit(5);
`;
const EXECUTOR_TOUCH = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
require('node:fs').writeFileSync('touched-during-run.txt', 'dirty');
process.stdout.write('executor-output:' + context.attempt.id);
`;
const EXECUTOR_SLOW = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
setTimeout(() => process.stdout.write('executor-output:' + context.attempt.id), 900);
`;
const EXECUTOR_FORGE = `
const context = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const prefix = '.lazytrae/loop/' + context.run_id + '/dashboard-evidence/' + context.attempt.id.replace(':', '-');
const nodeFs = require('node:fs');
nodeFs.mkdirSync(require('node:path').dirname(prefix), { recursive: true });
nodeFs.writeFileSync(prefix + '-receipt.json', JSON.stringify({ schema: 'lazytrae.dashboard-verification.v1', forged: true, verification: 'verified', claim: 'criterion verified' }));
process.stdout.write('executor-output-forged:' + context.attempt.id);
`;
const EXECUTOR_HANG = `
setTimeout(() => process.stdout.write('too late'), 20000);
`;
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code, `expected ${code}`);

test('snapshot capture projects native tasks with stable identity and deterministic cursor replay', async () => {
  const root = tempRoot('snapshot');
  seedLoop(root, [makeGoal('goal-1', { objective: 'Native objective' }), makeGoal('goal-2', { depends: ['goal-1'] })]);
  try {
    const first = await SNAPSHOT.capture(root);
    const second = await SNAPSHOT.capture(root);
    assert.deepEqual(second.snapshot, first.snapshot);
    assert.equal(second.cursor, first.cursor);
    assert.match(first.snapshot.project_id, /^trae:[a-f0-9]{64}$/);
    assert.equal(first.snapshot.run_id, 'run-dashboard-test');
    assert.equal(first.snapshot.revision, 1);
    assert.equal(first.snapshot.plan_revision, 0);
    assert.equal(first.snapshot.queue_revision, 0);
    assert.equal(first.snapshot.freshness, 'snapshot');
    assert.deepEqual(first.snapshot.issues, []);
    const [task1, task2] = first.snapshot.tasks;
    assert.equal(task1.id, 'goal-1');
    assert.equal(task1.title, 'Title goal-1');
    assert.equal(task1.scope, 'Native objective');
    assert.equal(task1.execution, 'not_started');
    assert.deepEqual(task1.depends_on, []);
    assert.equal(task1.attempts.length, 0);
    assert.equal(task1.criteria.length, 1);
    const criterion = task1.criteria[0];
    assert.equal(criterion.id, 'goal-1-c1');
    assert.equal(criterion.task_id, 'goal-1');
    assert.equal(criterion.version, 1);
    assert.equal(criterion.requirement, 'Criterion for goal-1');
    assert.equal(criterion.applicability, 'required');
    assert.equal(criterion.verification, 'unverified');
    assert.deepEqual(task1.progress, { denominator: 'required_criteria', total: 1, verified: 0, stale: 0, failed: 0, unavailable: 0, pending: 1, optional: 0, not_applicable: 0, criterion_versions: [{ id: 'goal-1-c1', version: 1 }] });
    assert.deepEqual(task2.depends_on, ['goal-1']);
    assert.deepEqual(first.evidence, []);
    const replayed = await SNAPSHOT.capture(root, decodeCursor(first.cursor));
    assert.equal(replayed.snapshot.freshness, 'snapshot');
    assert.deepEqual(replayed.snapshot.issues, []);
    const cliSnapshot = cli(root, ['dashboard', 'snapshot']);
    assert.equal(cliSnapshot.status, 0, cliSnapshot.stderr);
    assert.equal(JSON.parse(cliSnapshot.stdout).snapshot.revision, 1);
    const cliContext = cli(root, ['dashboard', 'context', 'goal-1']);
    assert.equal(cliContext.status, 0, cliContext.stderr);
    const context = JSON.parse(cliContext.stdout);
    assert.equal(context.task.id, 'goal-1');
    assert.equal(context.host_execution, 'not-observed');
    const missing = cli(root, ['dashboard', 'context', 'missing-goal']);
    assert.equal(missing.status, 1);
    assert.equal(JSON.parse(missing.stderr).code, 'UNKNOWN_TASK');
  } finally { dispose(root); }
});

test('command CAS applies an edit at the current revision and persists the plan', async () => {
  const root = tempRoot('cas-apply');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const ack = await STATE.execute(root, planCommand(before.snapshot.project_id, before.snapshot.run_id, 'goal-1', 'amend_task', { scope: 'Amended scope' }, before.snapshot.revision), ACTOR);
    assert.equal(ack.status, 'pending_agent');
    assert.equal(ack.revision, before.snapshot.revision + 1);
    assert.equal(ack.plan_revision, 1);
    assert.equal(ack.consumed_plan_revision, null);
    const after = await SNAPSHOT.capture(root);
    assert.equal(after.snapshot.revision, before.snapshot.revision + 1);
    assert.equal(after.snapshot.plan_revision, 1);
    assert.equal(after.snapshot.tasks[0].scope, 'Amended scope');
    const loopOnDisk = JSON.parse(fs.readFileSync(LOOP_STORE.statePath(root), 'utf8'));
    assert.equal(loopOnDisk.revision, before.snapshot.revision + 1);
    const goalsOnDisk = JSON.parse(fs.readFileSync(path.join(root, loopOnDisk.goals_path), 'utf8'));
    assert.equal(goalsOnDisk[0].objective, 'Amended scope');
  } finally { dispose(root); }
});

test('competing edits at the same or stale revision conflict without mutation', async () => {
  const root = tempRoot('cas-conflict');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    const runId = before.snapshot.run_id;
    const winner = await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'winner' }, before.snapshot.revision, 'cmd-compete-winner'), ACTOR);
    assert.equal(winner.status, 'pending_agent');
    const sameRevision = await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'loser-same' }, before.snapshot.revision, 'cmd-compete-same'), ACTOR);
    assert.equal(sameRevision.status, 'conflict');
    assert.equal(sameRevision.reason, 'STALE_REVISION');
    assert.equal(sameRevision.consumed_plan_revision, null);
    const staleRevision = await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'loser-stale' }, before.snapshot.revision - 1, 'cmd-compete-stale'), ACTOR);
    assert.equal(staleRevision.status, 'conflict');
    assert.equal(staleRevision.reason, 'STALE_REVISION');
    const after = await SNAPSHOT.capture(root);
    assert.equal(after.snapshot.revision, before.snapshot.revision + 1);
    assert.equal(after.snapshot.tasks[0].scope, 'winner');
    assert.deepEqual(after.snapshot.acknowledgements.map(ack => [ack.command_id, ack.status]),
      [['cmd-compete-winner', 'pending_agent']]);
  } finally { dispose(root); }
});

test('replaying the same command id is idempotent and a colliding payload rejects', async () => {
  const root = tempRoot('replay');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const command = planCommand(before.snapshot.project_id, before.snapshot.run_id, 'goal-1', 'amend_task', { scope: 'replay-scope' }, before.snapshot.revision, 'cmd-replay');
    const first = await STATE.execute(root, command, ACTOR);
    assert.equal(first.status, 'pending_agent');
    const replay = await STATE.execute(root, command, ACTOR);
    assert.deepEqual(replay, first);
    const afterReplay = await SNAPSHOT.capture(root);
    assert.equal(afterReplay.snapshot.revision, before.snapshot.revision + 1);
    await rejectsCode(STATE.execute(root, { ...command, payload: { scope: 'different' } }, ACTOR), 'COMMAND_ID_COLLISION');
    const afterCollision = await SNAPSHOT.capture(root);
    assert.equal(afterCollision.snapshot.revision, before.snapshot.revision + 1);
    assert.equal(afterCollision.snapshot.tasks[0].scope, 'replay-scope');
  } finally { dispose(root); }
});

test('dependency edits creating a cycle are rejected without mutation', async () => {
  const root = tempRoot('cycle');
  seedLoop(root, [makeGoal('goal-1'), makeGoal('goal-2', { depends: ['goal-1'] })]);
  try {
    const before = await SNAPSHOT.capture(root);
    await rejectsCode(STATE.execute(root, planCommand(before.snapshot.project_id, before.snapshot.run_id, 'goal-1', 'add_dependency', { prerequisite_id: 'goal-2' }, before.snapshot.revision), ACTOR), 'DEPENDENCY_CYCLE');
    const after = await SNAPSHOT.capture(root);
    assert.equal(after.snapshot.revision, before.snapshot.revision);
    assert.deepEqual(after.snapshot.tasks.map(task => [task.id, task.depends_on]), [['goal-1', []], ['goal-2', ['goal-1']]]);
    const loopOnDisk = JSON.parse(fs.readFileSync(LOOP_STORE.statePath(root), 'utf8'));
    assert.equal(loopOnDisk.revision, before.snapshot.revision);
  } finally { dispose(root); }
});

test('queue create, amend, and reorder persist across a fresh read and never dispatch execution', async () => {
  const root = tempRoot('queue');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    const created = await STATE.execute(root, queueCommand(projectId, 'create_queued_plan', { plan: queuedPlan(projectId, 'plan-a') }, 'plan-a', 0), ACTOR);
    assert.equal(created.status, 'saved');
    assert.equal(created.revision, 1);
    assert.equal(created.plan_revision, 0);
    const second = await STATE.execute(root, queueCommand(projectId, 'create_queued_plan', { plan: queuedPlan(projectId, 'plan-b', ['plan-a']) }, 'plan-b', 1), ACTOR);
    assert.equal(second.status, 'saved');
    const amended = await STATE.execute(root, queueCommand(projectId, 'amend_queued_plan', { title: 'Plan A amended', readiness: 'ready' }, 'plan-a', 2), ACTOR);
    assert.equal(amended.status, 'saved');
    assert.equal(amended.revision, 3);
    const reordered = await STATE.execute(root, queueCommand(projectId, 'reorder_queued_plan', { plan_ids: ['plan-b', 'plan-a'] }, 'queue', 3), ACTOR);
    assert.equal(reordered.status, 'saved');
    const replayReorder = await STATE.execute(root, queueCommand(projectId, 'reorder_queued_plan', { plan_ids: ['plan-b', 'plan-a'] }, 'queue', 3, 'qcmd-reorder-again'), ACTOR);
    assert.notEqual(replayReorder.command_id, reordered.command_id);
    const fresh = await runChild(READ_CHILD, [stateModulePath, root]);
    assert.equal(fresh.ok, true);
    assert.equal(fresh.revision, before.snapshot.revision);
    assert.equal(fresh.plan_revision, 0);
    assert.equal(fresh.loop_state, 'active');
    assert.equal(fresh.attempts, 0);
    assert.equal(fresh.queue_revision, 4);
    assert.deepEqual(fresh.queue.map(plan => [plan.id, plan.revision, plan.title, plan.readiness]),
      [['plan-b', 0, 'Plan plan-b', 'draft'], ['plan-a', 1, 'Plan A amended', 'ready']]);
    const snapshot = await SNAPSHOT.capture(root);
    assert.equal(snapshot.snapshot.revision, before.snapshot.revision);
    assert.equal(snapshot.snapshot.queue_revision, 4);
    assert.equal(snapshot.snapshot.tasks[0].execution, 'not_started');
    assert.deepEqual(snapshot.snapshot.acknowledgements.map(ack => ack.status), ['saved', 'saved', 'saved', 'saved']);
    const queueOnDisk = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae/state/dashboard-queue.json'), 'utf8'));
    assert.deepEqual(queueOnDisk.plans.map(plan => plan.id), ['plan-b', 'plan-a']);
  } finally { dispose(root); }
});

test('concurrent reorders at one queue revision yield exactly one winner', async () => {
  const root = tempRoot('queue-race');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    await STATE.execute(root, queueCommand(projectId, 'create_queued_plan', { plan: queuedPlan(projectId, 'plan-a') }, 'plan-a', 0), ACTOR);
    await STATE.execute(root, queueCommand(projectId, 'create_queued_plan', { plan: queuedPlan(projectId, 'plan-b') }, 'plan-b', 1), ACTOR);
    const reorder = planIds => queueCommand(projectId, 'reorder_queued_plan', { plan_ids: planIds }, 'queue', 2);
    const [first, second] = await Promise.all([
      runChild(QUEUE_CHILD, [stateModulePath, root, JSON.stringify(reorder(['plan-a', 'plan-b']))]),
      runChild(QUEUE_CHILD, [stateModulePath, root, JSON.stringify(reorder(['plan-b', 'plan-a']))]),
    ]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    const statuses = [first.result.status, second.result.status].sort();
    assert.deepEqual(statuses, ['conflict', 'saved']);
    const loser = first.result.status === 'conflict' ? first : second;
    assert.equal(loser.result.reason, 'QUEUE_REVISION_CONFLICT');
    const fresh = await runChild(READ_CHILD, [stateModulePath, root]);
    assert.equal(fresh.queue_revision, 3);
    const winnerOrder = first.result.status === 'saved' ? ['plan-a', 'plan-b'] : ['plan-b', 'plan-a'];
    assert.deepEqual(fresh.queue.map(plan => plan.id), winnerOrder);
  } finally { dispose(root); }
});

test('dashboard execute consumes the exact plan revision and verifies through distinct verifier evidence', async () => {
  const root = gitRoot('execute-ok', { 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_OK });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const edit = await STATE.execute(root, planCommand(before.snapshot.project_id, before.snapshot.run_id, 'goal-1', 'amend_task', { scope: 'Objective for goal-1 amended' }, before.snapshot.revision, 'cmd-edit-before-execute'), ACTOR);
    assert.equal(edit.status, 'pending_agent');
    assert.equal(edit.plan_revision, 1);
    const run = cli(root, ['dashboard', 'execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    assert.equal(result.status, 'finished');
    assert.equal(result.applicable, true);
    assert.equal(result.plan_revision, edit.plan_revision);
    const after = await SNAPSHOT.capture(root);
    const task = after.snapshot.tasks.find(item => item.id === 'goal-1');
    assert.equal(task.execution, 'finished');
    const criterion = task.criteria.find(item => item.id === 'goal-1-c1');
    assert.equal(criterion.verification, 'verified');
    assert.ok(criterion.result_ids.includes(result.attempt_id));
    const applied = after.snapshot.acknowledgements.find(ack => ack.command_id === 'cmd-edit-before-execute' && ack.status === 'applied');
    assert.ok(applied, `applied ack missing in ${JSON.stringify(after.snapshot.acknowledgements)}`);
    assert.equal(applied.plan_revision, edit.plan_revision);
    assert.equal(applied.consumed_plan_revision, edit.plan_revision);
    const attempt = task.attempts.find(item => item.id === result.attempt_id);
    assert.ok(attempt);
    assert.equal(attempt.execution, 'finished');
    const [executorRef, verifierRef] = attempt.evidence;
    assert.notEqual(executorRef.path, verifierRef.path);
    assert.notEqual(executorRef.sha256, verifierRef.sha256);
    const receipt = JSON.parse(fs.readFileSync(path.join(root, result.receipt_path), 'utf8'));
    assert.equal(receipt.schema, 'lazytrae.dashboard-verification.v1');
    assert.equal(receipt.attempt_id, result.attempt_id);
    assert.equal(receipt.plan_revision, edit.plan_revision);
    assert.equal(receipt.executor.script, 'executor.js');
    assert.equal(receipt.verifier.script, 'verifier.js');
    assert.equal(receipt.executor.exit_code, 0);
    assert.equal(receipt.verifier.exit_code, 0);
    assert.notEqual(receipt.executor.identity, receipt.verifier.identity);
    assert.ok(receipt.verifier.started_at >= receipt.executor.finished_at);
    const verifierEvidence = after.evidence.find(item => item.sha256 === verifierRef.sha256);
    const bytes = await SNAPSHOT.evidence(root, verifierEvidence.id);
    assert.equal(bytes.toString('utf8'), `verifier-output:${result.attempt_id}`);
    const executorEvidence = after.evidence.find(item => item.sha256 === executorRef.sha256);
    assert.equal((await SNAPSHOT.evidence(root, executorEvidence.id)).toString('utf8'), `executor-output:${result.attempt_id}`);
  } finally { dispose(root); }
});

test('a failed verifier cannot verify even while claiming success in its output', async () => {
  const root = gitRoot('verifier-fail', { 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_FAIL });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const run = cli(root, ['dashboard', 'execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(run.status, 1);
    const result = JSON.parse(run.stdout);
    assert.equal(result.status, 'failed');
    assert.equal(result.applicable, false);
    const snapshot = await SNAPSHOT.capture(root);
    const task = snapshot.snapshot.tasks[0];
    assert.equal(task.execution, 'failed');
    assert.equal(task.criteria[0].verification, 'failed');
  } finally { dispose(root); }
});

test('a verifier that exits zero without output cannot verify', async () => {
  const root = gitRoot('verifier-empty', { 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_EMPTY });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const result = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(result.status, 'failed');
    assert.equal(result.applicable, false);
    const snapshot = await SNAPSHOT.capture(root);
    assert.equal(snapshot.snapshot.tasks[0].criteria[0].verification, 'failed');
    const attempt = snapshot.snapshot.tasks[0].attempts[0];
    assert.equal(attempt.execution, 'failed');
    const verifierEvidence = attempt.evidence.find(ref => ref.path.endsWith('-verifier.txt'));
    assert.ok(verifierEvidence);
    assert.equal((await SNAPSHOT.evidence(root, snapshot.evidence.find(item => item.sha256 === verifierEvidence.sha256).id)).length, 0);
  } finally { dispose(root); }
});

test('execute rejects dirty worktrees, unknown criteria, blocked dependencies, and identical scripts', async () => {
  const root = gitRoot('rejects', { 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_OK, 'notes.txt': 'not a script\n' });
  seedLoop(root, [makeGoal('goal-1'), makeGoal('goal-2', { depends: ['goal-1'] })]);
  const base = ['execute', 'goal-1', 'goal-1-c1'];
  try {
    fs.appendFileSync(path.join(root, 'executor.js'), '\n// uncommitted edit\n');
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, [...base, '--executor', 'executor.js', '--verifier', 'verifier.js']), 'WORKTREE_DIRTY');
    git(root, ['checkout', '--', 'executor.js']);
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, [...base, '--executor', 'executor.js', '--verifier', 'verifier.js', '--timeout', '5']), 'INVALID_TIMEOUT');
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'missing-criterion', '--executor', 'executor.js', '--verifier', 'verifier.js']), 'UNKNOWN_CRITERION');
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-2', 'goal-2-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']), 'DEPENDENCY_BLOCKED');
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, [...base, '--executor', 'executor.js', '--verifier', 'executor.js']), 'DISTINCT_VERIFIER_REQUIRED');
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, [...base, '--executor', 'notes.txt', '--verifier', 'verifier.js']), 'NODE_SCRIPT_REQUIRED');
    await rejectsCode(DASHBOARD_COMMAND.invoke(root, [...base, '--executor', '../executor.js', '--verifier', 'verifier.js']), 'UNSAFE_REFERENCE');
    const snapshot = await SNAPSHOT.capture(root);
    assert.equal(snapshot.snapshot.tasks[0].execution, 'not_started');
    assert.equal(snapshot.snapshot.tasks[0].attempts.length, 0);
  } finally { dispose(root); }
});

test('a source change during execution finishes the attempt but never verifies it', async () => {
  const root = gitRoot('dirty-run', { 'executor.js': EXECUTOR_TOUCH, 'verifier.js': VERIFIER_OK });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const result = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(result.status, 'finished');
    assert.equal(result.applicable, false);
    const snapshot = await SNAPSHOT.capture(root);
    const task = snapshot.snapshot.tasks[0];
    assert.equal(task.execution, 'finished');
    assert.equal(task.criteria[0].verification, 'unverified');
    assert.notEqual(task.criteria[0].verification, 'verified');
  } finally { dispose(root); }
});

test('a cancelled execution records a cancelled attempt and a later dispatch can verify', async () => {
  const root = gitRoot('cancel', { 'executor-slow.js': EXECUTOR_SLOW, 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_OK });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const executing = DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor-slow.js', '--verifier', 'verifier.js']);
    const loopPath = LOOP_STORE.statePath(root);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const loop = JSON.parse(fs.readFileSync(loopPath, 'utf8'));
      if ((loop.dashboard_attempts ?? []).some(attempt => attempt.execution === 'running')) break;
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    await STATE.update(root, loop => {
      loop.loop_state = 'paused';
      return { result: { paused: true } };
    });
    const cancelled = await executing;
    assert.equal(cancelled.status, 'cancelled');
    const cancelledSnapshot = await SNAPSHOT.capture(root);
    const task = cancelledSnapshot.snapshot.tasks[0];
    assert.equal(task.execution, 'not_started');
    assert.equal(task.criteria[0].verification, 'unverified');
    const attempt = task.attempts.find(item => item.id === cancelled.attempt_id);
    assert.equal(attempt.execution, 'cancelled');
    assert.ok(attempt.finished_at);
    await STATE.update(root, loop => {
      loop.loop_state = 'active';
      return { result: { resumed: true } };
    });
    const resumed = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(resumed.status, 'finished');
    assert.equal(resumed.applicable, true);
    const finalSnapshot = await SNAPSHOT.capture(root);
    assert.equal(finalSnapshot.snapshot.tasks[0].criteria[0].verification, 'verified');
    assert.equal(finalSnapshot.snapshot.tasks[0].attempts.length, 2);
  } finally { dispose(root); }
});

test('valid old evidence cannot verify a criterion after the plan changes', async () => {
  const root = gitRoot('stale-evidence', { 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_OK });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const first = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(first.status, 'finished');
    const verified = await SNAPSHOT.capture(root);
    assert.equal(verified.snapshot.tasks[0].criteria[0].verification, 'verified');
    const amended = await STATE.execute(root, planCommand(verified.snapshot.project_id, verified.snapshot.run_id, 'goal-1', 'amend_criterion', { criterion_id: 'goal-1-c1', requirement: 'Changed requirement', expected_version: 1 }, verified.snapshot.revision), ACTOR);
    assert.equal(amended.status, 'pending_agent');
    assert.equal(amended.plan_revision, verified.snapshot.plan_revision + 1);
    const after = await SNAPSHOT.capture(root);
    const criterion = after.snapshot.tasks[0].criteria[0];
    assert.equal(criterion.version, 2);
    assert.equal(criterion.requirement, 'Changed requirement');
    assert.notEqual(criterion.verification, 'verified');
    assert.deepEqual(criterion.history, [{ version: 1, requirement: 'Criterion for goal-1', result_ids: [first.attempt_id] }]);
    assert.ok(after.snapshot.tasks[0].attempts.some(attempt => attempt.id === first.attempt_id));
  } finally { dispose(root); }
});

test('two pending edits consumed by one dispatch keep acknowledgements contract-valid', async () => {
  const root = gitRoot('multi-edit', { 'executor.js': EXECUTOR_OK, 'verifier.js': VERIFIER_OK });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    const runId = before.snapshot.run_id;
    const first = await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'first edit' }, before.snapshot.revision, 'cmd-multi-1'), ACTOR);
    const second = await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'second edit' }, first.revision, 'cmd-multi-2'), ACTOR);
    assert.equal(first.plan_revision, 1);
    assert.equal(second.plan_revision, 2);
    const result = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(result.status, 'finished');
    assert.equal(result.plan_revision, second.plan_revision);
    const snapshot = await SNAPSHOT.capture(root);
    const applied = snapshot.snapshot.acknowledgements.filter(ack => ack.status === 'applied');
    assert.deepEqual(applied.map(ack => [ack.command_id, ack.plan_revision, ack.consumed_plan_revision]),
      [['cmd-multi-1', 2, 2], ['cmd-multi-2', 2, 2]]);
    assert.equal(snapshot.snapshot.tasks[0].criteria[0].verification, 'verified');
  } finally { dispose(root); }
});

test('a forged receipt written by the executor cannot produce verification', async () => {
  const root = gitRoot('forge', { 'executor.js': EXECUTOR_FORGE, 'verifier.js': VERIFIER_FAIL });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const result = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js']);
    assert.equal(result.status, 'failed');
    const receipt = JSON.parse(fs.readFileSync(path.join(root, result.receipt_path), 'utf8'));
    assert.equal(receipt.forged, undefined);
    assert.equal(receipt.claim, undefined);
    assert.equal(receipt.attempt_id, result.attempt_id);
    assert.equal(receipt.verifier.exit_code, 9);
    const snapshot = await SNAPSHOT.capture(root);
    assert.notEqual(snapshot.snapshot.tasks[0].criteria[0].verification, 'verified');
  } finally { dispose(root); }
});

test('a hung executor is bounded by the requested timeout', async () => {
  const root = gitRoot('hung', { 'executor.js': EXECUTOR_HANG, 'verifier.js': VERIFIER_OK });
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const startedAt = Date.now();
    const result = await DASHBOARD_COMMAND.invoke(root, ['execute', 'goal-1', 'goal-1-c1', '--executor', 'executor.js', '--verifier', 'verifier.js', '--timeout', '250']);
    const elapsed = Date.now() - startedAt;
    assert.equal(result.status, 'failed');
    assert.ok(elapsed < 5000, `execute took ${elapsed}ms for a hung worker`);
    const snapshot = await SNAPSHOT.capture(root);
    assert.equal(snapshot.snapshot.tasks[0].execution, 'failed');
    assert.equal(snapshot.snapshot.tasks[0].criteria[0].verification, 'failed');
  } finally { dispose(root); }
});

test('malformed commands and unsafe arguments are rejected without mutation', async () => {
  const root = tempRoot('malformed');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    const runId = before.snapshot.run_id;
    await rejectsCode(STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'run_shell', { command: 'echo hi' }, before.snapshot.revision), ACTOR), 'INVALID_VARIANT');
    await rejectsCode(STATE.execute(root, planCommand(projectId, 'other-run', 'goal-1', 'amend_task', { scope: 'x' }, before.snapshot.revision), ACTOR), 'COMMAND_BINDING_MISMATCH');
    await rejectsCode(STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'x', undocumented: true }, before.snapshot.revision), ACTOR), 'INVALID_VARIANT');
    const polluted = JSON.parse('{"criterion_id":"goal-1-c1","evidence":{"path":"e.txt","sha256":' + JSON.stringify('a'.repeat(64)) + ',"provenance":"x"},"__proto__":{"polluted":true}}');
    await rejectsCode(STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'attach_evidence', polluted, before.snapshot.revision), ACTOR), 'INVALID_VARIANT');
    await rejectsCode(STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'x' }, before.snapshot.revision), ''), 'TRUSTED_ACTOR_REQUIRED');
    const queueConflict = await STATE.execute(root, queueCommand(projectId, 'create_queued_plan', { plan: queuedPlan(projectId, 'plan-a') }, 'plan-a', 99), ACTOR);
    assert.equal(queueConflict.status, 'conflict');
    assert.equal(queueConflict.reason, 'QUEUE_REVISION_CONFLICT');
    const after = await SNAPSHOT.capture(root);
    assert.equal(after.snapshot.revision, before.snapshot.revision);
    assert.deepEqual(after.snapshot.queue, []);
  } finally { dispose(root); }
});

test('attach_evidence rejects protected service artifacts and changed content references', async () => {
  const root = tempRoot('evidence-guard');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    const runId = before.snapshot.run_id;
    const credentialPath = '.lazytrae/dashboard/adapter-proof/credential';
    fs.mkdirSync(path.dirname(path.join(root, credentialPath)), { recursive: true });
    fs.writeFileSync(path.join(root, credentialPath), 'a'.repeat(64));
    const protectedCommand = planCommand(projectId, runId, 'goal-1', 'attach_evidence', {
      criterion_id: 'goal-1-c1',
      evidence: { path: credentialPath, sha256: crypto.createHash('sha256').update('a'.repeat(64)).digest('hex'), provenance: 'adapter-test' },
    }, before.snapshot.revision);
    await rejectsCode(STATE.execute(root, protectedCommand, ACTOR), 'PROTECTED_SERVICE_ARTIFACT');
    fs.writeFileSync(path.join(root, 'evidence-note.txt'), 'reference content\n');
    const shaOf = value => crypto.createHash('sha256').update(value).digest('hex');
    const changedCommand = planCommand(projectId, runId, 'goal-1', 'attach_evidence', {
      criterion_id: 'goal-1-c1',
      evidence: { path: 'evidence-note.txt', sha256: shaOf('different content\n'), provenance: 'adapter-test' },
    }, before.snapshot.revision);
    await rejectsCode(STATE.execute(root, changedCommand, ACTOR), 'REFERENCE_CHANGED');
    const accepted = await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'attach_evidence', {
      criterion_id: 'goal-1-c1',
      evidence: { path: 'evidence-note.txt', sha256: shaOf('reference content\n'), provenance: 'adapter-test' },
    }, before.snapshot.revision, 'cmd-attach-ok'), ACTOR);
    assert.equal(accepted.status, 'pending_agent');
    assert.equal(accepted.plan_revision, 0);
    const after = await SNAPSHOT.capture(root);
    assert.equal(after.snapshot.revision, before.snapshot.revision + 1);
    assert.deepEqual(after.snapshot.acknowledgements.map(ack => [ack.command_id, ack.status]), [['cmd-attach-ok', 'pending_agent']]);
  } finally { dispose(root); }
});

test('snapshot reports resync instead of silently skipping missed revisions', async () => {
  const root = tempRoot('cursor-gap');
  seedLoop(root, [makeGoal('goal-1')]);
  try {
    const before = await SNAPSHOT.capture(root);
    const projectId = before.snapshot.project_id;
    const runId = before.snapshot.run_id;
    await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'edit one' }, before.snapshot.revision), ACTOR);
    await STATE.execute(root, planCommand(projectId, runId, 'goal-1', 'amend_task', { scope: 'edit two' }, before.snapshot.revision + 1), ACTOR);
    const stale = await SNAPSHOT.capture(root, decodeCursor(before.cursor));
    assert.equal(stale.snapshot.freshness, 'resync_required');
    assert.ok(stale.snapshot.issues.some(issue => issue.code === 'REVISION_GAP'));
    const resynced = await SNAPSHOT.capture(root, decodeCursor(stale.cursor));
    assert.equal(resynced.snapshot.freshness, 'snapshot');
    assert.deepEqual(resynced.snapshot.issues, []);
    const current = await SNAPSHOT.capture(root);
    assert.equal(current.snapshot.freshness, 'snapshot');
    assert.deepEqual(current.snapshot.issues, []);
  } finally { dispose(root); }
});

test('dashboard service enforces loopback authentication and restarts on the same port', async () => {
  const root = tempRoot('service');
  seedLoop(root, [makeGoal('goal-1')]);
  const port = await freePort();
  try {
    const start = cli(root, ['dashboard', 'start', '--port', String(port)]);
    assert.equal(start.status, 0, start.stderr);
    const identity = JSON.parse(start.stdout);
    assert.equal(identity.status, 'running');
    assert.equal(identity.url, `http://127.0.0.1:${port}`);
    assert.equal(identity.identity.port, port);
    const credentialFile = identity.credential_file;
    assert.equal(path.dirname(path.dirname(credentialFile)), path.join(root, '.lazytrae', 'dashboard'));
    const credentialStat = fs.statSync(credentialFile);
    assert.equal(credentialStat.mode & 0o077, 0, 'credential file must be owner-private');
    const credential = fs.readFileSync(credentialFile, 'utf8');
    assert.match(credential, /^[a-f0-9]{64}$/);
    assert.equal((await request(port, 'GET', '/api/snapshot')).status, 401);
    assert.equal((await request(port, 'GET', '/api/snapshot', { authorization: `Bearer ${'0'.repeat(64)}` })).status, 401);
    assert.equal((await request(port, 'POST', '/api/session', {
      origin: `http://127.0.0.1:${port}`, 'x-dashboard-bootstrap': 'f'.repeat(64), 'content-type': 'application/json',
    }, '{}')).status, 401);
    assert.equal((await request(port, 'GET', '/api/evidence/' + 'a'.repeat(64))).status, 401);
    const session = await request(port, 'POST', '/api/session', {
      origin: `http://127.0.0.1:${port}`, 'x-dashboard-bootstrap': credential, 'content-type': 'application/json',
    }, '{}');
    assert.equal(session.status, 200);
    const token = JSON.parse(session.body).token;
    const authorized = await request(port, 'GET', '/api/snapshot', { authorization: `Bearer ${token}` });
    assert.equal(authorized.status, 200);
    const served = JSON.parse(authorized.body);
    const direct = await SNAPSHOT.capture(root);
    assert.equal(served.snapshot.project_id, direct.snapshot.project_id);
    assert.equal(served.snapshot.revision, direct.snapshot.revision);
    const forbiddenWrite = await request(port, 'POST', '/api/commands', {
      origin: `http://127.0.0.1:${port}`, authorization: `Bearer ${token}`, 'content-type': 'application/json',
    }, JSON.stringify(planCommand(served.snapshot.project_id, served.snapshot.run_id, 'goal-1', 'amend_task', { scope: 'http edit' }, served.snapshot.revision, 'cmd-http-edit')));
    assert.equal(forbiddenWrite.status, 200);
    assert.equal(JSON.parse(forbiddenWrite.body).status, 'pending_agent');
    const status = cli(root, ['dashboard', 'status', '--port', String(port)]);
    assert.equal(status.status, 0, status.stderr);
    const statusIdentity = JSON.parse(status.stdout);
    assert.equal(statusIdentity.status, 'running');
    assert.equal(statusIdentity.identity.pid, identity.identity.pid);
    const stop = cli(root, ['dashboard', 'stop', '--port', String(port)]);
    assert.equal(stop.status, 0, stop.stderr);
    const stopped = JSON.parse(stop.stdout);
    assert.equal(stopped.status, 'stopped');
    assert.equal(stopped.cleanup, 'verified-absent');
    assert.equal(stopped.port, port);
    await assert.rejects(() => request(port, 'GET', '/api/snapshot'));
    const restart = cli(root, ['dashboard', 'start', '--port', String(port)]);
    assert.equal(restart.status, 0, restart.stderr);
    const restarted = JSON.parse(restart.stdout);
    assert.equal(restarted.status, 'running');
    assert.equal(restarted.url, `http://127.0.0.1:${port}`);
    assert.notEqual(restarted.identity.pid, identity.identity.pid);
    const retained = await request(port, 'POST', '/api/session', {
      origin: `http://127.0.0.1:${port}`, 'x-dashboard-bootstrap': credential, 'content-type': 'application/json',
    }, '{}');
    assert.equal(retained.status, 200);
    const retainedSnapshot = await request(port, 'GET', '/api/snapshot', { authorization: `Bearer ${JSON.parse(retained.body).token}` });
    assert.equal(JSON.parse(retainedSnapshot.body).snapshot.tasks[0].scope, 'http edit');
  } finally {
    const stop = cli(root, ['dashboard', 'stop', '--port', String(port)]);
    assert.equal(stop.status, 0, stop.stderr);
    dispose(root);
  }
});

test('dashboard start refuses an occupied foreign port without stopping it', async () => {
  const root = tempRoot('foreign-port');
  seedLoop(root, [makeGoal('goal-1')]);
  const foreign = net.createServer(socket => socket.end('foreign service\r\n'));
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  const port = foreign.address().port;
  resources.ports.push(port);
  try {
    const start = cli(root, ['dashboard', 'start', '--port', String(port)]);
    assert.equal(start.status, 1);
    assert.equal(JSON.parse(start.stderr).code, 'START_FAILED');
    const foreignStillAlive = await new Promise(resolve => {
      let connected = false;
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { connected = true; });
      socket.on('data', () => socket.end());
      socket.on('error', () => {});
      socket.on('close', () => resolve(connected));
    });
    assert.equal(foreignStillAlive, true, 'foreign listener must survive the refused start');
    const status = cli(root, ['dashboard', 'status', '--port', String(port)]);
    assert.equal(JSON.parse(status.stdout).status, 'stopped');
    const stray = spawnSync('pgrep', ['-f', 'dashboard-service.js'], { encoding: 'utf8' });
    assert.equal(stray.stdout.trim(), '', 'no dashboard service process may remain');
  } finally {
    foreign.close();
    dispose(root);
  }
});
