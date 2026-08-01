'use strict';

const { readAdaptiveSnapshot, validateAdaptiveSnapshot } = require('./adaptive-snapshot');

const MAX_ESCALATIONS = 2;
const ALL_STAGES = ['understand', 'plan', 'implement', 'debug', 'verify', 'review', 'continue'];
const ALL_RESPONSIBILITIES = [
  'exploration', 'planning', 'implementation', 'debugging', 'verification',
  'quality-review', 'security-review', 'release-review', 'continuity',
];
const ALL_CAPABILITIES = [
  'text-search', 'structural-search', 'semantic-navigation', 'architecture-context',
  'documentation', 'execution', 'task-state', 'outcome-verification',
];

function difference(universe, selected) {
  return universe.filter((item) => !selected.includes(item)).sort();
}

function adaptiveExplanationFields(loopState) {
  const snapshot = readAdaptiveSnapshot(loopState);
  if (!validateAdaptiveSnapshot(snapshot)) return null;
  return {
    mode: snapshot.mode,
    stages: [...snapshot.stages],
    responsibilities: [...snapshot.responsibilities],
    capabilityClasses: [...snapshot.capabilityClasses],
    notSelected: {
      stages: difference(ALL_STAGES, snapshot.stages),
      responsibilities: difference(ALL_RESPONSIBILITIES, snapshot.responsibilities),
      capabilityClasses: difference(ALL_CAPABILITIES, snapshot.capabilityClasses),
    },
    approval: JSON.parse(JSON.stringify(snapshot.approval)),
    evidenceImpact: {
      substitutions: JSON.parse(JSON.stringify(snapshot.capabilitySubstitutions)),
      verificationLevel: snapshot.verificationLevel,
    },
    escalation: { count: snapshot.escalationCount, maximum: MAX_ESCALATIONS },
    hostExecution: 'not-observed',
    reasons: [...snapshot.reasons],
  };
}

function formatList(items) {
  return items.length ? items.join(', ') : 'none';
}

function formatAdaptiveExplanation(loopState) {
  const fields = adaptiveExplanationFields(loopState);
  if (!fields) return null;
  const notSelected = [
    ...fields.notSelected.stages,
    ...fields.notSelected.responsibilities,
    ...fields.notSelected.capabilityClasses,
  ];
  const approval = fields.approval.status === 'not-required'
    ? 'not-required'
    : `${fields.approval.status}: ${formatList(fields.approval.requiredClasses)}`;
  const evidenceImpact = fields.evidenceImpact.substitutions.length
    ? `substituted capability classes; ${fields.evidenceImpact.verificationLevel} verification`
    : `${fields.evidenceImpact.verificationLevel} verification; no substitutions`;
  const lines = [
    'Adaptive decision:',
    `Mode: ${fields.mode}`,
    `Stages: ${formatList(fields.stages)}`,
    `Responsibilities: ${formatList(fields.responsibilities)}`,
    `Capability classes: ${formatList(fields.capabilityClasses)}`,
    `Not selected: ${formatList(notSelected)}`,
    `Approval: ${approval}`,
    `Evidence impact: ${evidenceImpact}`,
    `Escalations: ${fields.escalation.count}/${fields.escalation.maximum}`,
    `Host execution: ${fields.hostExecution}`,
    'Reasons:',
    ...fields.reasons.map((reason) => `- ${reason}`),
  ];
  return lines.join('\n');
}

module.exports = {
  MAX_ESCALATIONS,
  adaptiveExplanationFields,
  formatAdaptiveExplanation,
};
