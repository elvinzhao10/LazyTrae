// W2.2 adaptive-mapping tests for the v1.0.3 Adaptive Harness release.
//
// Purpose: validate the adaptive-mapping module that maps an adaptive
// decision (output of classifyAdaptiveDecision) onto existing LazyTrae
// workflow surfaces per plan Section 10. Covers all 5 modes, authority
// matrix population, and adversarial inputs.

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const {
  KNOWN_MODES,
  MODE_SURFACES,
  STATUS_SURFACE,
  VERIFICATION_SURFACE,
  loadAdaptiveContract,
  mapAdaptiveDecisionToSurfaces,
} = require('../src/lib/adaptive-mapping');

const EXPECTED_VERIFICATION = 'completion-gates.js';
const EXPECTED_STATUS = 'completion-status';

// Representative inputs per mode. Each input is fed through
// classifyAdaptiveDecision to produce a real decision object that the
// mapping adapter consumes. This proves the mapping works against the
// actual W2.1 classifier output, not a hand-rolled stub.
const MODE_INPUTS = {
  direct: { request: 'Fix the typo in README.md', context: {} },
  assisted: { request: 'Debug the cross-file bug in user.js', context: { scope: 'bounded' } },
  planned: {
    request: 'Build a feature with unresolved design choices',
    context: { scope: 'broad', acceptance_criteria: 'incomplete' },
  },
  orchestrated: {
    request: 'Change the authorization logic for security',
    context: { risk_signals: ['security'] },
  },
  'long-horizon': {
    request: 'Multi-session database migration',
    context: { session_scope: 'multi-session' },
  },
};

function decisionFor(mode) {
  const c = MODE_INPUTS[mode];
  const d = classifyAdaptiveDecision(c.request, c.context);
  assert.equal(d.mode, mode, `fixture for ${mode} produced ${d.mode}`);
  return d;
}

// Sanity: KNOWN_MODES matches the 5 modes the contract defines.
test('known modes cover all 5 contract modes', () => {
  assert.deepEqual(KNOWN_MODES, ['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon']);
});

// Category 1: each of the 5 modes maps to the expected surfaces.
test('mode mapping: direct has no workflow surfaces and none orchestration', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('direct'));
  assert.deepEqual(m.workflow_surfaces, []);
  assert.equal(m.verification_surface, EXPECTED_VERIFICATION);
  assert.equal(m.status_surface, EXPECTED_STATUS);
  assert.equal(m.orchestration_surface, 'none');
});

test('mode mapping: assisted maps to lazy-start-work', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('assisted'));
  assert.deepEqual(m.workflow_surfaces, ['lazy-start-work']);
  assert.equal(m.verification_surface, EXPECTED_VERIFICATION);
  assert.equal(m.status_surface, EXPECTED_STATUS);
  assert.equal(m.orchestration_surface, 'start-work');
});

test('mode mapping: planned maps to lazy-ulw-plan then lazy-start-work', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('planned'));
  assert.deepEqual(m.workflow_surfaces, ['lazy-ulw-plan', 'lazy-start-work']);
  assert.equal(m.verification_surface, EXPECTED_VERIFICATION);
  assert.equal(m.status_surface, EXPECTED_STATUS);
  assert.equal(m.orchestration_surface, 'start-work');
});

test('mode mapping: orchestrated includes lazy-reviewer surface', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('orchestrated'));
  assert.deepEqual(m.workflow_surfaces, ['lazy-ulw-plan', 'lazy-start-work', 'lazy-reviewer']);
  assert.equal(m.verification_surface, EXPECTED_VERIFICATION);
  assert.equal(m.status_surface, EXPECTED_STATUS);
  assert.equal(m.orchestration_surface, 'start-work');
});

test('mode mapping: long-horizon includes lazy-ulw-loop and loop-runtime orchestration', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('long-horizon'));
  assert.deepEqual(m.workflow_surfaces, ['lazy-ulw-plan', 'lazy-start-work', 'lazy-ulw-loop']);
  assert.equal(m.verification_surface, EXPECTED_VERIFICATION);
  assert.equal(m.status_surface, EXPECTED_STATUS);
  assert.equal(m.orchestration_surface, 'loop-runtime');
});

// Category 2: responsibility_owners is populated from contract authority_matrix.
test('responsibility_owners: populated from contract authority_matrix', () => {
  const contract = loadAdaptiveContract();
  const expectedMatrix = contract.authority_matrix;
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('planned'));
  // All 9 responsibilities from the authority_matrix are present.
  assert.deepEqual(m.responsibility_owners, expectedMatrix);
  for (const r of ['continuity', 'debugging', 'exploration', 'implementation',
    'planning', 'quality-review', 'release-review', 'security-review', 'verification']) {
    assert.equal(m.responsibility_owners[r], 'automatic', `${r} should be automatic`);
  }
});

// Category 3: direct mode has empty workflow_surfaces (explicit re-check).
test('direct mode: workflow_surfaces is empty (minimal surface set)', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('direct'));
  assert.equal(Array.isArray(m.workflow_surfaces), true);
  assert.equal(m.workflow_surfaces.length, 0);
});

// Category 4: orchestrated mode includes the reviewer surface.
test('orchestrated mode: lazy-reviewer present in workflow_surfaces', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('orchestrated'));
  assert.ok(m.workflow_surfaces.includes('lazy-reviewer'),
    'orchestrated must include lazy-reviewer (Reviewer/Oracle)');
});

// Category 5: long-horizon mode includes the loop surface.
test('long-horizon mode: lazy-ulw-loop present in workflow_surfaces', () => {
  const m = mapAdaptiveDecisionToSurfaces(decisionFor('long-horizon'));
  assert.ok(m.workflow_surfaces.includes('lazy-ulw-loop'),
    'long-horizon must include lazy-ulw-loop');
});

// Category 6: adversarial inputs.
test('adversarial: null decision throws ADAPTIVE_MAPPING_INVALID_DECISION', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces(null),
    /ADAPTIVE_MAPPING_INVALID_DECISION: missing/);
});

test('adversarial: undefined decision throws ADAPTIVE_MAPPING_INVALID_DECISION', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces(undefined),
    /ADAPTIVE_MAPPING_INVALID_DECISION: missing/);
});

test('adversarial: decision missing mode throws ADAPTIVE_MAPPING_INVALID_DECISION', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces({ stages: [] }),
    /ADAPTIVE_MAPPING_INVALID_DECISION: missing/);
});

test('adversarial: decision with empty-string mode throws', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces({ mode: '' }),
    /ADAPTIVE_MAPPING_INVALID_DECISION: missing/);
});

test('adversarial: decision with unknown mode throws', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces({ mode: 'ultra-deep' }),
    /ADAPTIVE_MAPPING_INVALID_DECISION: ultra-deep/);
});

test('adversarial: non-object decision throws', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces('planned'),
    /ADAPTIVE_MAPPING_INVALID_DECISION/);
  assert.throws(() => mapAdaptiveDecisionToSurfaces(42),
    /ADAPTIVE_MAPPING_INVALID_DECISION/);
  assert.throws(() => mapAdaptiveDecisionToSurfaces(['planned']),
    /ADAPTIVE_MAPPING_INVALID_DECISION/);
});

// Immutability: returned arrays/objects are fresh copies; mutating one
// result must not affect subsequent results or the frozen MODE_SURFACES.
test('immutability: returned workflow_surfaces is a fresh copy', () => {
  const m1 = mapAdaptiveDecisionToSurfaces(decisionFor('planned'));
  m1.workflow_surfaces.push('tampered');
  m1.responsibility_owners.bogus = 'tampered';
  const m2 = mapAdaptiveDecisionToSurfaces(decisionFor('planned'));
  assert.deepEqual(m2.workflow_surfaces, ['lazy-ulw-plan', 'lazy-start-work']);
  assert.equal(m2.responsibility_owners.bogus, undefined);
  // The frozen source must also be unaffected.
  assert.deepEqual(MODE_SURFACES.planned.workflows, ['lazy-ulw-plan', 'lazy-start-work']);
});

// Constants sanity: VERIFICATION_SURFACE and STATUS_SURFACE match the
// LazyTrae-expected surfaces (plan Section 10).
test('constants: VERIFICATION_SURFACE and STATUS_SURFACE are correct', () => {
  assert.equal(VERIFICATION_SURFACE, 'completion-gates.js');
  assert.equal(STATUS_SURFACE, 'completion-status');
});

// Cross-check: the workflow surfaces for every mode are a subset of the
// installed LazyTrae Skills/commands (lazy-ulw-plan, lazy-start-work,
// lazy-ulw-loop, lazy-reviewer). This guards against typos in the mapping
// table. We do not require the surfaces to be installed on disk here; we
// only require them to be the canonical names declared in MODE_SURFACES.
test('cross-check: every workflow surface is a canonical LazyTrae surface name', () => {
  const canonical = new Set(['lazy-ulw-plan', 'lazy-start-work', 'lazy-ulw-loop', 'lazy-reviewer']);
  for (const mode of KNOWN_MODES) {
    for (const surface of MODE_SURFACES[mode].workflows) {
      assert.ok(canonical.has(surface), `unknown surface ${surface} for mode ${mode}`);
    }
  }
});
