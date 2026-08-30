const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('./path-boundary');
const { recoverTransactions, runTransaction } = require('./state-transaction');

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

function statePath(repoRoot) {
  return path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json');
}

function logPath(repoRoot) {
  return path.join(repoRoot, '.lazytrae', 'logs', 'loop-events.ndjson');
}

function canonicalEventPath(repoRoot, loop) {
  return path.join(repoRoot, loopArtifactPaths(loop).ledger_path.replace(/ledger\.jsonl$/, 'canonical-events.jsonl'));
}

function loopArtifactPaths(loop) {
  const runId = loop.run_id;
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    throw new Error('Loop run_id must be a safe path segment.');
  }
  const loopDir = `.lazytrae/loop/${runId}`;
  return {
    brief_path: `${loopDir}/brief.md`,
    goals_path: `${loopDir}/goals.json`,
    ledger_path: `${loopDir}/ledger.jsonl`,
  };
}

function loadLoop(repoRoot) {
  recoverTransactions(repoRoot);
  return readJSON(statePath(repoRoot));
}

function defaultLoop() {
  const now = new Date().toISOString();
  const runId = `run-${Date.now()}`;
  const artifacts = loopArtifactPaths({ run_id: runId });
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
    ...artifacts,
    codex_goal_mode: 'aggregate',
    codex_objective: null,
    codex_objective_aliases: [],
    active_goal_id: null,
    aggregate_completion: null,
    goals: [],
    checkpoints: [],
    failure_attempts: [],
    review_blockers: [],
    adaptive: null,
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
  Object.assign(loop, loopArtifactPaths(loop));
  loop.updated_at = new Date().toISOString();
  runTransaction(repoRoot, loop.run_id, () => ({ members: [
    { path: statePath(repoRoot), content: JSON.stringify(loop, null, 2) + '\n' },
    { path: path.join(repoRoot, loop.goals_path), content: JSON.stringify(loop.goals, null, 2) + '\n' },
  ] }));
}

function eventLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').trim();
  return text.length === 0 ? [] : text.split('\n').map(line => JSON.parse(line));
}

function appendUniqueContent(repoRoot, filePath, entry) {
  assertSafeRepoWritePath(repoRoot, filePath);
  const entries = eventLines(filePath);
  const prior = entries.find(item => item.event_id === entry.event_id);
  if (prior) {
    if (JSON.stringify(prior) !== JSON.stringify(entry)) {
      throw new Error(`Event id collision for ${entry.event_id}.`);
    }
    return { content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0), recorded: false };
  }
  return { content: Buffer.from(`${entries.map(item => JSON.stringify(item)).join('\n')}${entries.length ? '\n' : ''}${JSON.stringify(entry)}\n`), recorded: true };
}

function appendEvent(repoRoot, loop, mutation, details = {}, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString();
  const eventId = options.eventId || `evt:${crypto.randomUUID()}`;
  if (typeof mutation !== 'string' || mutation.length === 0
    || typeof eventId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{2,127}$/.test(eventId)
    || Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Canonical package event is malformed.');
  }
  const canonical = {
    schema_version: 1,
    event_id: eventId,
    ts: timestamp,
    run_id: loop.run_id || null,
    event: mutation,
    event_payload: details,
  };
  const entry = {
    timestamp,
    event_id: eventId,
    run_id: loop.run_id || null,
    event_type: mutation,
    mutation,
    loop_state: loop.loop_state || 'idle',
    active_goal_id: loop.active_goal_id || null,
    details,
  };
  return runTransaction(repoRoot, loop.run_id, () => {
    const canonicalPath = canonicalEventPath(repoRoot, loop);
    const filePath = logPath(repoRoot);
    const ledgerFile = path.join(repoRoot, loopArtifactPaths(loop).ledger_path);
    const canonicalWrite = appendUniqueContent(repoRoot, canonicalPath, canonical);
    const productWrite = appendUniqueContent(repoRoot, filePath, entry);
    const ledgerWrite = appendUniqueContent(repoRoot, ledgerFile, entry);
    return {
      members: [
        { path: canonicalPath, content: canonicalWrite.content },
        { path: filePath, content: productWrite.content },
        { path: ledgerFile, content: ledgerWrite.content },
      ],
      result: { outcome: canonicalWrite.recorded ? 'recorded' : 'duplicate', canonical, event: entry },
    };
  });
}

function persistBrief(repoRoot, loop, brief) {
  const artifacts = loopArtifactPaths(loop);
  Object.assign(loop, artifacts);
  runTransaction(repoRoot, loop.run_id, () => ({ members: [
    { path: path.join(repoRoot, artifacts.brief_path), content: brief },
  ] }));
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
  canonicalEventPath,
  defaultLoop,
  detectRepoRoot,
  loadLoop,
  loopArtifactPaths,
  parseArgs,
  persistBrief,
  requireLoop,
  saveLoop,
  statePath,
};
