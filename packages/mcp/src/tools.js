const fs = require('fs');
const path = require('path');
const {
  readJSON, writeJSON, iso, withFileLock,
  getBoulderState, getLoopState, getSessionsState,
  listEvidence, getActiveWork,
} = require('./state-access');
const { getParityStatus } = require('./parity');

// ── Tool definitions (MCP tools/list) ──

const TOOLS = [
  {
    name: 'lazytrae.get_active_plan',
    description: 'Read .lazytrae/state/boulder.json, return active plan name, plan path, task list with statuses. No mutation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'lazytrae.get_boulder_status',
    description: 'Read .lazytrae/state/boulder.json, return summary: total tasks, completed, pending, in_progress, blocked, blockers list, active work ID. No mutation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'lazytrae.get_next_task',
    description: 'Read .lazytrae/state/boulder.json, find the first task with status "pending" or "in_progress", return its description, index, and any blockers. No mutation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'lazytrae.record_evidence',
    description: 'Record verification evidence. Takes parameters: gate_type, commands, outputs, exit_status, changed_files, manual_checks, reviewer_findings. Writes to .lazytrae/evidence/{gate_type}.md. Returns confirmation with file path.',
    inputSchema: {
      type: 'object',
      properties: {
        gate_type: {
          type: 'string',
          description: 'Evidence gate type: plan_reread, automated_verification, manual_qa, adversarial_qa, cleanup',
          enum: ['plan_reread', 'automated_verification', 'manual_qa', 'adversarial_qa', 'cleanup'],
        },
        commands: {
          type: 'array',
          description: 'List of command objects with command, description, expected_exit_code',
          items: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              description: { type: 'string' },
              expected_exit_code: { type: 'integer' },
            },
          },
        },
        outputs: {
          type: 'array',
          description: 'Captured output from each command',
          items: { type: 'string' },
        },
        exit_status: {
          type: 'object',
          description: 'Map of command index to exit status code',
          additionalProperties: { type: 'integer' },
        },
        changed_files: {
          type: 'array',
          description: 'List of files changed',
          items: { type: 'string' },
        },
        manual_checks: {
          type: 'array',
          description: 'Manual-QA check results',
          items: {
            type: 'object',
            properties: {
              scenario: { type: 'string' },
              channel: { type: 'string', enum: ['cli', 'http', 'tmux', 'browser', 'gui', 'data'] },
              invocation: { type: 'string' },
              expected: { type: 'string' },
              actual: { type: 'string' },
              verdict: { type: 'string', enum: ['pass', 'fail'] },
            },
          },
        },
        reviewer_findings: {
          type: 'array',
          description: 'Reviewer findings',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              finding: { type: 'string' },
              severity: { type: 'string', enum: ['pass', 'info', 'warning', 'fail'] },
            },
          },
        },
        verdict: {
          type: 'string',
          description: 'Overall verdict: pass, fail, blocked',
          enum: ['pass', 'fail', 'blocked'],
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
      },
      required: ['gate_type'],
    },
  },
  {
    name: 'lazytrae.mark_task_done',
    description: 'Mark a task as complete. Takes task_index or task_description, evidence_summary. Validates that evidence exists before marking done (refuses if no evidence). Returns updated task status.',
    inputSchema: {
      type: 'object',
      properties: {
        task_index: {
          type: 'integer',
          description: 'Zero-based index of the task in the active work task list',
        },
        task_description: {
          type: 'string',
          description: 'Task description to match (alternative to task_index)',
        },
        evidence_summary: {
          type: 'string',
          description: 'Summary of evidence proving task completion',
        },
      },
    },
  },
  {
    name: 'lazytrae.add_blocker',
    description: 'Add a blocker to the active work. Updates .lazytrae/state/boulder.json. Returns confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for the blocker',
        },
        task_index: {
          type: 'integer',
          description: 'Optional zero-based index of the task to block',
        },
        severity: {
          type: 'string',
          description: 'Optional severity: pass, info, warning, fail',
          enum: ['pass', 'info', 'warning', 'fail'],
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'lazytrae.request_review',
    description: 'Create a review request entry in .lazytrae/evidence/oracle-review.md. Does NOT perform the review — that is the Oracle agent\'s job. Returns review request details.',
    inputSchema: {
      type: 'object',
      properties: {
        review_type: {
          type: 'string',
          description: 'Type of review: plan_reread, adversarial_qa, full',
          enum: ['plan_reread', 'adversarial_qa', 'full'],
        },
        context: {
          type: 'string',
          description: 'Context about what was implemented',
        },
        files_changed: {
          type: 'array',
          description: 'List of files changed',
          items: { type: 'string' },
        },
        task_id: {
          type: 'string',
          description: 'Optional task ID being reviewed',
        },
      },
      required: ['review_type'],
    },
  },
  {
    name: 'lazytrae.generate_handoff',
    description: 'Read boulder.json, active-loop.json, evidence directory. Return a handoff summary matching the CLI handoff command format. No mutation (read-only).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'lazytrae.get_parity_status',
    description: 'Read docs/lazytrae-parity-ledger.md, parse summary table, return: total, complete, design, gap, deferred, na, coverage_percentage. Same logic as CLI parity-check.js but returns JSON. No mutation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ── Gate type to evidence file mapping ──

const GATE_FILE_MAP = {
  plan_reread: 'reviewer.md',
  automated_verification: 'test-runs.md',
  manual_qa: 'verifier.md',
  adversarial_qa: 'reviewer.md',
  cleanup: 'reviewer.md',
};

// ── Tool handlers ──

function handleGetActivePlan(root) {
  const b = getBoulderState(root);
  if (!b) {
    return { error: 'boulder.json not found', active_plan: null, tasks: [] };
  }

  const work = getActiveWork(root);
  if (!work) {
    return {
      active_work_id: b.active_work_id,
      active_plan: null,
      plan_name: null,
      plan_path: null,
      tasks: [],
      work_count: Object.keys(b.works || {}).length,
      message: 'No active work. Use boulder.works to list all works.',
    };
  }

  return {
    active_work_id: b.active_work_id,
    active_plan: work.active_plan,
    plan_name: work.plan_name,
    plan_path: work.active_plan,
    status: work.status,
    tasks: (work.tasks || []).map((t, i) => ({
      index: i,
      id: t.id,
      description: t.description,
      status: t.status,
      evidence_paths: t.evidence_paths || [],
    })),
    blocker_count: (work.blockers || []).length,
  };
}

function handleGetBoulderStatus(root) {
  const b = getBoulderState(root);
  if (!b) {
    return { error: 'boulder.json not found' };
  }

  const result = {
    active_work_id: b.active_work_id,
    work_count: Object.keys(b.works || {}).length,
    works: [],
  };

  for (const [id, w] of Object.entries(b.works || {})) {
    const tasks = w.tasks || [];
    const summary = {
      work_id: id,
      plan_name: w.plan_name,
      status: w.status,
      total_tasks: tasks.length,
      completed: tasks.filter(t => t.status === 'complete').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      blockers: (w.blockers || []).map(blk => ({
        reason: blk.reason,
        task_id: blk.task_id,
        occurred_at: blk.occurred_at,
        severity: blk.severity || null,
      })),
    };
    result.works.push(summary);
  }

  return result;
}

function handleGetNextTask(root) {
  const b = getBoulderState(root);
  if (!b) {
    return { error: 'boulder.json not found' };
  }

  const work = getActiveWork(root);
  if (!work) {
    return { message: 'No active work.', next_task: null };
  }

  const tasks = work.tasks || [];
  const blockers = work.blockers || [];

  // Find first pending task
  const pending = tasks.find(t => t.status === 'pending');
  if (pending) {
    const pendingIndex = tasks.indexOf(pending);
    return {
      work_id: b.active_work_id,
      plan_name: work.plan_name,
      next_task: {
        index: pendingIndex,
        id: pending.id,
        description: pending.description,
        status: pending.status,
      },
      remaining_pending: tasks.filter(t => t.status === 'pending').length,
      active_blockers: blockers.map(blk => ({ reason: blk.reason, task_id: blk.task_id || null })),
    };
  }

  // Check for in_progress
  const inProgress = tasks.find(t => t.status === 'in_progress');
  if (inProgress) {
    const ipIndex = tasks.indexOf(inProgress);
    return {
      work_id: b.active_work_id,
      plan_name: work.plan_name,
      message: 'No pending tasks. A task is currently in progress.',
      in_progress_task: {
        index: ipIndex,
        id: inProgress.id,
        description: inProgress.description,
        status: inProgress.status,
      },
      active_blockers: blockers.map(blk => ({ reason: blk.reason, task_id: blk.task_id || null })),
    };
  }

  return {
    work_id: b.active_work_id,
    plan_name: work.plan_name,
    message: 'All tasks are complete, blocked, or failed.',
    next_task: null,
    task_summary: {
      total: tasks.length,
      complete: tasks.filter(t => t.status === 'complete').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    },
  };
}

function handleRecordEvidence(root, args) {
  const gateType = args.gate_type;
  const fileName = GATE_FILE_MAP[gateType] || 'general.md';
  const evidenceDir = path.join(root, '.lazytrae', 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const filePath = path.join(evidenceDir, fileName);
  const ts = iso();

  const lines = [];

  lines.push('## Evidence Record — ' + ts);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('| --- | --- |');
  lines.push('| Gate | ' + gateType + ' |');
  lines.push('| Recorded at | ' + ts + ' |');
  lines.push('| Verdict | ' + (args.verdict || 'N/A') + ' |');

  if (args.commands && args.commands.length > 0) {
    lines.push('');
    lines.push('### Commands Executed');
    lines.push('');
    for (const cmd of args.commands) {
      lines.push('- `' + cmd.command + '`' + (cmd.description ? ' — ' + cmd.description : ''));
    }
  }

  if (args.outputs && args.outputs.length > 0) {
    lines.push('');
    lines.push('### Outputs');
    lines.push('');
    for (let i = 0; i < args.outputs.length; i++) {
      lines.push('**Command ' + (i + 1) + ':**');
      lines.push('```');
      lines.push(args.outputs[i]);
      lines.push('```');
      lines.push('');
    }
  }

  if (args.exit_status && Object.keys(args.exit_status).length > 0) {
    lines.push('');
    lines.push('### Exit Statuses');
    lines.push('');
    for (const [key, val] of Object.entries(args.exit_status)) {
      lines.push('- ' + key + ': ' + val);
    }
  }

  if (args.changed_files && args.changed_files.length > 0) {
    lines.push('');
    lines.push('### Changed Files');
    lines.push('');
    for (const f of args.changed_files) {
      lines.push('- ' + f);
    }
  }

  if (args.manual_checks && args.manual_checks.length > 0) {
    lines.push('');
    lines.push('### Manual-QA Checks');
    lines.push('');
    for (const mc of args.manual_checks) {
      lines.push('- **' + mc.scenario + '** (' + mc.channel + '): ' + mc.verdict);
      lines.push('  - Invocation: ' + mc.invocation);
      lines.push('  - Expected: ' + mc.expected);
      lines.push('  - Actual: ' + mc.actual);
    }
  }

  if (args.reviewer_findings && args.reviewer_findings.length > 0) {
    lines.push('');
    lines.push('### Reviewer Findings');
    lines.push('');
    for (const rf of args.reviewer_findings) {
      lines.push('- [' + rf.severity + '] ' + rf.category + ': ' + rf.finding);
    }
  }

  if (args.notes) {
    lines.push('');
    lines.push('### Notes');
    lines.push('');
    lines.push(args.notes);
  }

  lines.push('');
  fs.appendFileSync(filePath, lines.join('\n'), 'utf-8');

  return {
    recorded: true,
    gate_type: gateType,
    file: fileName,
    file_path: '.lazytrae/evidence/' + fileName,
    timestamp: ts,
    verdict: args.verdict || null,
  };
}

function handleMarkTaskDone(root, args) {
  const bp = path.join(root, '.lazytrae', 'state', 'boulder.json');

  return withFileLock(bp, () => {
    const b = readJSON(bp);
    if (!b) return { error: 'boulder.json not found' };

    const work = getActiveWork(root);
    if (!work) return { error: 'No active work found' };

    // Find the task
    let task = null;
    let taskIndex = -1;

    if (args.task_index !== undefined) {
      if (args.task_index < 0 || args.task_index >= work.tasks.length) {
        return { error: 'Task index ' + args.task_index + ' out of range (0-' + (work.tasks.length - 1) + ')' };
      }
      task = work.tasks[args.task_index];
      taskIndex = args.task_index;
    } else if (args.task_description) {
      taskIndex = work.tasks.findIndex(t => t.description === args.task_description);
      if (taskIndex === -1) {
        return { error: 'Task with description "' + args.task_description + '" not found' };
      }
      task = work.tasks[taskIndex];
    } else {
      return { error: 'Either task_index or task_description is required' };
    }

    if (!task) return { error: 'Task not found' };

    // Check state
    if (task.status === 'complete') {
      return { error: 'Task "' + task.id + '" is already complete' };
    }

    // Evidence gate: refuse if no evidence
    if (!args.evidence_summary) {
      return {
        error: 'EVIDENCE_REQUIRED',
        message: 'Task completion requires evidence. Provide an evidence_summary describing what was verified.',
        task_id: task.id,
        current_status: task.status,
      };
    }

    // Mark complete
    task.status = 'complete';
    task.completed_at = iso();

    // Record evidence
    if (!task.evidence_paths) task.evidence_paths = [];
    const evidenceFile = 'test-runs.md';
    const evidencePath = path.join(root, '.lazytrae', 'evidence', evidenceFile);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    const evidenceEntry = '## Task Complete — ' + iso() + '\n\n- **Task ID**: ' + task.id +
      '\n- **Description**: ' + task.description +
      '\n- **Evidence**: ' + args.evidence_summary + '\n\n';
    fs.appendFileSync(evidencePath, evidenceEntry, 'utf-8');
    task.evidence_paths.push('.lazytrae/evidence/' + evidenceFile);

    work.updated_at = iso();
    b.updated_at = iso();
    writeJSON(bp, b);

    return {
      marked_complete: true,
      work_id: b.active_work_id,
      task_id: task.id,
      task_index: taskIndex,
      task_description: task.description,
      completed_at: task.completed_at,
      evidence_paths: task.evidence_paths,
      evidence_summary: args.evidence_summary,
    };
  });
}

function handleAddBlocker(root, args) {
  const bp = path.join(root, '.lazytrae', 'state', 'boulder.json');

  return withFileLock(bp, () => {
    const b = readJSON(bp);
    if (!b) return { error: 'boulder.json not found' };

    const work = getActiveWork(root);
    if (!work) return { error: 'No active work found' };

    const ts = iso();
    const blocker = {
      reason: args.reason,
      severity: args.severity || null,
      occurred_at: ts,
    };

    // If task_index is given, add blocker to that task
    if (args.task_index !== undefined) {
      if (args.task_index < 0 || args.task_index >= work.tasks.length) {
        return { error: 'Task index ' + args.task_index + ' out of range' };
      }
      const task = work.tasks[args.task_index];
      task.status = 'blocked';
      task.blocked_reason = args.reason;
      blocker.task_id = task.id;
    }

    if (!work.blockers) work.blockers = [];
    work.blockers.push(blocker);
    work.updated_at = ts;
    b.updated_at = ts;
    writeJSON(bp, b);

    return {
      blocker_added: true,
      blocker: blocker,
      work_id: b.active_work_id,
      total_blockers: work.blockers.length,
    };
  });
}

function handleRequestReview(root, args) {
  const evidenceDir = path.join(root, '.lazytrae', 'evidence', 'oracle-review.md');
  fs.mkdirSync(path.dirname(evidenceDir), { recursive: true });

  const ts = iso();
  const reviewType = args.review_type;
  const context = args.context || 'No context provided.';
  const filesChanged = (args.files_changed || []).map(f => '  - ' + f).join('\n') || '  - None specified';
  const taskId = args.task_id || 'N/A';

  const entry = [
    '# Oracle Review Request — ' + ts,
    '',
    '## Review Type',
    '',
    reviewType,
    '',
    '## Context',
    '',
    context,
    '',
    '## Files Changed',
    '',
    filesChanged,
    '',
    '## Task ID',
    '',
    taskId,
    '',
    '## Five Evidence Gates',
    '',
    '### 1. Plan Reread',
    '- [ ] Plan re-read before claiming completion',
    '',
    '### 2. Automated Verification',
    '- [ ] Tests, linters, type checks, builds pass',
    '',
    '### 3. Manual-QA',
    '- [ ] Real-surface proof through channels (CLI, HTTP, browser, data)',
    '',
    '### 4. Adversarial QA',
    '- [ ] Edge cases, regression, adversarial scenarios tested',
    '',
    '### 5. Cleanup',
    '- [ ] AI slop removed, dead code cleaned up',
    '',
    '## Verdict',
    '',
    '- [ ] APPROVE',
    '- [ ] ITERATE (max 3 fixable issues)',
    '- [ ] REJECT (blocking)',
    '',
    '## Notes',
    '',
    '_Review requested at ' + ts + '_',
    '',
  ].join('\n');

  fs.appendFileSync(evidenceDir, entry, 'utf-8');

  return {
    review_requested: true,
    review_type: reviewType,
    file: '.lazytrae/evidence/oracle-review.md',
    timestamp: ts,
    task_id: taskId,
    message: 'Review request created. The Oracle agent should now perform the review.',
  };
}

function handleGenerateHandoff(root) {
  const b = getBoulderState(root);
  const l = getLoopState(root);
  const s = getSessionsState(root);
  const evidenceFiles = listEvidence(root);

  const ts = iso();
  const sessionId = s ? (s.current_session_id || 'unknown') : 'unknown';

  // Determine active work
  let activeWork = null;
  if (b && b.active_work_id && b.works) {
    activeWork = b.works[b.active_work_id] || null;
  }

  // Determine active loop
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
    evidence_produced: evidenceFiles.map(f => '.lazytrae/evidence/' + f),
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
        id: currentTask.id,
        description: currentTask.description,
        status: currentTask.status,
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

  // Also write to handoff.md evidence file
  const handoffPath = path.join(root, '.lazytrae', 'evidence', 'handoff.md');
  const md = [
    '# Session Handoff',
    '',
    '## Handoff Summary',
    '',
    '- **Session ID**: ' + handoff.session_id,
    '- **Handoff date**: ' + handoff.handoff_date,
    '- **Agent**: LazyTrae MCP',
    '',
    '## What Was Accomplished',
    '',
    handoff.what_was_accomplished.length > 0
      ? handoff.what_was_accomplished.map(a => '- ' + a).join('\n')
      : '- (no active work)',
    '',
    '## Current State',
    '',
    '- **Plan file**: ' + (handoff.current_state.plan_file || 'N/A'),
    '- **Tasks completed**: ' + handoff.current_state.tasks_completed,
    '- **Current task**: ' + (handoff.current_state.current_task
      ? handoff.current_state.current_task.id + ' — ' + handoff.current_state.current_task.description
      : 'None'),
    '- **Active loop**: ' + (handoff.current_state.active_loop ? 'Active' : 'Inactive'),
    '- **Loop iteration**: ' + handoff.current_state.loop_iteration,
    '',
    '## Evidence Produced',
    '',
    handoff.evidence_produced.length > 0
      ? handoff.evidence_produced.map(e => '- ' + e).join('\n')
      : '- (none)',
    '',
    '## Blockers',
    '',
    handoff.blockers.length > 0
      ? handoff.blockers.map(b => '- ' + b).join('\n')
      : '- None.',
    '',
    '## Next Prompt',
    '',
    '```',
    handoff.next_prompt,
    '```',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
  fs.writeFileSync(handoffPath, md, 'utf-8');

  return handoff;
}

function handleGetParityStatus(root) {
  const result = getParityStatus(root);
  if (!result.present) {
    return { error: 'Parity ledger not found', present: false };
  }
  if (result.errors.length > 0) {
    return { error: result.errors.join('; '), present: true, partial: true };
  }
  return {
    present: true,
    total: result.total,
    complete: result.complete,
    design: result.design,
    gap: result.gap,
    deferred: result.deferred,
    na: result.na,
    coverage_percentage: result.coverage,
    categories: result.categories,
  };
}

// ── Handler map ──

const HANDLERS = {
  'lazytrae.get_active_plan': handleGetActivePlan,
  'lazytrae.get_boulder_status': handleGetBoulderStatus,
  'lazytrae.get_next_task': handleGetNextTask,
  'lazytrae.record_evidence': handleRecordEvidence,
  'lazytrae.mark_task_done': handleMarkTaskDone,
  'lazytrae.add_blocker': handleAddBlocker,
  'lazytrae.request_review': handleRequestReview,
  'lazytrae.generate_handoff': handleGenerateHandoff,
  'lazytrae.get_parity_status': handleGetParityStatus,
};

module.exports = { TOOLS, HANDLERS };