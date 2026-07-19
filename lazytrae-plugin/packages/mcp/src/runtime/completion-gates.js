const fs = require('fs');
const path = require('path');
const { localCommand } = require('./local-command');
const { resolveRepoPath } = require('./path-boundary');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (fs.existsSync(path.join(dir, '.lazytrae'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

function resolveEvidencePath(repoRoot, evidencePath) {
  if (typeof evidencePath !== 'string' || evidencePath.trim() === '') return null;
  const resolved = resolveRepoPath(repoRoot, evidencePath, { mustExist: true });
  return resolved.ok ? resolved.path : null;
}

function validateEvidencePaths(repoRoot, evidencePaths) {
  if (!Array.isArray(evidencePaths) || evidencePaths.length === 0) {
    return ['no evidence_paths recorded'];
  }
  const errors = [];
  for (const evidencePath of evidencePaths) {
    if (typeof evidencePath !== 'string' || evidencePath.trim() === '') {
      errors.push('blank evidence path');
      continue;
    }
    const resolved = resolveRepoPath(repoRoot, evidencePath, { mustExist: true });
    if (!resolved.ok) {
      if (resolved.error.startsWith('path does not exist')) errors.push(`evidence missing: ${evidencePath}`);
      else errors.push(`invalid evidence path: ${evidencePath} (${resolved.error})`);
      continue;
    }
    const stat = fs.statSync(resolved.path);
    if (!stat.isFile()) errors.push(`evidence is not a file: ${evidencePath}`);
    else if (stat.size === 0) errors.push(`evidence empty: ${evidencePath}`);
  }
  return errors;
}

function addReason(reasons, gate, message) {
  reasons.push({ gate, message });
}

function inspectBoulder(repoRoot, reasons) {
  const boulder = readJSON(path.join(repoRoot, '.lazytrae', 'state', 'boulder.json'));
  if (!boulder || !boulder.active_work_id) return;
  const work = boulder.works && boulder.works[boulder.active_work_id];
  if (!work) {
    addReason(reasons, 'boulder_task_evidence', `Active work ${boulder.active_work_id} is missing from boulder.json`);
    return;
  }
  for (const blocker of work.blockers || []) {
    addReason(reasons, 'boulder_blocker', `${blocker.task_id || work.work_id}: ${blocker.reason || 'blocker recorded'}`);
  }
  for (const task of work.tasks || []) {
    if (task.status === 'pending' || task.status === 'in_progress') {
      addReason(reasons, 'boulder_task_evidence', `Boulder task ${task.id} is ${task.status}; completion evidence is not recorded yet`);
      continue;
    }
    if (task.status === 'blocked' || task.status === 'failed') {
      addReason(reasons, 'boulder_task_evidence', `Boulder task ${task.id} is ${task.status}`);
      continue;
    }
    if (task.status === 'complete') {
      for (const error of validateEvidencePaths(repoRoot, task.evidence_paths)) {
        addReason(reasons, 'boulder_task_evidence', `Boulder task ${task.id}: ${error}`);
      }
    }
  }
}

function inspectLoop(repoRoot, reasons) {
  const loop = readJSON(path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json'));
  if (!loop) return;
  const goals = Array.isArray(loop.goals) ? loop.goals : [];
  const unfinished = goals.filter(goal => goal.status !== 'complete');
  const activeStates = ['initializing', 'planning', 'active', 'verifying', 'reviewing', 'blocked', 'paused'];
  if (activeStates.includes(loop.loop_state) || loop.active_goal_id || unfinished.length > 0) {
    const detail = unfinished.length > 0 ? `; unfinished goals: ${unfinished.map(goal => goal.id).join(', ')}` : '';
    addReason(reasons, 'loop_completion_gate', `Active loop is ${loop.loop_state || 'unknown'}${detail}`);
  }
  if (loop.loop_state === 'complete') {
    const evidence = loop.aggregate_completion && loop.aggregate_completion.evidence;
    if (!evidence) {
      addReason(reasons, 'loop_completion_gate', 'Completed loop has no aggregate completion evidence');
      return;
    }
    for (const error of validateEvidencePaths(repoRoot, [evidence])) {
      addReason(reasons, 'loop_completion_gate', `Loop completion evidence ${error}`);
    }
  }
}

function getCompletionStatus(repoRoot = detectRepoRoot()) {
  const reasons = [];
  inspectBoulder(repoRoot, reasons);
  inspectLoop(repoRoot, reasons);
  return {
    status: reasons.length === 0 ? 'ready' : 'blocked',
    reasons,
    next_command: reasons.length === 0 ? null : `${localCommand(repoRoot)} verify --must-pass`,
  };
}

function formatCompletionStatus(result) {
  const lines = [result.status];
  if (result.status === 'ready') {
    lines.push('Completion gates satisfied.');
    return lines.join('\n');
  }
  for (const reason of result.reasons) lines.push(`- [${reason.gate}] ${reason.message}`);
  lines.push(`Next command: ${result.next_command || `${localCommand(detectRepoRoot())} completion-status`}`);
  return lines.join('\n');
}

module.exports = {
  detectRepoRoot,
  formatCompletionStatus,
  getCompletionStatus,
  validateEvidencePaths,
};
