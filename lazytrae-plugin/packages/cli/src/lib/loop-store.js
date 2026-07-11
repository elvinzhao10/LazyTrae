const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('./path-boundary');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, '.lazytrae'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(repoRoot, filePath, data) {
  assertSafeRepoWritePath(repoRoot, filePath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(temp, filePath);
}

function statePath(repoRoot) {
  return path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json');
}

function logPath(repoRoot) {
  return path.join(repoRoot, '.lazytrae', 'logs', 'loop-events.ndjson');
}

function loadLoop(repoRoot) {
  return readJSON(statePath(repoRoot));
}

function defaultLoop() {
  const now = new Date().toISOString();
  const runId = `run-${Date.now()}`;
  const loopDir = `.lazytrae/loop/${runId}`;
  return {
    version: 1,
    run_id: runId,
    loop_state: 'idle',
    loop_mode: 'ultrawork',
    current_task_index: 0,
    iteration: 0,
    max_iterations: 500,
    retry_count: 0,
    max_retries: 3,
    reviewer_issues: [],
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: now,
    updated_at: now,
    brief_path: `${loopDir}/brief.md`,
    goals_path: `${loopDir}/goals.json`,
    ledger_path: `${loopDir}/ledger.jsonl`,
    codex_goal_mode: 'aggregate',
    codex_objective: null,
    codex_objective_aliases: [],
    active_goal_id: null,
    aggregate_completion: null,
    goals: [],
    checkpoints: [],
    failure_attempts: [],
    review_blockers: [],
  };
}

function requireLoop(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) throw new Error('No active loop found.');
  loop.goals = loop.goals || [];
  loop.checkpoints = loop.checkpoints || [];
  loop.failure_attempts = loop.failure_attempts || [];
  loop.review_blockers = loop.review_blockers || [];
  return loop;
}

function saveLoop(repoRoot, loop) {
  loop.updated_at = new Date().toISOString();
  writeJSON(repoRoot, statePath(repoRoot), loop);
}

function appendEvent(repoRoot, loop, mutation, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    run_id: loop.run_id || null,
    event_type: mutation,
    mutation,
    loop_state: loop.loop_state || 'idle',
    active_goal_id: loop.active_goal_id || null,
    details,
  };
  const filePath = logPath(repoRoot);
  assertSafeRepoWritePath(repoRoot, filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  return entry;
}

function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const item = args[i];
    if (item.startsWith('--')) {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) flags[item] = true;
      else {
        flags[item] = next;
        i += 1;
      }
    } else positional.push(item);
  }
  return { flags, positional };
}

module.exports = {
  appendEvent,
  defaultLoop,
  detectRepoRoot,
  loadLoop,
  parseArgs,
  requireLoop,
  saveLoop,
  statePath,
};
