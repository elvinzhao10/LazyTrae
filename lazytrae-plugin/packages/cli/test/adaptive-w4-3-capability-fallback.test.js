'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fixture = require('../contracts/fixtures/v103/08-preferred-provider-unavailable.json');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { adaptiveExplanationFields } = require('../src/lib/adaptive-explanation');
const { mapAdaptiveDecisionToSurfaces } = require('../src/lib/adaptive-mapping');
const { readAdaptiveSnapshot, writeAdaptiveSnapshot } = require('../src/lib/adaptive-snapshot');
const { defaultLoop } = require('../src/lib/loop-store');

function decision() {
  return classifyAdaptiveDecision(fixture.request, fixture.context);
}

test('W4.3 unavailable preferred capability uses only the contract substitution classes', () => {
  const result = decision();
  assert.equal(result.mode, 'assisted');
  assert.deepEqual(result.allowed_substitutions, fixture.expected_decision.allowed_substitutions);
  assert.deepEqual(result.snapshot.capabilitySubstitutions, result.allowed_substitutions);
  assert.equal(result.approval_required, false);
  assert.equal(JSON.stringify(result).includes('provider'), false);
});

test('W4.3 substitution retains the selected capability class and compensating evidence', () => {
  const result = decision();
  const substitution = result.allowed_substitutions[0];
  assert.equal(result.capabilities.includes(substitution.requiredClass), true);
  assert.deepEqual(substitution.allowedSubstitutionClasses, ['structural-search', 'text-search']);
  assert.equal(substitution.evidenceDowngrade, 'additional-verification-required');
  assert.match(substitution.explanation, /additional verification/i);
});

test('W4.3 fallback survives canonical persistence and status explanation', () => {
  const result = decision();
  const loop = defaultLoop();
  writeAdaptiveSnapshot(loop, result.snapshot);
  assert.deepEqual(readAdaptiveSnapshot(loop).capabilitySubstitutions, result.allowed_substitutions);
  const fields = adaptiveExplanationFields(loop);
  assert.equal(fields.evidenceImpact.substitutions.length, 1);
  assert.equal(fields.evidenceImpact.verificationLevel, 'standard');
});

test('W4.3 mapping stays on the existing assisted workflow surface', () => {
  const mapping = mapAdaptiveDecisionToSurfaces(decision());
  assert.deepEqual(mapping.workflow_surfaces, ['lazy-start-work']);
  assert.equal(mapping.host_qualification, 'unverified');
});
