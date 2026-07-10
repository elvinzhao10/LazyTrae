const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  BAD_QUALITY_GATE_PATH,
  OLD_QUALITY_GATE_PATH,
  QUALITY_GATE_PATH,
  makeLoopFixture,
  readLoopState,
  runCli,
} = require('./test-helpers');

test('loop CLI completes a goal only after evidence and canonical quality gate sections pass', () => {
  const fixture = makeLoopFixture('lazytrae-loop-happy-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'criteria', 'goal-1'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.omo/evidence/proof.txt'], { cwd: fixture }).status, 0);
  const beforeBadGate = fs.readFileSync(path.join(fixture, '.lazytraework', 'state', 'active-loop.json'), 'utf-8');

  const oldGate = runCli(['loop', 'checkpoint', '--quality-gate-json', OLD_QUALITY_GATE_PATH], { cwd: fixture });
  assert.equal(oldGate.status, 1);
  assert.match(oldGate.stderr, /codeReview/);
  assert.equal(fs.readFileSync(path.join(fixture, '.lazytraework', 'state', 'active-loop.json'), 'utf-8'), beforeBadGate);

  const badGate = runCli(['loop', 'checkpoint', '--quality-gate-json', BAD_QUALITY_GATE_PATH], { cwd: fixture });
  assert.equal(badGate.status, 1);
  assert.match(badGate.stderr, /manualQa\.surfaceEvidence/);
  assert.equal(fs.readFileSync(path.join(fixture, '.lazytraework', 'state', 'active-loop.json'), 'utf-8'), beforeBadGate);

  const checkpoint = runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: fixture });
  assert.equal(checkpoint.status, 0);
  const state = readLoopState(fixture);
  assert.equal(state.loop_state, 'complete');
  assert.equal(state.active_goal_id, null);
  assert.equal(state.checkpoints.at(-1).goal_id, 'goal-1');
  assert.equal(state.goals[0].status, 'complete');
  assert.equal(state.goals[0].successCriteria[0].status, 'pass');
  const completion = runCli(['completion-status'], { cwd: fixture });
  assert.equal(completion.status, 0);
  assert.match(completion.stdout, /^ready/m);
  const events = fs.readFileSync(path.join(fixture, '.lazytraework', 'logs', 'loop-events.ndjson'), 'utf-8');
  assert.match(events, /create_goals/);
  assert.match(events, /complete_goals/);
  assert.match(events, /record_evidence/);
  assert.match(events, /checkpoint/);
});

test('loop CLI creates a review blocker after three normalized same-criterion failures', () => {
  const fixture = makeLoopFixture('lazytrae-loop-failure-threshold-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: fixture }).status, 0);
  for (const reason of ['Same Criterion Failure', ' same criterion   failure ', 'same criterion failure']) {
    const result = runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.omo/evidence/proof.txt', '--status', 'fail', '--reason', reason], { cwd: fixture });
    assert.equal(result.status, 0);
  }

  const state = readLoopState(fixture);
  assert.equal(state.goals[0].status, 'review_blocked');
  assert.equal(state.goals[0].successCriteria[0].status, 'blocked');
  assert.equal(state.failure_attempts[0].count, 3);
  assert.equal(state.review_blockers.length, 1);
  assert.equal(state.review_blockers[0].reason, 'same criterion failure');
});

test('loop checkpoint retains the active goal as checkpoint provenance', () => {
  const fixture = makeLoopFixture('lazytrae-loop-checkpoint-provenance-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'goal-1-criterion'], { cwd: fixture }).status, 0);
  const statePath = path.join(fixture, '.lazytraework', 'state', 'active-loop.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  const goal = structuredClone(state.goals[0]);
  goal.id = 'goal-2';
  goal.successCriteria[0].id = 'goal-2-criterion';
  state.goals.push(goal);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  assert.equal(runCli(['loop', 'complete-goals'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'record-evidence', 'goal-1', 'goal-1-criterion', '.omo/evidence/proof.txt'], { cwd: fixture }).status, 0);
  const readyForCheckpoint = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  readyForCheckpoint.goals[1].status = 'in_progress';
  readyForCheckpoint.goals[1].successCriteria[0].status = 'pass';
  readyForCheckpoint.active_goal_id = 'goal-2';
  fs.writeFileSync(statePath, JSON.stringify(readyForCheckpoint, null, 2) + '\n');

  assert.equal(runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: fixture }).status, 0);
  assert.equal(readLoopState(fixture).checkpoints.at(-1).goal_id, 'goal-2');
});

test('loop steer supports audit-only annotate_ledger with evidence and rationale', () => {
  const fixture = makeLoopFixture('lazytrae-loop-steer-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  const rejected = runCli(['loop', 'steer', '--kind', 'annotate_ledger'], { cwd: fixture });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Missing --evidence/);
  const result = runCli(['loop', 'steer', '--kind', 'annotate_ledger', '--evidence', '.omo/evidence/proof.txt', '--rationale', 'audit note'], { cwd: fixture });
  assert.equal(result.status, 0);
  const events = fs.readFileSync(path.join(fixture, '.lazytraework', 'logs', 'loop-events.ndjson'), 'utf-8');
  assert.match(events, /"kind":"annotate_ledger"/);
});
