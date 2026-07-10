// LazyTrae MCP — Handoff handler (generate_handoff)

const fs = require('fs');
const path = require('path');
const { assertSafeWrite } = require('./state-access');
const { getBoulderState, getLoopState, getSessionsState, listEvidence, iso } = require('./state-access');
const { formatCompletionStatus, getCompletionStatus } = require('../../cli/src/lib/completion-gates');

function handleGenerateHandoff(root) {
  const b = getBoulderState(root);
  const l = getLoopState(root);
  const s = getSessionsState(root);
  const evidenceFiles = listEvidence(root);

  const ts = iso();
  const sessionId = s ? (s.current_session_id || 'unknown') : 'unknown';
  const completionGate = getCompletionStatus(root);

  let activeWork = null;
  if (b && b.active_work_id && b.works) {
    activeWork = b.works[b.active_work_id] || null;
  }

  const activeLoop = !!(l && l.active_goal_id !== null);

  const handoff = {
    session_id: sessionId,
    handoff_date: ts,
    what_was_accomplished: [],
    current_state: {
      plan_file: activeWork ? activeWork.active_plan : null,
      plan_name: activeWork ? activeWork.plan_name : null,
      tasks_completed: activeWork
        ? activeWork.tasks.filter(t => t.status === 'complete').length + '/' + activeWork.tasks.length
        : 'N/A',
      current_task: null,
      active_loop: activeLoop,
      loop_iteration: l ? (l.iteration || 0) + '/' + (l.max_iterations || 500) : 'N/A',
    },
    evidence_produced: evidenceFiles.map(f => '.lazytraework/evidence/' + f),
    completion_gate: completionGate,
    remaining_gaps: [],
    blockers: [],
    next_prompt: '(paste the next prompt to continue)',
  };

  if (activeWork) {
    for (const task of activeWork.tasks) {
      if (task.status === 'complete') {
        handoff.what_was_accomplished.push(task.description + ' (' + task.id + ')');
      }
    }
    const currentTask = activeWork.tasks.find(t => t.status === 'in_progress');
    if (currentTask) {
      handoff.current_state.current_task = {
        id: currentTask.id, description: currentTask.description, status: currentTask.status,
      };
    }
    for (const blocker of (activeWork.blockers || [])) {
      handoff.blockers.push((blocker.task_id || 'work') + ': ' + blocker.reason);
    }
  }

  if (l && l.goals) {
    for (const goal of l.goals) {
      if (goal.status === 'blocked') {
        handoff.blockers.push(goal.id + ': ' + (goal.blockedReason || 'no reason'));
      }
    }
  }

  // Persist to handoff.md
  const handoffPath = path.join(root, '.lazytraework', 'evidence', 'handoff.md');
  assertSafeWrite(handoffPath);
  const md = [
    '# Session Handoff', '', '## Handoff Summary', '',
    '- **Session ID**: ' + handoff.session_id,
    '- **Handoff date**: ' + handoff.handoff_date,
    '- **Agent**: LazyTrae MCP', '',
    '## What Was Accomplished', '',
    handoff.what_was_accomplished.length > 0
      ? handoff.what_was_accomplished.map(a => '- ' + a).join('\n') : '- (no active work)', '',
    '## Current State', '',
    '- **Plan file**: ' + (handoff.current_state.plan_file || 'N/A'),
    '- **Tasks completed**: ' + handoff.current_state.tasks_completed,
    '- **Current task**: ' + (handoff.current_state.current_task
      ? handoff.current_state.current_task.id + ' — ' + handoff.current_state.current_task.description : 'None'),
    '- **Active loop**: ' + (handoff.current_state.active_loop ? 'Active' : 'Inactive'),
    '- **Loop iteration**: ' + handoff.current_state.loop_iteration, '',
    '## Completion Gate', '',
    '```',
    formatCompletionStatus(handoff.completion_gate),
    '```', '',
    '## Evidence Produced', '',
    handoff.evidence_produced.length > 0
      ? handoff.evidence_produced.map(e => '- ' + e).join('\n') : '- (none)', '',
    '## Blockers', '',
    handoff.blockers.length > 0 ? handoff.blockers.map(b => '- ' + b).join('\n') : '- None.', '',
    '## Next Prompt', '', '```', handoff.next_prompt, '```', '',
  ].join('\n');
  fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
  fs.writeFileSync(handoffPath, md, 'utf-8');

  return handoff;
}

module.exports = { handleGenerateHandoff };
