'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const {
  MAX_ESCALATIONS,
  adaptiveExplanationFields,
  formatAdaptiveExplanation,
} = require('../src/lib/adaptive-explanation');

function loopFor(prompt, context = {}) {
  return {
    version: 1,
    run_id: 'run-test',
    loop_state: 'active',
    goals: [],
    adaptive: classifyAdaptiveDecision(prompt, context).snapshot,
  };
}

test('structured explanation exposes every portable transparency field', () => {
  const fields = adaptiveExplanationFields(loopFor('Fix one typo in one file.'));
  assert.equal(fields.mode, 'direct');
  assert.deepEqual(fields.stages, ['implement', 'verify']);
  assert.deepEqual(fields.responsibilities, ['implementation', 'verification']);
  assert.deepEqual(fields.capabilityClasses, ['outcome-verification', 'text-search']);
  assert.equal(fields.notSelected.stages.includes('plan'), true);
  assert.equal(fields.notSelected.responsibilities.includes('planning'), true);
  assert.equal(fields.notSelected.capabilityClasses.includes('task-state'), true);
  assert.deepEqual(fields.approval, { requiredClasses: [], status: 'not-required' });
  assert.equal(fields.evidenceImpact.verificationLevel, 'targeted');
  assert.equal(fields.hostExecution, 'not-observed');
});

test('status formatter includes required explanation labels and truthful host boundary', () => {
  const output = formatAdaptiveExplanation(loopFor(
    'Install a provider before fixing this security authorization flow.',
  ));
  for (const label of [
    'Mode:', 'Stages:', 'Responsibilities:', 'Capability classes:', 'Not selected:',
    'Approval:', 'Evidence impact:', 'Escalations:', 'Host execution: not-observed',
  ]) assert.equal(output.includes(label), true, `missing ${label}`);
  assert.match(output, /pending: install-or-download/);
});

test('explanation rejects absent or malformed adaptive state', () => {
  assert.equal(adaptiveExplanationFields(null), null);
  assert.equal(formatAdaptiveExplanation({ version: 1 }), null);
  assert.equal(formatAdaptiveExplanation({ adaptive: 'invalid' }), null);
  assert.equal(formatAdaptiveExplanation({ adaptive: { mode: 'direct' } }), null);
});

test('capability substitution carries its evidence downgrade into structured status', () => {
  const fields = adaptiveExplanationFields(loopFor('Diagnose this cross-file defect.', {
    scope: 'cross-file',
    signals: { capability_unavailable: true },
  }));
  assert.equal(fields.evidenceImpact.substitutions.length, 1);
  assert.equal(
    fields.evidenceImpact.substitutions[0].evidenceDowngrade,
    'additional-verification-required',
  );
  assert.match(formatAdaptiveExplanation({ adaptive: loopFor(
    'Diagnose this cross-file defect.',
    { scope: 'cross-file', signals: { capability_unavailable: true } },
  ).adaptive }), /substituted capability classes/);
});

test('bounded escalation is reported from the canonical camelCase fields', () => {
  const fields = adaptiveExplanationFields(loopFor('Fix one typo.', {
    scope_revealed_broader: true,
    signals: { verification_failure: true },
  }));
  assert.equal(MAX_ESCALATIONS, 2);
  assert.deepEqual(fields.escalation, { count: 2, maximum: 2 });
});
