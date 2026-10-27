'use strict';
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { update, state, projectId } = require('./dashboard-state');
const { source, planHash } = require('./dashboard-proof');
const { runWorker } = require('./dashboard-worker');
const { hash, json, safeRead, DashboardError } = require('./dashboard-files');
const { CURRENT_VERSION } = require('./version');
function event(loop, attempt) {
  loop.dashboard_events ??= [];
  const { receipt_path, ...payload } = attempt;
  loop.dashboard_events.push({ schema_version: 1, event_id: `evt:${randomUUID()}`, ts: new Date().toISOString(),
    run_id: loop.run_id, event: 'attempt_result', event_payload: structuredClone(payload) });
}
function consume(loop) {
  for (const receipt of loop.dashboard_commands ?? []) {
    if (receipt.result.status !== 'pending_agent') continue;
    const consumed = loop.plan_revision ?? 0;
    const ack = { ...receipt.result, status: 'applied', revision: loop.revision + 1, plan_revision: consumed, consumed_plan_revision: consumed };
    loop.acknowledgements.push(ack);
  }
}
async function execute(root, request) {
  const { goalId, criterionId, executor, verifier, timeout = 30000 } = request;
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 300000) throw new DashboardError('INVALID_TIMEOUT');
  const scriptHashes = [executor, verifier].map(script => {
    if (typeof script !== 'string' || !/\.(?:c?js|mjs)$/.test(script)) throw new DashboardError('NODE_SCRIPT_REQUIRED');
    return hash(safeRead(root, script, 1024 * 1024));
  });
  if (executor === verifier || scriptHashes[0] === scriptHashes[1]) throw new DashboardError('DISTINCT_VERIFIER_REQUIRED');
  const identity = source(root);
  if (!identity.head || !identity.clean) throw new DashboardError('WORKTREE_DIRTY');
  const context = update(root, loop => {
    if (['paused', 'cancelled'].includes(loop.loop_state)) throw new DashboardError('LOOP_NOT_ACTIVE');
    if ((loop.dashboard_attempts ?? []).some(a => a.execution === 'running') || loop.goals.some(g => g.id !== goalId && g.status === 'in_progress')) throw new DashboardError('TASK_ALREADY_RUNNING');
    const goal = loop.goals.find(g => g.id === goalId); const criterion = goal?.successCriteria.find(c => c.id === criterionId);
    if (!criterion) throw new DashboardError('UNKNOWN_CRITERION');
    if ((goal.depends_on ?? []).some(id => loop.goals.find(g => g.id === id)?.status !== 'complete')) throw new DashboardError('DEPENDENCY_BLOCKED');
    const attempt = { id: `attempt:${randomUUID()}`, task_id: goalId, criterion_id: criterionId,
      criterion_version: criterion.dashboardVersion ?? 1, plan_revision: loop.plan_revision ?? 0,
      consumed_plan_revision: loop.plan_revision ?? 0, worker_id: `trae-executor:${process.pid}`, parent_task_id: null,
      source_revision: identity.head, execution: 'running', verification: 'unverified',
      started_at: new Date().toISOString(), finished_at: null, evidence: [] };
    loop.dashboard_attempts ??= []; loop.dashboard_attempts.push(attempt); event(loop, attempt); consume(loop);
    goal.status = 'in_progress'; loop.loop_state = 'active'; loop.active_goal_id = goalId;
    return { result: { project_id: projectId(root), run_id: loop.run_id, attempt, task: state(loop).tasks.find(t => t.id === goalId), plan_sha256: planHash(goal) } };
  });
  const execution = await runWorker(root, executor, context, timeout);
  const verification = execution.exit_code === 0 && execution.output.length ? await runWorker(root, verifier,
    { ...context, executor: { ...execution, output: execution.output.toString('utf8') } }, timeout) : null;
  const currentSource = source(root);
  return update(root, loop => {
    if (loop.run_id !== context.run_id) throw new DashboardError('RUN_CHANGED');
    const attempt = loop.dashboard_attempts.find(a => a.id === context.attempt.id);
    if (!attempt || attempt.execution !== 'running') throw new DashboardError('ATTEMPT_CHANGED');
    const goal = loop.goals.find(g => g.id === goalId); const members = [];
    const prefix = `.lazytrae/loop/${loop.run_id}/dashboard-evidence/${attempt.id.replace(':', '-')}`;
    for (const [name, record] of [['executor', execution], ['verifier', verification]]) if (record) {
      const ref = { path: `${prefix}-${name}.txt`, sha256: hash(record.output), provenance: record.identity };
      members.push({ path: path.join(root, ref.path), content: record.output }); attempt.evidence.push(ref);
      record.artifact = ref; delete record.output;
    }
    const cancelled = ['cancelled', 'paused'].includes(loop.loop_state) || execution.reason === 'WORKER_INTERRUPTED' || verification?.reason === 'WORKER_INTERRUPTED';
    const success = execution.exit_code === 0 && verification?.exit_code === 0 && members.every(m => m.content.length > 0);
    attempt.execution = cancelled ? 'cancelled' : success ? 'finished' : 'failed';
    attempt.verification = success && !cancelled ? 'unverified' : cancelled ? 'unverified' : 'failed';
    attempt.finished_at = new Date().toISOString();
    attempt.receipt_path = `${prefix}-receipt.json`;
    const receipt = { schema: 'lazytrae.dashboard-verification.v1', package_version: CURRENT_VERSION,
      attempt_id: attempt.id, run_id: loop.run_id, task_id: goalId, criterion_id: criterionId,
      source_revision: identity.head, plan_revision: attempt.plan_revision, criterion_version: attempt.criterion_version,
      plan_sha256: context.plan_sha256, executor: execution, verifier: verification };
    members.push({ path: path.join(root, attempt.receipt_path), content: json(receipt) });
    event(loop, attempt);
    const applicable = !cancelled && success && currentSource.clean && currentSource.head === identity.head && planHash(goal) === context.plan_sha256;
    goal.status = cancelled ? 'pending' : success ? 'complete' : 'failed';
    if (loop.active_goal_id === goalId) loop.active_goal_id = null;
    return { members, result: { status: attempt.execution, applicable, attempt_id: attempt.id, plan_revision: attempt.plan_revision, receipt_path: attempt.receipt_path } };
  });
}
module.exports = { execute };
