'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { validateEvidencePaths } = require('../src/lib/completion-gates');
const { validateAdaptiveSnapshot } = require('../src/lib/adaptive-snapshot');

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

test('W4.6 canonical snapshot records available or fail-closed revision freshness', () => {
  const available = classifyAdaptiveDecision('Fix one typo.', {
    revisionFingerprint: { status: 'available', digest: digest('revision') },
  });
  const unavailable = classifyAdaptiveDecision('Fix one typo.');
  assert.deepEqual(available.snapshot.revisionFingerprint, {
    status: 'available',
    digest: digest('revision'),
  });
  assert.deepEqual(unavailable.snapshot.revisionFingerprint, { status: 'unavailable', digest: null });
  assert.equal(validateAdaptiveSnapshot(available.snapshot), true);
  assert.equal(validateAdaptiveSnapshot(unavailable.snapshot), true);
});

test('W4.6 changed revision invalidates prior completion and requires reclassification', () => {
  const prompt = 'Continue the bounded correction.';
  const identity = {
    revisionFingerprint: { status: 'available', digest: digest('old') },
    scopeFingerprint: digest('scope'),
    hostFingerprint: digest('host'),
  };
  const prior = classifyAdaptiveDecision(prompt, { ...identity, decisionId: 'decision-old' }).snapshot;
  const current = classifyAdaptiveDecision(prompt, {
    ...identity,
    revisionFingerprint: { status: 'available', digest: digest('new') },
    priorSnapshot: prior,
    prior_completion_recorded: true,
  });
  assert.notEqual(current.snapshot.decisionId, 'decision-old');
  assert.equal(current.snapshot.currentStage, 'understand');
  assert.match(current.reasons.join(' '), /stale|changed materially/i);
});

test('W4.6 unavailable current revision can never resume an available prior decision', () => {
  const prompt = 'Continue the bounded correction.';
  const prior = classifyAdaptiveDecision(prompt, {
    revisionFingerprint: { status: 'available', digest: digest('old') },
    scopeFingerprint: digest('scope'),
    hostFingerprint: digest('host'),
    decisionId: 'decision-old',
  }).snapshot;
  const current = classifyAdaptiveDecision(prompt, {
    revisionFingerprint: { status: 'unavailable', digest: null },
    scopeFingerprint: digest('scope'),
    hostFingerprint: digest('host'),
    priorSnapshot: prior,
  });
  assert.notEqual(current.snapshot.decisionId, 'decision-old');
});

test('W4.6 existing completion gate rejects missing, blank, and empty evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-adaptive-evidence-'));
  fs.writeFileSync(path.join(root, 'empty.txt'), '');
  assert.match(validateEvidencePaths(root, ['missing.txt'])[0], /missing/);
  assert.match(validateEvidencePaths(root, [''])[0], /blank/);
  assert.match(validateEvidencePaths(root, ['empty.txt'])[0], /empty/);
  fs.rmSync(root, { recursive: true, force: true });
});
