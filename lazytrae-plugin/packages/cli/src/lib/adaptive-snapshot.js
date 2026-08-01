'use strict';

const REQUIRED_FIELDS = [
  'approval',
  'blocker',
  'capabilityClasses',
  'capabilitySubstitutions',
  'currentStage',
  'decisionId',
  'escalationCount',
  'escalationHistory',
  'hostFingerprint',
  'mode',
  'nextAction',
  'reasons',
  'requestDigest',
  'responsibilities',
  'revisionFingerprint',
  'risk',
  'scopeFingerprint',
  'stages',
  'verificationLevel',
  'version',
];

const VALID_MODES = ['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'];
const VALID_RISKS = ['high', 'low', 'material', 'standard'];
const VALID_VERIFICATION = ['targeted', 'standard', 'independent', 'live-surface'];
const VALID_CAPABILITIES = ['architecture-context', 'documentation', 'execution',
  'outcome-verification', 'semantic-navigation', 'structural-search', 'task-state', 'text-search'];
const VALID_RESPONSIBILITIES = ['continuity', 'debugging', 'exploration', 'implementation',
  'planning', 'quality-review', 'release-review', 'security-review', 'verification'];
const VALID_STAGES = ['continue', 'debug', 'implement', 'plan', 'review', 'understand', 'verify'];
const VALID_APPROVAL_CLASSES = ['account-marketplace-or-publish-mutation', 'browser-or-desktop-control',
  'credentials-auth-or-paid-service', 'host-mcp-settings-mutation', 'install-or-download',
  'persistent-capability', 'remote-data-egress'];
const VALID_DOWNGRADES = ['additional-verification-required', 'none', 'reduced-confidence'];
const VALID_TRIGGERS = ['broader-scope-revealed', 'capability-unavailable', 'new-risk-finding',
  'user-goal-changed', 'verification-failure'];
const APPROVAL_FIELDS = ['requiredClasses', 'status'];
const BLOCKER_FIELDS = ['attemptedApproaches', 'currentEvidence', 'nextRequiredDecision',
  'reproducedFailure', 'unresolvedDecision'];
const REVISION_FIELDS = ['digest', 'status'];
const SUBSTITUTION_FIELDS = ['allowedSubstitutionClasses', 'evidenceDowngrade', 'explanation',
  'requiredClass'];
const TRANSITION_FIELDS = ['fromMode', 'sequence', 'stageAdded', 'toMode', 'trigger'];
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const NONPORTABLE_TEXT = /runtimeResolution|host-native|package-lsp|package-cli|package-loop-store|lsp-bridge|\/Users\/|\\Users\\|\.worktrees\/|\.trae\/|\.lazytrae\/|(^|\s)(src|lib|packages|tests?)\/|provider[=:]|host[=:]/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value, { nonempty = false } = {}) {
  return Array.isArray(value)
    && (!nonempty || value.length > 0)
    && value.every((entry) => typeof entry === 'string' && entry.length > 0)
    && new Set(value).size === value.length;
}

function hasExactKeys(value, fields) {
  if (!isPlainObject(value)) return false;
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort());
}

function isEnumArray(value, allowed, { nonempty = true } = {}) {
  return isStringArray(value, { nonempty }) && value.every((entry) => allowed.includes(entry));
}

function isPortableText(value) {
  return typeof value === 'string' && value.length > 0 && !NONPORTABLE_TEXT.test(value);
}

function validApproval(value) {
  if (!hasExactKeys(value, APPROVAL_FIELDS)
    || !isEnumArray(value.requiredClasses, VALID_APPROVAL_CLASSES, { nonempty: false })) return false;
  if (!['denied', 'granted', 'not-required', 'pending'].includes(value.status)) return false;
  return value.status === 'not-required'
    ? value.requiredClasses.length === 0
    : value.requiredClasses.length > 0;
}

function validRevision(value) {
  if (!hasExactKeys(value, REVISION_FIELDS)
    || !['available', 'unavailable'].includes(value.status)) return false;
  return value.status === 'available' ? SHA256.test(value.digest) : value.digest === null;
}

function validBlocker(value) {
  if (value === null) return true;
  if (!hasExactKeys(value, BLOCKER_FIELDS)
    || !Array.isArray(value.attemptedApproaches)
    || value.attemptedApproaches.length === 0
    || !value.attemptedApproaches.every(isPortableText)) return false;
  return ['currentEvidence', 'nextRequiredDecision', 'reproducedFailure', 'unresolvedDecision']
    .every((field) => isPortableText(value[field]));
}

function validSubstitutions(value) {
  return Array.isArray(value) && value.every((entry) => hasExactKeys(entry, SUBSTITUTION_FIELDS)
    && isEnumArray(entry.allowedSubstitutionClasses, VALID_CAPABILITIES)
    && VALID_DOWNGRADES.includes(entry.evidenceDowngrade)
    && isPortableText(entry.explanation)
    && VALID_CAPABILITIES.includes(entry.requiredClass));
}

function validEscalations(snapshot) {
  if (!Number.isInteger(snapshot.escalationCount)
    || snapshot.escalationCount < 0 || snapshot.escalationCount > 2
    || !Array.isArray(snapshot.escalationHistory)
    || snapshot.escalationHistory.length !== snapshot.escalationCount) return false;
  return snapshot.escalationHistory.every((entry, index) => hasExactKeys(entry, TRANSITION_FIELDS)
    && entry.sequence === index + 1
    && VALID_MODES.includes(entry.fromMode)
    && VALID_MODES.includes(entry.toMode)
    && (entry.stageAdded === null || VALID_STAGES.includes(entry.stageAdded))
    && VALID_TRIGGERS.includes(entry.trigger));
}

function validateAdaptiveSnapshot(snapshot) {
  if (!hasExactKeys(snapshot, REQUIRED_FIELDS)) return false;
  if (snapshot.version !== 1 || typeof snapshot.decisionId !== 'string'
    || !/^[a-z0-9-]+$/.test(snapshot.decisionId)) return false;
  if (!VALID_MODES.includes(snapshot.mode) || !VALID_RISKS.includes(snapshot.risk)) return false;
  if (!VALID_VERIFICATION.includes(snapshot.verificationLevel)) return false;
  if (!isEnumArray(snapshot.stages, VALID_STAGES)
    || !snapshot.stages.includes(snapshot.currentStage)) return false;
  if (!isEnumArray(snapshot.responsibilities, VALID_RESPONSIBILITIES)) return false;
  if (!isEnumArray(snapshot.capabilityClasses, VALID_CAPABILITIES)) return false;
  if (!validSubstitutions(snapshot.capabilitySubstitutions)) return false;
  if (!Array.isArray(snapshot.reasons) || snapshot.reasons.length === 0
    || !snapshot.reasons.every(isPortableText) || !isPortableText(snapshot.nextAction)) return false;
  if (!SHA256.test(snapshot.requestDigest) || !SHA256.test(snapshot.scopeFingerprint)
    || !SHA256.test(snapshot.hostFingerprint)) return false;
  return validApproval(snapshot.approval)
    && validRevision(snapshot.revisionFingerprint)
    && validBlocker(snapshot.blocker)
    && validEscalations(snapshot);
}

function readAdaptiveSnapshot(loopState) {
  if (!isPlainObject(loopState) || !isPlainObject(loopState.adaptive)) return null;
  return loopState.adaptive;
}

function writeAdaptiveSnapshot(loopState, snapshot) {
  if (!isPlainObject(loopState)) throw new Error('writeAdaptiveSnapshot: loopState must be a plain object');
  if (!validateAdaptiveSnapshot(snapshot)) {
    throw new Error('writeAdaptiveSnapshot: snapshot does not satisfy the canonical v1 shape');
  }
  loopState.adaptive = JSON.parse(JSON.stringify(snapshot));
  return loopState.adaptive;
}

function clearAdaptiveSnapshot(loopState) {
  if (isPlainObject(loopState)) loopState.adaptive = null;
}

module.exports = {
  REQUIRED_FIELDS,
  VALID_MODES,
  clearAdaptiveSnapshot,
  readAdaptiveSnapshot,
  validateAdaptiveSnapshot,
  writeAdaptiveSnapshot,
};
