const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { QUALITY_GATE_PATH, makeLoopFixture, readLoopState, runCli } = require('./test-helpers');

function eventTypes(root) {
  const log = path.join(root, '.lazytraework', 'logs', 'loop-events.ndjson');
  return fs.readFileSync(log, 'utf-8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line).event_type);
}

test('loop pause rejects idle state without mutating active-loop state', () => {
  const fixture = makeLoopFixture('lazytrae-loop-idle-pause-');
  const statePath = path.join(fixture, '.lazytraework', 'state', 'active-loop.json');
  const before = fs.readFileSync(statePath, 'utf-8');

  const result = runCli(['loop', 'pause'], { cwd: fixture });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot pause loop from idle state/);
  assert.equal(fs.readFileSync(statePath, 'utf-8'), before);
});

test('loop record-review-blockers appends a pending blocker-resolution goal and visible events', () => {
  const fixture = makeLoopFixture('lazytrae-loop-review-blockers-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: fixture }).status, 0);

  const result = runCli([
    'loop',
    'record-review-blockers',
    'goal-1',
    '--title',
    'Resolve final review blockers',
    '--objective',
    'Fix the reviewer findings and capture evidence.',
    '--evidence',
    '.omo/evidence/review.txt',
  ], { cwd: fixture });

  assert.equal(result.status, 0);
  const state = readLoopState(fixture);
  assert.equal(state.goals[0].status, 'review_blocked');
  assert.equal(state.goals[1].status, 'pending');
  assert.equal(state.goals[1].title, 'Resolve final review blockers');
  assert.match(state.goals[1].successCriteria[0].expectedEvidence, /blocker resolution/i);
  assert.deepEqual(eventTypes(fixture).slice(-3), ['goal_review_blocked', 'goal_added', 'blocker_recorded']);
});

test('loop record-review-blockers rejects pending goals without mutating state or events', () => {
  const fixture = makeLoopFixture('lazytrae-loop-pending-review-blockers-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  const statePath = path.join(fixture, '.lazytraework', 'state', 'active-loop.json');
  const beforeState = fs.readFileSync(statePath, 'utf-8');
  const beforeEvents = eventTypes(fixture);

  const result = runCli([
    'loop',
    'record-review-blockers',
    'goal-1',
    '--title',
    'Should not be recorded',
    '--objective',
    'Pending goals are not final review targets.',
    '--evidence',
    '.omo/evidence/review.txt',
  ], { cwd: fixture });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /goal-1 is pending/);
  assert.equal(fs.readFileSync(statePath, 'utf-8'), beforeState);
  assert.deepEqual(eventTypes(fixture), beforeEvents);
});

test('loop record-evidence pass rejects review-blocked goals without contradicting stale blockers', () => {
  const fixture = makeLoopFixture('lazytrae-loop-blocked-pass-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: fixture }).status, 0);
  for (const reason of ['Same Criterion Failure', ' same criterion   failure ', 'same criterion failure']) {
    assert.equal(runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.omo/evidence/proof.txt', '--status', 'fail', '--reason', reason], { cwd: fixture }).status, 0);
  }
  const statePath = path.join(fixture, '.lazytraework', 'state', 'active-loop.json');
  const beforeState = fs.readFileSync(statePath, 'utf-8');
  const beforeEvents = eventTypes(fixture);

  const result = runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.omo/evidence/proof.txt', '--status', 'pass', '--reason', 'late pass'], { cwd: fixture });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /goal-1 is review_blocked/);
  assert.equal(fs.readFileSync(statePath, 'utf-8'), beforeState);
  assert.deepEqual(eventTypes(fixture), beforeEvents);
  const state = readLoopState(fixture);
  assert.equal(state.goals[0].status, 'review_blocked');
  assert.equal(state.goals[0].successCriteria[0].status, 'blocked');
  assert.equal(state.goals[0].blockedReason, 'same criterion failure');
  assert.equal(state.review_blockers[0].reason, 'same criterion failure');
});

test('loop record-evidence pass rejects completed goals without reopening the loop', () => {
  const fixture = makeLoopFixture('lazytrae-loop-complete-pass-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.omo/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.omo/evidence/proof.txt', '--status', 'pass'], { cwd: fixture }).status, 0);
  assert.equal(runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: fixture }).status, 0);
  const statePath = path.join(fixture, '.lazytraework', 'state', 'active-loop.json');
  const beforeState = fs.readFileSync(statePath, 'utf-8');
  const beforeEvents = eventTypes(fixture);

  const result = runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.omo/evidence/proof.txt', '--status', 'pass'], { cwd: fixture });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /goal-1 is complete/);
  assert.equal(fs.readFileSync(statePath, 'utf-8'), beforeState);
  assert.deepEqual(eventTypes(fixture), beforeEvents);
  const state = readLoopState(fixture);
  assert.equal(state.goals[0].status, 'complete');
  assert.equal(state.loop_state, 'complete');
});
