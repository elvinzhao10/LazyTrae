const fs = require('fs');
const path = require('path');
const { resolveRepoPath } = require('./path-boundary');
const { validatePlanCheckboxes } = require('./plan-checkbox-parser');
const {
  computeExecutableMilestones,
  parseDecisionGates,
  parseMilestones,
  validateDecisionGate,
  validateMilestones,
} = require('./progressive-plan');

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
  const error = validatePlanCheckboxes(fs.readFileSync(resolved.path, 'utf8'));
  if (error) return { valid: false, error };
  return { valid: true, path: resolved.path };
}

function validateActivePlans(repoRoot, boulder) {
  if (!boulder || !boulder.active_work_id) return [];
  const work = boulder.works && boulder.works[boulder.active_work_id];
  if (!work) return [`active work ${boulder.active_work_id} is missing from boulder.json`];
  const result = validateActivePlan(repoRoot, work.active_plan);
  return result.valid ? [] : [`${work.active_plan || '(missing)'}: ${result.error}`];
}

// v1.3.0 additive: normalize persisted active-plan state so execution_intent
// is stored separately from workflow_mode and current_stage. Default is
// plan_only (never execute by a mere file edit or ambiguous approval).
function normalizeExecutionState(state) {
  const s = state && typeof state === 'object' && !Array.isArray(state) ? { ...state } : {};
  if (s.execution_intent !== 'execute' && s.execution_intent !== 'plan_only') {
    s.execution_intent = 'plan_only';
  }
  if (typeof s.workflow_mode !== 'string' || s.workflow_mode.length === 0) {
    s.workflow_mode = s.mode || null;
  }
  if (typeof s.current_stage !== 'string' || s.current_stage.length === 0) {
    s.current_stage = s.currentStage || null;
  }
  return s;
}

// Parse milestone_flags from a plan body and validate them. Returns the same
// shape as validateMilestones in ./progressive-plan.
function parsePlanMilestones(planText, options) {
  return validateMilestones(planText, options || {});
}

module.exports = {
  computeExecutableMilestones,
  normalizeExecutionState,
  parseDecisionGates,
  parseMilestones,
  parsePlanMilestones,
  validateActivePlan,
  validateActivePlans,
  validateDecisionGate,
  validateMilestones,
};
