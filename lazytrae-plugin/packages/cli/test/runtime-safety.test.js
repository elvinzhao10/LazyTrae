const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { defaultLoop, saveLoop, loadLoop } = require('../src/lib/loop-store');
const { createGoals, completeGoals } = require('../src/lib/loop-runtime');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trae-runtime-safety-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const loop = defaultLoop();
  loop.goals = [{ id: 'goal-1', status: 'pending', successCriteria: [] }];
  saveLoop(root, loop);
  return root;
}
test('repeated creation preserves existing goals and brief', t => {
  const root = fixture(t);
  const before = fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json'));
  assert.throws(() => createGoals(root, ['--brief', 'replacement']), /already has goals/);
  assert.deepEqual(fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json')), before);
});
test('a stale loop writer cannot replace a committed update', t => {
  const root = fixture(t);
  const first = loadLoop(root), stale = loadLoop(root);
  first.goals[0].status = 'blocked';
  saveLoop(root, first);
  assert.throws(() => saveLoop(root, stale), /STALE_LOOP_STATE/);
  assert.equal(loadLoop(root).goals[0].status, 'blocked');
});
test('selection consumes one global iteration and resumption consumes none', t => {
  const root = fixture(t);
  assert.equal(completeGoals(root).status, 'active');
  assert.equal(completeGoals(root).status, 'active');
  assert.equal(loadLoop(root).iteration, 1);
  assert.equal(loadLoop(root).goals[0].attempt, 1);
});
test('iteration exhaustion prevents another attempt', t => {
  const root = fixture(t);
  const loop = loadLoop(root); loop.max_iterations = 1; loop.iteration = 1; saveLoop(root, loop);
  assert.equal(completeGoals(root).status, 'exhausted');
  assert.equal(loadLoop(root).goals[0].status, 'pending');
});
for (const status of ['blocked', 'failed', 'complete']) {
  test(`selection reports ${status} without conflating completion`, t => {
    const root = fixture(t);
    const loop = loadLoop(root); loop.goals[0].status = status; loop.loop_state = status; saveLoop(root, loop);
    assert.equal(completeGoals(root).status, status);
  });
}
test('installed post-tool hook records changed files without a development tree', t => {
  const root = fixture(t);
  fs.cpSync(path.resolve(__dirname, '../templates/hooks'), path.join(root, '.trae/hooks'), { recursive: true });
  const sessions = path.join(root, '.lazytrae/state/sessions.json');
  fs.writeFileSync(sessions, JSON.stringify({ current_session_id: 's1', sessions: { s1: {} } }));
  const result = spawnSync('bash', [path.join(root, '.trae/hooks/post-tool-use.sh')], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'main.js' } }), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(sessions)).sessions.s1.changed_files, ['main.js']);
});
test('two CLI selectors commit only one attempt for the active goal', async t => {
  const root = fixture(t);
  const cli = path.resolve(__dirname, '../src/index.js');
  const { spawn } = require('node:child_process');
  const select = () => new Promise(resolve => {
    const child = spawn(process.execPath, [cli, 'loop', 'complete-goals'], { cwd: root });
    child.on('close', code => resolve(code));
  });
  const results = await Promise.all([select(), select()]);
  assert.equal(results.includes(0), true);
  assert.equal(loadLoop(root).iteration, 1);
  assert.equal(loadLoop(root).goals[0].attempt, 1);
});
test('concurrent installed edit and recovery hooks preserve both session updates', async t => {
  const root = fixture(t);
  fs.cpSync(path.resolve(__dirname, '../templates/hooks'), path.join(root, '.trae/hooks'), { recursive: true });
  const sessions = path.join(root, '.lazytrae/state/sessions.json');
  fs.writeFileSync(sessions, JSON.stringify({ current_session_id: 's1', sessions: { s1: {} } }));
  const { spawn } = require('node:child_process');
  const run = (name, args, input) => new Promise(resolve => {
    const child = spawn('bash', [path.join(root, '.trae/hooks', name), ...args], { stdio: ['pipe', 'ignore', 'pipe'] });
    child.stdin.end(input || '');
    child.on('close', code => resolve(code));
  });
  assert.deepEqual(await Promise.all([
    run('post-tool-use.sh', [], JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'main.js' } })),
    run('context-recovery.sh', ['mark']),
  ]), [0, 0]);
  const data = JSON.parse(fs.readFileSync(sessions));
  assert.deepEqual(data.sessions.s1.changed_files, ['main.js']);
  assert.equal(data.compaction_state.post_compact_recovery_needed, true);
  assert.equal(data.revision, 2);
});
test('paused active goals stay blocked until explicit resume', t => {
  const root = fixture(t);
  const loop = loadLoop(root); loop.loop_state = 'paused'; loop.goals[0].status = 'in_progress'; saveLoop(root, loop);
  assert.deepEqual(completeGoals(root), { status: 'blocked', reason: 'paused' });
  assert.equal(loadLoop(root).iteration, 0);
});
for (const status of ['blocked', 'failed', 'complete']) {
  test(`read-only MCP next-task reports ${status} without changing state`, t => {
    const root = fixture(t);
    fs.mkdirSync(path.join(root, '.lazytrae/plans'), { recursive: true });
    fs.writeFileSync(path.join(root, '.lazytrae/plans/plan.md'), '# Plan\n## TODOs\n- [ ] T1: task\n');
    const boulder = path.join(root, '.lazytrae/state/boulder.json');
    const bytes = JSON.stringify({ active_work_id: 'w1', works: { w1: { active_plan: '.lazytrae/plans/plan.md', tasks: [{ id: 't1', status }] } } });
    fs.writeFileSync(boulder, bytes);
    const { handleGetNextTask } = require('../src/mcp/handlers-read');
    assert.equal(handleGetNextTask(root).status, status);
    assert.equal(fs.readFileSync(boulder, 'utf8'), bytes);
  });
}
