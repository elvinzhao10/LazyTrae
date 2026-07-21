'use strict';

// Adaptive snapshot persistence helpers for v1.0.3.
//
// Single-writer rule (plan Section 11): only the adaptive orchestrator writes
// the `adaptive` block on the active-loop state. Skills, agents, hooks, and
// MCPs read the snapshot or return results to the orchestrator. These helpers
// are the canonical mutation surface for the orchestrator; they do not add
// cross-process locking or compare-and-swap.
//
// Pure functions only — no imports, no side effects beyond the passed-in
// loopState object. The existing atomic-write mechanism (loop-store.saveLoop)
// remains responsible for durably persisting the state file.

const REQUIRED_FIELDS = [
  'mode',
  'stages',
  'responsibilities',
  'capabilities',
  'not_selected',
  'approval_required',
  'reasons',
  'started_at',
  'updated_at',
  'completed_at',
  'escalation_count',
  'escalation_history',
  'last_resolution',
  'single_writer',
];

// Single-writer rule (plan Section 11): only the adaptive orchestrator may write
// the `adaptive` block. Mirrors lazybuddy_adaptive_snapshot.SINGLE_WRITER.
const SINGLE_WRITER = 'orchestrator';

const VALID_MODES = [
  'direct',
  'assisted',
  'planned',
  'orchestrated',
  'long-horizon',
];

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function isNonNegativeInteger(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isObjectArray(value) {
  return (
    Array.isArray(value) &&
    value.every((item) => isPlainObject(item))
  );
}

// Returns true if the snapshot has all 14 required fields per Section 11
// with the correct shapes and the single_writer const equal to "orchestrator".
function validateAdaptiveSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) return false;
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, field)) return false;
  }
  if (typeof snapshot.mode !== 'string') return false;
  if (!VALID_MODES.includes(snapshot.mode)) return false;
  if (!isStringArray(snapshot.stages)) return false;
  if (!isStringArray(snapshot.responsibilities)) return false;
  if (!isStringArray(snapshot.capabilities)) return false;
  if (!isPlainObject(snapshot.not_selected)) return false;
  if (!isStringArray(snapshot.not_selected.stages)) return false;
  if (!isStringArray(snapshot.not_selected.capabilities)) return false;
  if (typeof snapshot.approval_required !== 'boolean') return false;
  if (!isStringArray(snapshot.reasons)) return false;
  if (!isNullableString(snapshot.started_at)) return false;
  if (!isNullableString(snapshot.updated_at)) return false;
  if (!isNullableString(snapshot.completed_at)) return false;
  if (!isNonNegativeInteger(snapshot.escalation_count)) return false;
  if (!isObjectArray(snapshot.escalation_history)) return false;
  if (snapshot.last_resolution !== null && !isPlainObject(snapshot.last_resolution)) {
    return false;
  }
  if (snapshot.single_writer !== SINGLE_WRITER) return false;
  return true;
}

// Returns the adaptive block from loop state, or null when absent.
// Reads v1.0.2 state files (without the `adaptive` field) as null.
function readAdaptiveSnapshot(loopState) {
  if (!isPlainObject(loopState)) return null;
  return loopState.adaptive || null;
}

// Validates the snapshot, sets loopState.adaptive, and stamps `updated_at`
// with the current ISO timestamp. Throws on invalid snapshot shape.
function writeAdaptiveSnapshot(loopState, snapshot) {
  if (!isPlainObject(loopState)) {
    throw new Error('writeAdaptiveSnapshot: loopState must be a plain object');
  }
  if (!validateAdaptiveSnapshot(snapshot)) {
    throw new Error(
      'writeAdaptiveSnapshot: snapshot does not satisfy Section 11 shape',
    );
  }
  const stamped = { ...snapshot, updated_at: new Date().toISOString() };
  loopState.adaptive = stamped;
  return loopState.adaptive;
}

// Clears the adaptive block by setting it to null. Idempotent.
function clearAdaptiveSnapshot(loopState) {
  if (!isPlainObject(loopState)) return;
  loopState.adaptive = null;
}

module.exports = {
  REQUIRED_FIELDS,
  VALID_MODES,
  validateAdaptiveSnapshot,
  readAdaptiveSnapshot,
  writeAdaptiveSnapshot,
  clearAdaptiveSnapshot,
};
