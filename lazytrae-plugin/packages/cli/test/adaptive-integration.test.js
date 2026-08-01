'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { adaptiveExplanationFields } = require('../src/lib/adaptive-explanation');
const { mapAdaptiveDecisionToSurfaces } = require('../src/lib/adaptive-mapping');
const {
  readAdaptiveSnapshot,
  validateAdaptiveSnapshot,
  writeAdaptiveSnapshot,
} = require('../src/lib/adaptive-snapshot');
const { defaultLoop } = require('../src/lib/loop-store');

const FIXTURES_DIR = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103');

function fixtures() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
  return manifest.fixtures.map((entry) => JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, entry.file), 'utf8'),
  ));
}

test('fixture decision maps and round-trips through the one production snapshot shape', () => {
  for (const fixture of fixtures()) {
    const decision = classifyAdaptiveDecision(fixture.request, fixture.context);
    const mapping = mapAdaptiveDecisionToSurfaces(decision);
    const loop = defaultLoop();
    const written = writeAdaptiveSnapshot(loop, decision.snapshot);
    assert.equal(mapping.host_qualification, 'unverified', fixture.id);
    assert.equal(
      mapping.workflow_surfaces.length > 0,
      decision.mode !== 'direct',
      fixture.id,
    );
    assert.equal(validateAdaptiveSnapshot(written), true, fixture.id);
    assert.deepEqual(readAdaptiveSnapshot(loop), decision.snapshot, fixture.id);
    assert.equal(adaptiveExplanationFields(loop).mode, decision.mode, fixture.id);
  }
});

test('canonical adaptive state survives JSON serialization without translation', () => {
  const loop = defaultLoop();
  const decision = classifyAdaptiveDecision('Plan a broad feature.', {
    scope: 'broad',
    acceptance_criteria: 'incomplete',
  });
  writeAdaptiveSnapshot(loop, decision.snapshot);
  const restored = JSON.parse(JSON.stringify(loop));
  assert.deepEqual(readAdaptiveSnapshot(restored), decision.snapshot);
  assert.equal(validateAdaptiveSnapshot(restored.adaptive), true);
});

test('a later canonical write replaces only the adaptive block', () => {
  const loop = { ...defaultLoop(), unrelated_future_field: { keep: true } };
  const first = classifyAdaptiveDecision('Fix one typo.');
  const second = classifyAdaptiveDecision('Plan a broad feature.', {
    scope: 'broad',
    acceptance_criteria: 'incomplete',
  });
  writeAdaptiveSnapshot(loop, first.snapshot);
  writeAdaptiveSnapshot(loop, second.snapshot);
  assert.deepEqual(loop.adaptive, second.snapshot);
  assert.deepEqual(loop.unrelated_future_field, { keep: true });
});

test('integration boundaries reject malformed classifier and snapshot inputs', () => {
  assert.throws(() => mapAdaptiveDecisionToSurfaces(null), /ADAPTIVE_MAPPING_INVALID_DECISION/);
  assert.throws(() => mapAdaptiveDecisionToSurfaces({}), /ADAPTIVE_MAPPING_INVALID_DECISION/);
  const loop = defaultLoop();
  assert.throws(() => writeAdaptiveSnapshot(loop, null), /canonical v1 shape/);
  assert.equal(loop.adaptive, null);
});
