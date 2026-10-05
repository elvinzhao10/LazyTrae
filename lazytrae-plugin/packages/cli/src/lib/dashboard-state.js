'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { statePath, loopArtifactPaths } = require('./loop-store');
const { readTransaction, runTransaction } = require('./state-transaction');
const { executionRevision } = require('./harness-execution-context');
const { DashboardError, hash, json, readJSON, safeRead, protectedPath } = require('./dashboard-files');
const portable = name => import(pathToFileURL(path.resolve(__dirname, '../../shared/dashboard', name)).href);
const projectId = root => `trae:${hash(fs.realpathSync(root))}`;
const queuePath = '.lazytrae/state/dashboard-queue.json';
function rawLoop(root) {
  const loop = readJSON(root, '.lazytrae/state/active-loop.json');
  if (!loop || !Array.isArray(loop.goals)) throw new DashboardError('NATIVE_LOOP_REQUIRED');
  loopArtifactPaths(loop);
  return loop;
}
function criterion(goal, item, attemptIds) {
  return { id: item.id, task_id: goal.id, version: item.dashboardVersion ?? 1,
    requirement: item.scenario, applicability: item.essential === false ? 'optional' : 'required',
    scenarios: item.dashboardScenarios ?? [], verification: item.dashboardVerification ?? 'unverified',
    result_ids: [...new Set([...(item.dashboardResults ?? []), ...(attemptIds ?? [])])], history: item.dashboardHistory ?? [] };
}
function state(loop) {
  const attemptIds = new Map();
  for (const attempt of loop.dashboard_attempts ?? []) {
    const list = attemptIds.get(attempt.criterion_id) ?? [];
    list.push(attempt.id);
    attemptIds.set(attempt.criterion_id, list);
  }
  return { ...loop, tasks: loop.goals.map(goal => ({ id: goal.id, title: goal.title,
    scope: goal.objective || goal.title, priority: goal.priority ?? 0, depends_on: goal.depends_on ?? [],
    status: ['paused', 'cancelled'].includes(loop.loop_state) && goal.status === 'in_progress' ? 'cancelled' : goal.status === 'review_blocked' ? 'blocked' : goal.status,
    blocker: goal.blockedReason ?? null, criteria: goal.successCriteria.map(item => criterion(goal, item, attemptIds.get(item.id))) })) };
}
function merge(loop, reduced) {
  for (const key of ['plan_revision', 'dashboard_project_id', 'dashboard_commands', 'dashboard_plan_transitions', 'acknowledgements', 'decisions', 'evidence_submissions']) {
    if (reduced[key] !== undefined) loop[key] = reduced[key];
  }
  for (const task of reduced.tasks) {
    const goal = loop.goals.find(item => item.id === task.id);
    Object.assign(goal, { objective: task.scope, priority: task.priority, depends_on: task.depends_on });
    goal.successCriteria = task.criteria.map(item => {
      const old = goal.successCriteria.find(c => c.id === item.id);
      const changed = old && (old.dashboardVersion ?? 1) !== item.version;
      return { ...old, id: item.id, scenario: item.requirement, essential: item.applicability === 'required',
        status: changed || !old ? 'pending' : old.status, capturedEvidence: changed ? null : old?.capturedEvidence ?? null,
        userModel: old?.userModel ?? 'happy', expectedEvidence: old?.expectedEvidence ?? 'Recorded independent verifier artifact', runtime: old?.runtime ?? false,
        dashboardVersion: item.version, dashboardScenarios: item.scenarios, dashboardVerification: item.verification,
        dashboardResults: item.result_ids, dashboardHistory: item.history };
    });
    goal.executionRevision = executionRevision(goal);
  }
}
function update(root, change) {
  return runTransaction(root, 'active-loop', () => {
    const loop = rawLoop(root); const outcome = change(loop);
    if (!outcome.replay) { loop.revision = (loop.revision ?? 0) + 1; loop.updated_at = new Date().toISOString(); }
    return { members: [ { path: statePath(root), content: json(loop) },
      { path: path.join(root, loopArtifactPaths(loop).goals_path), content: json(loop.goals) }, ...(outcome.members ?? []) ], result: outcome.result };
  });
}
function readQueue(root) {
  return readJSON(root, queuePath, { schema_version: 1, project_id: projectId(root), revision: 0, plans: [], commands: [], intents: [] });
}
async function execute(root, command, actor) {
  const { parseContract } = await portable('contracts/parse.mjs');
  parseContract('command', command);
  if (typeof actor !== 'string' || !actor || actor.length > 256) throw new DashboardError('TRUSTED_ACTOR_REQUIRED');
  if (command.operation.endsWith('_queued_plan')) {
    const { reduceQueue } = await portable('queue-reducer.mjs');
    return runTransaction(root, 'dashboard-queue', () => {
      const store = readQueue(root);
      const next = reduceQueue({ action: 'command', store, revision: store.revision, project_id: projectId(root), request: command, actor });
      return { members: [{ path: path.join(root, queuePath), content: json(next.store) }], result: next.result };
    });
  }
  const { reduceCommand } = await portable('command-reducer.mjs');
  return update(root, loop => {
    if (command.operation === 'attach_evidence') {
      const item = command.payload.evidence;
      if (protectedPath(item.path)) throw new DashboardError('PROTECTED_SERVICE_ARTIFACT');
      if (item.sha256 !== hash(safeRead(root, item.path))) throw new DashboardError('REFERENCE_CHANGED');
    }
    const next = reduceCommand({ state: state(loop), revision: loop.revision ?? 0, run_id: loop.run_id, project_id: projectId(root), command, actor });
    if (!next.replay) {
      loop.dashboard_history ??= [];
      loop.dashboard_history.push({ revision: loop.revision, command_id: command.command_id, goals: structuredClone(loop.goals) });
      merge(loop, next.state);
    }
    return next;
  });
}
async function read(root) {
  const { reduceQueue } = await portable('queue-reducer.mjs');
  const loop = readTransaction(root, 'active-loop', () => rawLoop(root));
  const queue = readTransaction(root, 'dashboard-queue', () => {
    const store = readQueue(root);
    return reduceQueue({ action: 'read', store, project_id: projectId(root), revision: store.revision, actor: 'native-reader' }).store;
  });
  return { loop, input: { project_id: projectId(root), run_id: loop.run_id, revision: loop.revision ?? 0,
    plan_revision: loop.plan_revision ?? 0, state: state(loop), sources: [{ id: 'trae-native', kind: 'runtime',
      generation: loop.run_id, text: (loop.dashboard_events ?? []).map(event => JSON.stringify(event)).join('\n') + ((loop.dashboard_events ?? []).length ? '\n' : '') }],
    queue: queue.plans, queue_revision: queue.revision, queue_acknowledgements: queue.commands.map(item => item.result) } };
}
module.exports = { portable, projectId, rawLoop, state, update, execute, read };
