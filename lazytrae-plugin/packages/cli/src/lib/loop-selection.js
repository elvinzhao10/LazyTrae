const { appendEvent, loadLoop, requireLoop, saveLoop } = require('./loop-store');

function completeGoals(repoRoot) {
  const loop = requireLoop(repoRoot);
  if (['paused', 'cancelled'].includes(loop.loop_state)) {
    console.log(`Loop is ${loop.loop_state}.`);
    return { status: 'blocked', reason: loop.loop_state };
  }
  const active = loop.goals.find(item => item.status === 'in_progress');
  if (active) {
    console.log(`Active goal: ${active.id}`);
    return { status: 'active', goal_id: active.id };
  }
  const goal = loop.goals.find(item => item.status === 'pending');
  if (!goal) {
    const status = loop.goals.some(item => ['blocked', 'review_blocked'].includes(item.status)) ? 'blocked'
      : loop.goals.some(item => item.status === 'failed') ? 'failed'
      : loop.loop_state === 'complete' && loop.goals.length && loop.goals.every(item => item.status === 'complete') ? 'complete' : 'blocked';
    console.log(`Loop outcome: ${status}`);
    return { status };
  }
  if (!Number.isSafeInteger(loop.iteration) || loop.iteration < 0
    || !Number.isSafeInteger(loop.max_iterations) || loop.max_iterations < 1) {
    throw new Error('Invalid loop iteration budget.');
  }
  if (loop.iteration >= loop.max_iterations) {
    console.log('Loop outcome: exhausted');
    return { status: 'exhausted' };
  }
  goal.status = 'in_progress';
  goal.startedAt = goal.startedAt || new Date().toISOString();
  goal.updatedAt = new Date().toISOString();
  goal.attempt = (goal.attempt || 0) + 1;
  loop.iteration += 1;
  loop.active_goal_id = goal.id;
  loop.loop_state = 'active';
  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, 'complete_goals', { goal_id: goal.id });
  console.log(`Active goal: ${goal.id}`);
  return { status: 'active', goal_id: goal.id };
}

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


module.exports = { completeGoals, status };
