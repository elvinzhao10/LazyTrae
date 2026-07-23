'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');

const FIXTURE_DIR = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

test('W4.4 each selected fixture responsibility has one explicit owner record', () => {
  for (const name of [
    '01-direct-localized-fix.json',
    '02-assisted-cross-file-bug.json',
    '03-planned-broad-feature.json',
    '04-orchestrated-security-change.json',
    '05-orchestrated-release.json',
    '06-long-horizon-migration.json',
  ]) {
    const input = fixture(name);
    const decision = classifyAdaptiveDecision(input.request, input.context);
    assert.deepEqual(decision.ownership, input.expected_decision.ownership, input.id);
    for (const responsibility of decision.responsibilities) {
      assert.equal(
        decision.ownership.filter((entry) => entry.responsibility === responsibility).length,
        1,
        `${input.id}: ${responsibility}`,
      );
    }
  }
});

test('W4.4 independent workstreams select orchestration without duplicate implementers', () => {
  const decision = classifyAdaptiveDecision('Coordinate independent parser and renderer work.', {
    independent_workstreams: [{ id: 'parser' }, { id: 'renderer' }],
  });
  assert.equal(decision.mode, 'orchestrated');
  assert.equal(decision.responsibilities.filter((item) => item === 'implementation').length, 1);
  assert.equal(decision.ownership.filter((entry) => entry.ownerClass === 'independent-reviewer').length > 0, true);
});

test('W4.4 reviewers are distinct from the implementation owner', () => {
  const decision = classifyAdaptiveDecision('Change authorization logic.', {
    risk_signals: ['security-sensitive'],
  });
  const implementation = decision.ownership.find((entry) => entry.responsibility === 'implementation');
  const reviewers = decision.ownership.filter((entry) => entry.ownerClass === 'independent-reviewer');
  assert.equal(implementation.ownerClass, 'implementation-owner');
  assert.equal(reviewers.some((entry) => entry.responsibility === 'security-review'), true);
  assert.equal(reviewers.every((entry) => entry.ownerClass !== implementation.ownerClass), true);
});

test('W4.4 dependent debug-then-fix work keeps one implementation owner', () => {
  const decision = classifyAdaptiveDecision('Fix the failing unit test.', {
    signals: { verification_failure: true },
  });
  assert.equal(decision.mode, 'direct');
  assert.equal(decision.stages.includes('debug'), true);
  assert.equal(decision.responsibilities.filter((item) => item === 'debugging').length, 1);
  assert.equal(decision.responsibilities.filter((item) => item === 'implementation').length, 1);
});
