const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('../lib/path-boundary');

/**
 * State file read/write helpers for MCP tools and CLI.
 * All paths are relative to the repo root.
 */

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (fs.existsSync(path.join(dir, '.lazytraework'))) return dir;
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

function writeJSON(filePath, data) {
  assertSafeWrite(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.' + process.pid + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, filePath);
}

function assertSafeWrite(filePath) {
  const marker = `${path.sep}.lazytraework${path.sep}`;
  const index = filePath.indexOf(marker);
  if (index < 0) throw new Error('write path must be inside .lazytraework');
  assertSafeRepoWritePath(filePath.slice(0, index), filePath);
}

function iso() {
  return new Date().toISOString();
}

function withFileLock(filePath, fn) {
  assertSafeWrite(filePath);
  const lockDir = filePath + '.lock';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  for (let i = 0; i < 20; i++) {
    try {
      fs.mkdirSync(lockDir);
    } catch (e) {
      if (e.code === 'EEXIST') {
        // lock held — wait and retry
        const start = Date.now();
        while (Date.now() - start < 5) { /* spin */ }
        continue;
      }
      throw e;
    }
    try {
      return fn();
    } finally {
      try { fs.rmdirSync(lockDir); } catch (_) { /* ignore */ }
    }
  }
  throw new Error('LOCK_CONTENDED: Could not acquire lock on ' + filePath);
}

/**
 * Get the boulder state object.
 * Ensures works exists as an object.
 */
function getBoulderState(repoRoot) {
  const bp = path.join(repoRoot, '.lazytraework', 'state', 'boulder.json');
  const b = readJSON(bp);
  if (!b) return null;
  if (!b.works) b.works = {};
  if (!b.active_work_id) b.active_work_id = null;
  return b;
}

/**
 * Get the active loop state.
 */
function getLoopState(repoRoot) {
  return readJSON(path.join(repoRoot, '.lazytraework', 'state', 'active-loop.json'));
}

/**
 * Get the sessions state.
 */
function getSessionsState(repoRoot) {
  return readJSON(path.join(repoRoot, '.lazytraework', 'state', 'sessions.json'));
}

/**
 * List evidence files in the evidence directory.
 */
function listEvidence(repoRoot) {
  const ed = path.join(repoRoot, '.lazytraework', 'evidence');
  if (!fs.existsSync(ed)) return [];
  return fs.readdirSync(ed).filter(f => f.endsWith('.md'));
}

/**
 * Get the active work entry from boulder state, or null.
 */
function getActiveWork(repoRoot) {
  const b = getBoulderState(repoRoot);
  if (!b || !b.active_work_id || !b.works[b.active_work_id]) return null;
  return b.works[b.active_work_id];
}

module.exports = {
  detectRepoRoot,
  readJSON,
  writeJSON,
  assertSafeWrite,
  iso,
  withFileLock,
  getBoulderState,
  getLoopState,
  getSessionsState,
  listEvidence,
  getActiveWork,
};
