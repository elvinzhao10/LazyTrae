'use strict';

// Adaptive mapping for v1.0.3. Maps an adaptive decision (output of
// classifyAdaptiveDecision in ./adaptive-decision) to existing LazyTrae
// workflow surfaces per plan Section 10 (Runtime-specific mapping).
//
// This is a thin adapter: it selects existing surfaces (Skills, commands,
// verifiers, orchestrators). It does not duplicate execution logic and
// does not introduce a second orchestration runtime.

const fs = require('fs');
const path = require('path');

const CONTRACT_PATH = path.resolve(__dirname, '..', '..', 'contracts',
  'adaptive-harness-contract.v1.json');

// LazyTrae always uses completion-gates.js for verification and the
// completion-status command for status reporting, regardless of mode.
const VERIFICATION_SURFACE = 'completion-gates.js';
const STATUS_SURFACE = 'completion-status';

// LazyTrae mode -> workflow surface mapping (plan Section 10).
// - direct: user edits directly; no workflow surface.
// - assisted: single-task delegation via lazy-start-work.
// - planned: lazy-ulw-plan, then lazy-start-work.
// - orchestrated: lazy-ulw-plan + lazy-start-work + lazy-reviewer.
// - long-horizon: lazy-ulw-plan + lazy-start-work + lazy-ulw-loop.
const MODE_SURFACES = Object.freeze({
  direct: Object.freeze({
    workflows: Object.freeze([]),
    orchestration: 'none',
  }),
  assisted: Object.freeze({
    workflows: Object.freeze(['lazy-start-work']),
    orchestration: 'start-work',
  }),
  planned: Object.freeze({
    workflows: Object.freeze(['lazy-ulw-plan', 'lazy-start-work']),
    orchestration: 'start-work',
  }),
  orchestrated: Object.freeze({
    workflows: Object.freeze(['lazy-ulw-plan', 'lazy-start-work', 'lazy-reviewer']),
    orchestration: 'start-work',
  }),
  'long-horizon': Object.freeze({
    workflows: Object.freeze(['lazy-ulw-plan', 'lazy-start-work', 'lazy-ulw-loop']),
    orchestration: 'loop-runtime',
  }),
});

const KNOWN_MODES = Object.freeze(Object.keys(MODE_SURFACES));

// Read and parse the adaptive harness contract. The contract carries the
// authority_matrix used to populate responsibility_owners. Reading the JSON
// directly (rather than via automatic-tooling-policy.loadContract, which
// loads the separate automatic-tooling contract) keeps this adapter
// decoupled from unrelated policy concerns.
function loadAdaptiveContract() {
  const bytes = fs.readFileSync(CONTRACT_PATH, 'utf8');
  return JSON.parse(bytes);
}

function isValidDecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    return false;
  }
  if (typeof decision.mode !== 'string' || decision.mode.length === 0) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(MODE_SURFACES, decision.mode);
}

// Map an adaptive decision onto LazyTrae workflow surfaces.
//
// Input: a decision object produced by classifyAdaptiveDecision (must
//   include a `mode` field set to one of: direct, assisted, planned,
//   orchestrated, long-horizon).
//
// Returns:
//   {
//     workflow_surfaces: [...],     // named workflows to invoke
//     responsibility_owners: {...}, // responsibility -> owner (authority_matrix)
//     verification_surface: 'completion-gates.js',
//     status_surface: 'completion-status',
//     orchestration_surface: 'none' | 'start-work' | 'loop-runtime',
//   }
//
// Throws Error('ADAPTIVE_MAPPING_INVALID_DECISION: <mode>') when the input
// is null, missing a mode, or carries an unknown mode.
function mapAdaptiveDecisionToSurfaces(decision) {
  if (!isValidDecision(decision)) {
    const mode = decision && typeof decision === 'object' && decision.mode
      ? decision.mode : 'missing';
    throw new Error(`ADAPTIVE_MAPPING_INVALID_DECISION: ${mode}`);
  }
  const contract = loadAdaptiveContract();
  const authorityMatrix = contract.authority_matrix || {};
  const modeConfig = MODE_SURFACES[decision.mode];
  return {
    workflow_surfaces: [...modeConfig.workflows],
    responsibility_owners: { ...authorityMatrix },
    verification_surface: VERIFICATION_SURFACE,
    status_surface: STATUS_SURFACE,
    orchestration_surface: modeConfig.orchestration,
  };
}

module.exports = {
  KNOWN_MODES,
  MODE_SURFACES,
  STATUS_SURFACE,
  VERIFICATION_SURFACE,
  loadAdaptiveContract,
  mapAdaptiveDecisionToSurfaces,
};
