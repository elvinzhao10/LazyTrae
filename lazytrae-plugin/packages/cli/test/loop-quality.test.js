const assert = require('node:assert/strict');
const test = require('node:test');
const { validateQualityGate } = require('../src/lib/loop-quality');
const {
  OLD_QUALITY_GATE_PATH,
  QUALITY_GATE_PATH,
  makeCanonicalQualityGate,
  makeLoopFixture,
  writeCanonicalQualityGate,
  writeJson,
} = require('./test-helpers');

function assertQualityGateError(root, relativePath, pattern) {
  assert.throws(() => validateQualityGate(root, relativePath), pattern);
}

test('validateQualityGate accepts canonical LazyCodex quality gate JSON', () => {
  const fixture = makeLoopFixture('lazytrae-quality-canonical-');

  const result = validateQualityGate(fixture, QUALITY_GATE_PATH);

  assert.equal(result.path, QUALITY_GATE_PATH);
  assert.equal(result.gate.codeReview.by, 'lazycodex-code-reviewer');
  assert.equal(result.gate.manualQa.surfaceEvidence[0].surface, 'cli');
});

test('validateQualityGate rejects the old snake_case local gate', () => {
  const fixture = makeLoopFixture('lazytrae-quality-old-local-');

  assertQualityGateError(fixture, OLD_QUALITY_GATE_PATH, /codeReview/);
});

test('validateQualityGate rejects missing manualQa.surfaceEvidence', () => {
  const fixture = makeLoopFixture('lazytrae-quality-no-surface-');

  assertQualityGateError(fixture, '.omo/evidence/bad-quality.json', /manualQa\.surfaceEvidence/);
});

test('validateQualityGate rejects gateReview.blockers', () => {
  const fixture = makeLoopFixture('lazytrae-quality-blockers-');
  const gate = makeCanonicalQualityGate();
  gate.gateReview.blockers = ['manual QA artifact missing'];
  writeCanonicalQualityGate(fixture, '.omo/evidence/gate-blockers.json', gate);

  assertQualityGateError(fixture, '.omo/evidence/gate-blockers.json', /gateReview\.blockers/);
});

test('validateQualityGate rejects a missing artifact path', () => {
  const fixture = makeLoopFixture('lazytrae-quality-missing-artifact-');
  const gate = makeCanonicalQualityGate();
  gate.manualQa.artifactRefs[0].path = '.omo/evidence/missing-artifact.txt';
  writeJson(fixture, '.omo/evidence/missing-artifact-gate.json', gate);

  assertQualityGateError(fixture, '.omo/evidence/missing-artifact-gate.json', /manualQa\.artifactRefs\[0\]\.path/);
});

test('validateQualityGate rejects criteriaCoverage passCount below totalCriteria', () => {
  const fixture = makeLoopFixture('lazytrae-quality-coverage-');
  const gate = makeCanonicalQualityGate();
  gate.criteriaCoverage.totalCriteria = 2;
  gate.criteriaCoverage.passCount = 1;
  writeCanonicalQualityGate(fixture, '.omo/evidence/bad-coverage.json', gate);

  assertQualityGateError(fixture, '.omo/evidence/bad-coverage.json', /criteriaCoverage\.passCount/);
});
