const fs = require('fs');
const path = require('path');
const { resolveRepoPath } = require('./path-boundary');

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function validateActivePlan(repoRoot, activePlan) {
  if (typeof activePlan !== 'string' || activePlan.trim() === '') {
    return { valid: false, error: 'active plan must be a regular file inside .lazytrae/plans' };
  }

  const plansDir = path.join(repoRoot, '.lazytrae', 'plans');
  const candidate = path.resolve(repoRoot, activePlan);
  if (!isInside(plansDir, candidate)) {
    return { valid: false, error: 'active plan must be a regular file inside .lazytrae/plans' };
  }

  const resolved = resolveRepoPath(repoRoot, activePlan, { mustExist: true });
  if (!resolved.ok) return { valid: false, error: resolved.error };
  if (fs.lstatSync(candidate).isSymbolicLink() || !fs.statSync(resolved.path).isFile()) {
    return { valid: false, error: 'active plan must be a regular file inside .lazytrae/plans' };
  }

  const realPlansDir = fs.realpathSync.native(plansDir);
  if (!isInside(realPlansDir, resolved.path)) {
    return { valid: false, error: 'active plan must be a regular file inside .lazytrae/plans' };
  }
  return { valid: true, path: resolved.path };
}

function validateActivePlans(repoRoot, boulder) {
  if (!boulder || !boulder.active_work_id) return [];
  const work = boulder.works && boulder.works[boulder.active_work_id];
  if (!work) return [`active work ${boulder.active_work_id} is missing from boulder.json`];
  const result = validateActivePlan(repoRoot, work.active_plan);
  return result.valid ? [] : [`${work.active_plan || '(missing)'}: ${result.error}`];
}

module.exports = { validateActivePlan, validateActivePlans };
