'use strict';
const { execFileSync } = require('node:child_process');
const { hash, safeRead, readJSON } = require('./dashboard-files');
const { CURRENT_VERSION } = require('./version');
function source(root) {
  const options = { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
    const dirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all', '--', '.', ':(exclude).lazytrae'], options).trim();
    return { head, clean: dirty === '' };
  } catch (error) {
    if (error.status !== undefined || error.code === 'ENOENT') return { head: null, clean: false };
    throw error;
  }
}
function planHash(goal) {
  return hash(JSON.stringify({ id: goal.id, objective: goal.objective, depends_on: goal.depends_on ?? [],
    criteria: goal.successCriteria.map(c => ({ id: c.id, requirement: c.scenario, version: c.dashboardVersion ?? 1, scenarios: c.dashboardScenarios ?? [] })) }));
}
function assess(root, loop, goal, criterion, identity) {
  const attempts = (loop.dashboard_attempts ?? []).filter(a => a.task_id === goal.id && a.criterion_id === criterion.id);
  const current = attempts.at(-1);
  if (!identity.clean || !current || current.execution !== 'finished' || ['paused', 'cancelled'].includes(loop.loop_state)) return false;
  if (current.source_revision !== identity.head || current.plan_revision !== (loop.plan_revision ?? 0) || current.criterion_version !== (criterion.dashboardVersion ?? 1)) return false;
  try {
    const receipt = readJSON(root, current.receipt_path);
    if (receipt.schema !== 'lazytrae.dashboard-verification.v1' || receipt.package_version !== CURRENT_VERSION || receipt.attempt_id !== current.id ||
      receipt.run_id !== loop.run_id || receipt.task_id !== goal.id || receipt.criterion_id !== criterion.id || receipt.plan_sha256 !== planHash(goal) ||
      receipt.source_revision !== identity.head || receipt.plan_revision !== current.plan_revision || receipt.criterion_version !== current.criterion_version) return false;
    const { executor, verifier } = receipt;
    if (!executor || !verifier || executor.identity === verifier.identity || executor.script === verifier.script || executor.script_sha256 === verifier.script_sha256 ||
      executor.exit_code !== 0 || verifier.exit_code !== 0 || !executor.finished_at || !verifier.finished_at || verifier.started_at < executor.finished_at) return false;
    return [executor, verifier].every(item => item.identity && item.pid > 0 &&
      hash(safeRead(root, item.script)) === item.script_sha256 &&
      item.artifact.sha256 === hash(safeRead(root, item.artifact.path)) && safeRead(root, item.artifact.path).length > 0);
  } catch (error) {
    if (error.code || error instanceof SyntaxError) return false;
    throw error;
  }
}
module.exports = { source, planHash, assess };
