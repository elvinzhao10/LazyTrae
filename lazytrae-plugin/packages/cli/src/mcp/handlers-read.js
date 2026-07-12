// LazyTrae MCP — Read-only handlers (get_active_plan, get_boulder_status, get_next_task, get_parity_status)

const { getBoulderState, getActiveWork } = require('./state-access');
const { getParityStatus } = require('./parity');
const { validateActivePlan } = require('../lib/active-plan');

function handleGetActivePlan(root) {
  const b = getBoulderState(root);
  if (!b) return { error: 'boulder.json not found', active_plan: null, tasks: [] };

  const work = getActiveWork(root);
  if (!work) {
    return {
      active_work_id: b.active_work_id,
      active_plan: null, plan_name: null, plan_path: null, tasks: [],
      work_count: Object.keys(b.works || {}).length,
      message: 'No active work. Use boulder.works to list all works.',
    };
  }

  const activePlan = validateActivePlan(root, work.active_plan);
  if (!activePlan.valid) {
    return { error: 'INVALID_ACTIVE_PLAN', message: activePlan.error, active_plan: null, tasks: [] };
  }

  return {
    active_work_id: b.active_work_id,
    active_plan: work.active_plan,
    plan_name: work.plan_name,
    plan_path: work.active_plan,
    status: work.status,
    tasks: (work.tasks || []).map((t, i) => ({
      index: i, id: t.id, description: t.description, status: t.status,
      evidence_paths: t.evidence_paths || [],
    })),
    blocker_count: (work.blockers || []).length,
  };
}

function handleGetBoulderStatus(root) {
  const b = getBoulderState(root);
  if (!b) return { error: 'boulder.json not found' };

  const result = {
    active_work_id: b.active_work_id,
    work_count: Object.keys(b.works || {}).length,
    works: [],
  };

  for (const [id, w] of Object.entries(b.works || {})) {
    const tasks = w.tasks || [];
    result.works.push({
      work_id: id, plan_name: w.plan_name, status: w.status,
      total_tasks: tasks.length,
      completed: tasks.filter(t => t.status === 'complete').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      blockers: (w.blockers || []).map(blk => ({
        reason: blk.reason, task_id: blk.task_id,
        occurred_at: blk.occurred_at, severity: blk.severity || null,
      })),
    });
  }
  return result;
}

function handleGetNextTask(root) {
  const b = getBoulderState(root);
  if (!b) return { error: 'boulder.json not found' };

  const work = getActiveWork(root);
  if (!work) return { message: 'No active work.', next_task: null };

  const tasks = work.tasks || [];
  const blockers = work.blockers || [];
  const blkList = blockers.map(blk => ({ reason: blk.reason, task_id: blk.task_id || null }));

  const pending = tasks.find(t => t.status === 'pending');
  if (pending) {
    return {
      work_id: b.active_work_id, plan_name: work.plan_name,
      next_task: { index: tasks.indexOf(pending), id: pending.id, description: pending.description, status: pending.status },
      remaining_pending: tasks.filter(t => t.status === 'pending').length,
      active_blockers: blkList,
    };
  }

  const inProg = tasks.find(t => t.status === 'in_progress');
  if (inProg) {
    return {
      work_id: b.active_work_id, plan_name: work.plan_name,
      message: 'No pending tasks. A task is currently in progress.',
      in_progress_task: { index: tasks.indexOf(inProg), id: inProg.id, description: inProg.description, status: inProg.status },
      active_blockers: blkList,
    };
  }

  return {
    work_id: b.active_work_id, plan_name: work.plan_name,
    message: 'All tasks are complete, blocked, or failed.', next_task: null,
    task_summary: {
      total: tasks.length,
      complete: tasks.filter(t => t.status === 'complete').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    },
  };
}

function handleGetParityStatus(root) {
  const result = getParityStatus(root);
  if (!result.present) return { error: 'Parity ledger not found', present: false };
  if (result.errors.length > 0) return { error: result.errors.join('; '), present: true, partial: true };
  return {
    present: true, total: result.total, complete: result.complete,
    design: result.design, gap: result.gap, deferred: result.deferred,
    na: result.na, coverage_percentage: result.coverage, categories: result.categories,
  };
}

module.exports = { handleGetActivePlan, handleGetBoulderStatus, handleGetNextTask, handleGetParityStatus };
