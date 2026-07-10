const { appendEvent, parseArgs, saveLoop } = require('./loop-store');

const CANONICAL_MUTATIONS = [
  'add_subgoal',
  'split_subgoal',
  'reorder_pending',
  'revise_pending_wording',
  'revise_criterion',
  'annotate_ledger',
  'mark_blocked_superseded',
];

function requireFlag(flags, name) {
  const value = String(flags[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function nextGoalId(loop) {
  let max = 0;
  for (const goal of loop.goals) {
    const match = /^G?(\d+)$/i.exec(goal.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `G${String(max + 1).padStart(3, '0')}`;
}

function makeGoal(id, title, objective, now) {
  return {
    id,
    title,
    objective,
    status: 'pending',
    successCriteria: [{
      id: `${id}-crit-1`,
      scenario: `Complete ${title}`,
      userModel: 'happy',
      expectedEvidence: 'Observable evidence captured through the requested surface.',
      essential: true,
      capturedEvidence: null,
      status: 'pending',
    }],
    attempt: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function parseChildren(raw) {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Children/replacements must be a JSON array.');
  return parsed.map((child, index) => ({
    title: String(child.title || `Replacement ${index + 1}`),
    objective: String(child.objective || child.title || `Replacement ${index + 1}`),
  }));
}

function findGoal(loop, goalId) {
  const goal = loop.goals.find(candidate => candidate.id === goalId);
  if (!goal) throw new Error(`Unknown goal ${goalId}.`);
  return goal;
}

function applySteering(repoRoot, loop, args) {
  const { flags } = parseArgs(args);
  const kind = requireFlag(flags, '--kind');
  if (!CANONICAL_MUTATIONS.includes(kind)) {
    throw new Error(`Unknown steering mutation ${kind}. Use: ${CANONICAL_MUTATIONS.join(', ')}`);
  }
  const now = new Date().toISOString();
  const evidence = requireFlag(flags, '--evidence');
  const rationale = requireFlag(flags, '--rationale');
  const details = { kind, evidence, rationale };

  if (kind === 'add_subgoal') {
    const goal = makeGoal(nextGoalId(loop), requireFlag(flags, '--title'), requireFlag(flags, '--objective'), now);
    loop.goals.push(goal);
    details.goal_id = goal.id;
  } else if (kind === 'revise_criterion') {
    const goal = findGoal(loop, requireFlag(flags, '--goal-id'));
    const criterion = goal.successCriteria.find(item => item.id === requireFlag(flags, '--criterion-id'));
    if (!criterion) throw new Error(`Unknown criterion ${flags['--criterion-id']}.`);
    if (flags['--scenario']) criterion.scenario = flags['--scenario'];
    if (flags['--expected-evidence']) criterion.expectedEvidence = flags['--expected-evidence'];
    if (flags['--user-model']) criterion.userModel = flags['--user-model'];
    goal.updatedAt = now;
  } else if (kind === 'revise_pending_wording') {
    const goal = findGoal(loop, requireFlag(flags, '--goal-id'));
    if (goal.status !== 'pending') throw new Error('revise_pending_wording requires a pending goal.');
    if (flags['--title']) goal.title = flags['--title'];
    if (flags['--objective']) goal.objective = flags['--objective'];
    goal.updatedAt = now;
  } else if (kind === 'reorder_pending') {
    const order = JSON.parse(requireFlag(flags, '--order'));
    const pending = loop.goals.filter(goal => goal.status === 'pending');
    const byId = new Map(pending.map(goal => [goal.id, goal]));
    for (const id of order) if (!byId.has(id)) throw new Error(`Unknown pending goal ${id}.`);
    const ordered = order.map(id => byId.get(id));
    const rest = loop.goals.filter(goal => goal.status !== 'pending' || !order.includes(goal.id));
    loop.goals = [...rest.filter(goal => goal.status !== 'pending'), ...ordered, ...rest.filter(goal => goal.status === 'pending')];
  } else if (kind === 'split_subgoal' || kind === 'mark_blocked_superseded') {
    const goal = findGoal(loop, requireFlag(flags, '--goal-id'));
    const children = parseChildren(flags['--children'] || flags['--replacements']);
    goal.status = 'blocked';
    goal.steeringStatus = 'superseded';
    goal.blockedReason = rationale || evidence || `${kind} applied`;
    goal.updatedAt = now;
    for (const child of children) loop.goals.push(makeGoal(nextGoalId(loop), child.title, child.objective, now));
  } else if (kind === 'annotate_ledger') {
    details.annotation = rationale;
  }

  saveLoop(repoRoot, loop);
  appendEvent(repoRoot, loop, kind, details);
  console.log(`Steering accepted: ${kind}`);
}

module.exports = { applySteering, CANONICAL_MUTATIONS };
