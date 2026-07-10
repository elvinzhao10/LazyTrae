const fs = require('fs');
const path = require('path');
const { applySteering } = require('./loop-steering');
const { validateQualityGate } = require('./loop-quality');
const { appendEvent, defaultLoop, loadLoop, parseArgs, requireLoop, saveLoop } = require('./loop-store');
const { requireRepoFile, resolveRepoPath } = require('./path-boundary');

function goalCounts(loop) {
  const count = status => loop.goals.filter(goal => goal.status === status).length;
  return { complete: count('complete'), pending: count('pending'), inProgress: count('in_progress'), blocked: count('blocked') + count('review_blocked') };
}

function status(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) {
    console.log('No active loop found. Run `lazytrae loop --help` for usage.');
    return;
  }
  const counts = goalCounts(loop);
  console.log(`Loop State: ${loop.loop_state || 'idle'}`);
  console.log(`Run ID:     ${loop.run_id || 'N/A'}`);
  console.log(`Task:       ${loop.current_task_index != null ? `#${loop.current_task_index + 1}` : 'N/A'}`);
  console.log(`Goals:      ${counts.complete} complete, ${counts.inProgress} in_progress, ${counts.pending} pending, ${counts.blocked} blocked (${loop.goals.length} total)`);
}

function transition(repoRoot, nextState, message, allowedStates, action) {
  const loop = requireLoop(repoRoot);
  const currentState = loop.loop_state || 'idle';
  if (!allowedStates.includes(currentState)) throw new Error(`Cannot ${action} loop from ${currentState} state.`);
  loop.loop_state = nextState;
  if (nextState === 'cancelled') loop.cancelled_at = new Date().toISOString();
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, `loop_${nextState}`, { message });
  console.log(message);
}

function cancel(repoRoot) { transition(repoRoot, 'cancelled', 'Loop cancelled.', ['active', 'paused'], 'cancel'); }
function pause(repoRoot) { transition(repoRoot, 'paused', 'Loop paused. Use `lazytrae loop resume` to continue.', ['active'], 'pause'); }
function resume(repoRoot) { transition(repoRoot, 'active', 'Loop resumed.', ['paused'], 'resume'); }

function log(repoRoot, args) {
  const logFile = path.join(repoRoot, '.lazytraework', 'logs', 'loop-events.ndjson');
  if (!fs.existsSync(logFile)) { console.log('No event log found at .lazytraework/logs/loop-events.ndjson'); return; }
  const { flags } = parseArgs(args);
  const nIndex = args.indexOf('-n');
  const count = Number(flags['--n'] || (nIndex >= 0 ? args[nIndex + 1] : 20));
  const filter = flags['--filter'];
  let events = fs.readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (filter) events = events.filter(event => event.event_type === filter);
  for (const event of events.slice(-count)) console.log(`${event.timestamp} ${event.event_type} ${event.details ? JSON.stringify(event.details) : ''}`);
}

function readBrief(repoRoot, value) {
  if (!value) throw new Error('Missing --brief.');
  const maybePath = resolveRepoPath(repoRoot, value);
  if (!maybePath.ok) throw new Error(`Invalid --brief path: ${maybePath.error}`);
  return maybePath.exists ? fs.readFileSync(maybePath.path, 'utf-8') : value;
}

function createGoals(repoRoot, args) {
  const { flags } = parseArgs(args);
  const now = new Date().toISOString();
  const goalId = flags['--goal-id'] || 'goal-1';
  const criterionId = flags['--criterion-id'] || `${goalId}-crit-1`;
  const brief = readBrief(repoRoot, flags['--brief']);
  const loop = loadLoop(repoRoot) || defaultLoop();
  Object.assign(loop, { loop_state: 'active', started_at: loop.started_at || now, brief_path: String(flags['--brief']), active_goal_id: goalId });
  loop.goals = [{
    id: goalId,
    title: brief.trim().split('\n')[0].slice(0, 80) || goalId,
    objective: brief.trim(),
    status: 'pending',
    successCriteria: [{
      id: criterionId,
      scenario: `Complete ${goalId} with evidence from ${criterionId}.`,
      userModel: 'happy',
      expectedEvidence: 'A non-empty artifact path recorded through record-evidence.',
      essential: true,
      capturedEvidence: null,
      status: 'pending',
    }],
    attempt: 0,
    createdAt: now,
    updatedAt: now,
  }];
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, 'create_goals', { goal_id: goalId, criterion_id: criterionId });
  console.log(`Loop goals created: ${goalId}/${criterionId}`);
}

function completeGoals(repoRoot) {
  const loop = requireLoop(repoRoot);
  const goal = loop.goals.find(item => item.status === 'in_progress') || loop.goals.find(item => item.status === 'pending' || item.status === 'failed');
  if (!goal) { console.log('All goals complete or blocked.'); return; }
  goal.status = 'in_progress';
  goal.startedAt = goal.startedAt || new Date().toISOString();
  goal.updatedAt = goal.startedAt;
  goal.attempt = (goal.attempt || 0) + 1;
  loop.active_goal_id = goal.id;
  loop.loop_state = 'active';
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, 'complete_goals', { goal_id: goal.id });
  console.log(`Active goal: ${goal.id}`);
}

function findGoal(loop, goalId) {
  const goal = loop.goals.find(candidate => candidate.id === goalId);
  if (!goal) throw new Error(`Unknown goal ${goalId}.`);
  return goal;
}

function criteria(repoRoot, args) {
  const goal = findGoal(requireLoop(repoRoot), args[0]);
  console.log(`criteria for ${goal.id}:`);
  for (const criterion of goal.successCriteria) console.log(`- ${criterion.id} [${criterion.status}] ${criterion.scenario}`);
}

function normalizedReason(reason) {
  return String(reason || 'unspecified failure').trim().toLowerCase().replace(/\s+/g, ' ');
}

function recordEvidence(repoRoot, args) {
  const { flags, positional } = parseArgs(args);
  const [goalId, criterionId, evidencePath] = positional;
  const statusValue = flags['--status'] || 'pass';
  if (!goalId || !criterionId || !evidencePath) throw new Error('Usage: record-evidence <goal> <criterion> <artifact> [--status pass|fail|blocked]');
  const loop = requireLoop(repoRoot);
  const goal = findGoal(loop, goalId);
  const criterion = goal.successCriteria.find(item => item.id === criterionId);
  if (!criterion) throw new Error(`Unknown criterion ${criterionId}.`);
  if (!['pass', 'fail', 'blocked'].includes(statusValue)) throw new Error('Evidence status must be pass, fail, or blocked.');
  requireRepoFile(repoRoot, evidencePath);
  if (statusValue === 'pass' && ['blocked', 'review_blocked'].includes(goal.status)) throw new Error(`${goal.id} is ${goal.status}. Resolve blockers before recording pass evidence.`);
  if (statusValue === 'pass' && goal.status === 'complete') throw new Error(`${goal.id} is complete. Completed goals cannot record pass evidence.`);
  criterion.status = statusValue;
  criterion.capturedEvidence = evidencePath;
  criterion.capturedAt = new Date().toISOString();
  if (flags['--reason']) criterion.notes = flags['--reason'];
  if (statusValue === 'pass' && goal.successCriteria.every(item => item.status === 'pass')) goal.status = 'in_progress';
  if (statusValue === 'fail') trackFailure(loop, goal, criterion, flags['--reason']);
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, 'record_evidence', { goal_id: goalId, criterion_id: criterionId, status: statusValue, evidence: evidencePath });
  console.log(`Evidence recorded: ${goalId}/${criterionId} -> ${criterion.status}`);
}

function trackFailure(loop, goal, criterion, reason) {
  const normalized = normalizedReason(reason);
  const key = `${goal.id}|${criterion.id}|${normalized}`;
  let attempt = loop.failure_attempts.find(item => item.key === key);
  if (!attempt) {
    attempt = { key, goal_id: goal.id, criterion_id: criterion.id, reason: normalized, count: 0 };
    loop.failure_attempts.push(attempt);
  }
  attempt.count += 1;
  if (attempt.count === 3) {
    criterion.status = 'blocked';
    goal.status = 'review_blocked';
    goal.blockedReason = normalized;
    loop.review_blockers.push({ goal_id: goal.id, criterion_id: criterion.id, reason: normalized, count: attempt.count, created_at: new Date().toISOString() });
  }
}

function recordReviewBlockers(repoRoot, args) {
  const { flags, positional } = parseArgs(args);
  const loop = requireLoop(repoRoot);
  const goalId = positional[0] || flags['--goal-id'] || loop.active_goal_id || loop.goals.find(item => item.status === 'in_progress')?.id;
  if (!goalId) throw new Error('Usage: record-review-blockers <goal> --title <title> --objective <text> --evidence <text>');
  const goal = findGoal(loop, goalId);
  if (goal.status !== 'in_progress') throw new Error(`${goal.id} is ${goal.status}.`);
  const now = new Date().toISOString();
  const title = flags['--title'] || flags['--blocker'] || 'Review blockers';
  const objective = flags['--objective'] || flags['--next-step'] || '';
  const evidence = flags['--evidence'] || '';
  goal.status = 'review_blocked';
  goal.reviewBlockedAt = now;
  goal.evidence = evidence;
  goal.updatedAt = now;
  if (loop.active_goal_id === goal.id) loop.active_goal_id = null;
  const newGoal = makeReviewBlockerGoal(loop, title, objective, evidence, now);
  loop.goals.push(newGoal);
  const blocker = { goal_id: goal.id, title, objective, evidence, source: flags['--source'] || 'review', blocker: flags['--blocker'] || title, next_step: flags['--next-step'] || objective, created_at: now, follow_up_goal_id: newGoal.id };
  loop.review_blockers.push(blocker);
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, 'goal_review_blocked', blocker);
  appendEvent(repoRoot, loop, 'goal_added', { goal_id: newGoal.id, title: newGoal.title, evidence });
  appendEvent(repoRoot, loop, 'blocker_recorded', blocker);
  console.log(`Review blockers recorded: ${goal.id}; added ${newGoal.id}`);
}

function makeReviewBlockerGoal(loop, title, objective, evidence, now) {
  const id = nextGoalId(loop);
  return {
    id,
    title,
    objective,
    status: 'pending',
    successCriteria: [
      { id: `${id}-crit-1`, scenario: 'Resolve the recorded review blockers with evidence.', userModel: 'happy', expectedEvidence: `Blocker resolution evidence linked to ${evidence || 'the review findings'}.`, essential: true, capturedEvidence: null, status: 'pending' },
      { id: `${id}-crit-2`, scenario: 'Verify the blocker fix does not leave the original goal blocked.', userModel: 'regression', expectedEvidence: 'A passing loop status or reviewer transcript showing the blocker is resolved.', essential: true, capturedEvidence: null, status: 'pending' },
      { id: `${id}-crit-3`, scenario: 'Check the resolution path handles reviewer edge cases.', userModel: 'edge', expectedEvidence: 'Evidence covering any reviewer-requested edge case or a note that none remains.', essential: true, capturedEvidence: null, status: 'pending' },
    ],
    attempt: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function nextGoalId(loop) {
  let index = loop.goals.length + 1;
  let id = `goal-${index}`;
  while (loop.goals.some(goal => goal.id === id)) {
    index += 1;
    id = `goal-${index}`;
  }
  return id;
}

function steer(repoRoot, args) {
  applySteering(repoRoot, requireLoop(repoRoot), args);
}

function checkpoint(repoRoot, args) {
  const { flags } = parseArgs(args);
  const loop = requireLoop(repoRoot);
  const before = JSON.stringify(loop);
  const result = validateQualityGate(repoRoot, flags['--quality-gate-json']);
  if (JSON.stringify(loop) !== before) throw new Error('Internal checkpoint validation mutated state.');
  const unresolved = loop.goals.flatMap(goal => goal.successCriteria.filter(item => item.status !== 'pass'));
  if (unresolved.length > 0) throw new Error(`Cannot checkpoint: unresolved criteria ${unresolved.map(item => item.id).join(', ')}`);
  const now = new Date().toISOString();
  const checkpointGoalId = loop.active_goal_id || loop.goals[0]?.id || 'N/A';
  for (const goal of loop.goals) {
    if (goal.status !== 'review_blocked' && goal.status !== 'blocked') {
      goal.status = 'complete';
      goal.completedAt = goal.completedAt || now;
      goal.updatedAt = now;
    }
  }
  loop.loop_state = 'complete';
  loop.active_goal_id = null;
  loop.completed_at = now;
  loop.aggregate_completion = { status: 'complete', completedAt: now, evidence: result.path };
  loop.final_quality_gate = result.gate;
  loop.checkpoints.push({ id: `cp-${String(loop.checkpoints.length + 1).padStart(3, '0')}`, iteration: loop.iteration + 1, created_at: now, goal_id: checkpointGoalId, status: 'complete', summary: 'Quality gate checkpoint passed.', evidence_paths: [result.path] });
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, 'checkpoint', { quality_gate_json: result.path });
  console.log('Checkpoint complete: quality gate passed.');
}

module.exports = { cancel, checkpoint, completeGoals, createGoals, criteria, log, pause, recordEvidence, recordReviewBlockers, resume, status, steer };
