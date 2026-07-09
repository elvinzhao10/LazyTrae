// LazyTrae MCP — Evidence and task handlers (record_evidence, mark_task_done)

const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON, iso, withFileLock, getActiveWork } = require('./state-access');

const GATE_FILE_MAP = {
  plan_reread: 'reviewer.md',
  automated_verification: 'test-runs.md',
  manual_qa: 'verifier.md',
  adversarial_qa: 'reviewer.md',
  cleanup: 'reviewer.md',
};

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
    lines.push('', '### Commands Executed', '');
    for (const cmd of args.commands)
      lines.push('- `' + cmd.command + '`' + (cmd.description ? ' — ' + cmd.description : ''));
  }

  if (args.outputs && args.outputs.length > 0) {
    lines.push('', '### Outputs', '');
    for (let i = 0; i < args.outputs.length; i++) {
      lines.push('**Command ' + (i + 1) + ':**', '```', args.outputs[i], '```', '');
    }
  }

  if (args.exit_status && Object.keys(args.exit_status).length > 0) {
    lines.push('', '### Exit Statuses', '');
    for (const [key, val] of Object.entries(args.exit_status))
      lines.push('- ' + key + ': ' + val);
  }

  if (args.changed_files && args.changed_files.length > 0) {
    lines.push('', '### Changed Files', '');
    for (const f of args.changed_files) lines.push('- ' + f);
  }

  if (args.manual_checks && args.manual_checks.length > 0) {
    lines.push('', '### Manual-QA Checks', '');
    for (const mc of args.manual_checks) {
      lines.push('- **' + mc.scenario + '** (' + mc.channel + '): ' + mc.verdict);
      lines.push('  - Invocation: ' + mc.invocation);
      lines.push('  - Expected: ' + mc.expected);
      lines.push('  - Actual: ' + mc.actual);
    }
  }

  if (args.reviewer_findings && args.reviewer_findings.length > 0) {
    lines.push('', '### Reviewer Findings', '');
    for (const rf of args.reviewer_findings)
      lines.push('- [' + rf.severity + '] ' + rf.category + ': ' + rf.finding);
  }

  if (args.notes) lines.push('', '### Notes', '', args.notes);

  lines.push('');
  fs.appendFileSync(filePath, lines.join('\n'), 'utf-8');

  return {
    recorded: true, gate_type: gateType, file: fileName,
    file_path: '.lazytrae/evidence/' + fileName, timestamp: ts,
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

    let task = null;
    let taskIndex = -1;

    if (args.task_index !== undefined) {
      if (args.task_index < 0 || args.task_index >= work.tasks.length)
        return { error: 'Task index ' + args.task_index + ' out of range (0-' + (work.tasks.length - 1) + ')' };
      task = work.tasks[args.task_index];
      taskIndex = args.task_index;
    } else if (args.task_description) {
      taskIndex = work.tasks.findIndex(t => t.description === args.task_description);
      if (taskIndex === -1) return { error: 'Task with description "' + args.task_description + '" not found' };
      task = work.tasks[taskIndex];
    } else {
      return { error: 'Either task_index or task_description is required' };
    }

    if (!task) return { error: 'Task not found' };
    if (task.status === 'complete') return { error: 'Task "' + task.id + '" is already complete' };

    // Evidence gate: refuse if no evidence
    if (!args.evidence_summary) {
      return {
        error: 'EVIDENCE_REQUIRED',
        message: 'Task completion requires evidence. Provide an evidence_summary describing what was verified.',
        task_id: task.id, current_status: task.status,
      };
    }

    // Mark complete
    task.status = 'complete';
    task.completed_at = iso();

    if (!task.evidence_paths) task.evidence_paths = [];
    const evidenceFile = 'test-runs.md';
    const evidencePath = path.join(root, '.lazytrae', 'evidence', evidenceFile);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.appendFileSync(evidencePath,
      '## Task Complete — ' + iso() + '\n\n- **Task ID**: ' + task.id +
      '\n- **Description**: ' + task.description +
      '\n- **Evidence**: ' + args.evidence_summary + '\n\n', 'utf-8');
    task.evidence_paths.push('.lazytrae/evidence/' + evidenceFile);

    work.updated_at = iso();
    b.updated_at = iso();
    writeJSON(bp, b);

    return {
      marked_complete: true, work_id: b.active_work_id,
      task_id: task.id, task_index: taskIndex,
      task_description: task.description, completed_at: task.completed_at,
      evidence_paths: task.evidence_paths, evidence_summary: args.evidence_summary,
    };
  });
}

module.exports = { handleRecordEvidence, handleMarkTaskDone };
