'use strict';

// Adaptive explanation formatter (v1.0.3 Section 13 Transparency).
//
// Surfaces the selected/not-selected reasoning persisted in the adaptive
// snapshot through existing status output. Pure function — no side effects,
// no I/O. The caller is responsible for loading loopState and writing the
// result. Reads v1.0.2 state (no `adaptive` block) as null so the existing
// status surface stays backward-compatible.

const { readAdaptiveSnapshot } = require('./adaptive-snapshot');

const MAX_ESCALATIONS = 2;

function formatList(items) {
  if (!Array.isArray(items) || items.length === 0) return 'none';
  return items.join(', ');
}

function collectNotSelected(snapshot) {
  const ns = snapshot.not_selected;
  if (!ns || typeof ns !== 'object') return [];
  const stages = Array.isArray(ns.stages) ? ns.stages : [];
  const caps = Array.isArray(ns.capabilities) ? ns.capabilities : [];
  return [...stages, ...caps];
}

// Returns "cap=value" strings for every last_resolution entry whose value
// matches the Section 9 unavailable:fallback-… substitution marker.
function collectSubstitutions(lastResolution) {
  if (!lastResolution || typeof lastResolution !== 'object') return [];
  const out = [];
  for (const [cap, value] of Object.entries(lastResolution)) {
    if (typeof value === 'string' && /^unavailable:fallback-/i.test(value)) {
      out.push(`${cap}=${value}`);
    }
  }
  return out;
}

function formatAdaptiveExplanation(loopState) {
  const snapshot = readAdaptiveSnapshot(loopState);
  if (!snapshot || typeof snapshot !== 'object') return null;

  const mode = typeof snapshot.mode === 'string' ? snapshot.mode : 'unknown';
  const stages = Array.isArray(snapshot.stages) ? snapshot.stages : [];
  const responsibilities = Array.isArray(snapshot.responsibilities)
    ? snapshot.responsibilities
    : [];
  const capabilities = Array.isArray(snapshot.capabilities)
    ? snapshot.capabilities
    : [];
  const notSelected = collectNotSelected(snapshot);
  const approvalRequired = snapshot.approval_required === true ? 'yes' : 'no';
  const escalationCount = Number.isFinite(snapshot.escalation_count)
    ? snapshot.escalation_count
    : 0;
  const singleWriter = typeof snapshot.single_writer === 'string'
    ? snapshot.single_writer
    : 'unknown';
  const reasons = Array.isArray(snapshot.reasons) ? snapshot.reasons : [];
  const substitutions = collectSubstitutions(snapshot.last_resolution);

  const lines = [];
  lines.push('Adaptive decision:');
  lines.push(`Mode: ${mode}`);
  lines.push(`Stages: ${formatList(stages)}`);
  lines.push(`Responsibilities: ${formatList(responsibilities)}`);
  lines.push(`Capabilities: ${formatList(capabilities)}`);
  lines.push(`Not selected: ${formatList(notSelected)}`);
  lines.push(`Approval required: ${approvalRequired}`);
  lines.push(`Escalations: ${escalationCount}/${MAX_ESCALATIONS}`);
  lines.push(`Single writer: ${singleWriter}`);
  if (substitutions.length > 0) {
    lines.push(`Substituted: ${substitutions.join(', ')}`);
  }
  if (reasons.length > 0) {
    lines.push('Reasons:');
    for (const r of reasons) lines.push(`- ${r}`);
  }

  return lines.join('\n');
}

module.exports = {
  MAX_ESCALATIONS,
  formatAdaptiveExplanation,
};
