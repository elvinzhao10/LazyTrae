'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { executionRevision } = require('../src/lib/harness-execution-context');
const {
  QUALITY_GATE_PATH,
  makeCanonicalQualityGate,
  makeLoopFixture,
  readLoopState,
  runCli,
  writeCanonicalQualityGate,
} = require('./test-helpers');

const LANES = ['goal', 'qa', 'code', 'security', 'context'];

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function prepare(root, options = {}) {
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.lazytrae/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: root }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: root }).status, 0);
  assert.equal(runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', '.lazytrae/evidence/proof.txt'], { cwd: root }).status, 0);
  const statePath = path.join(root, '.lazytrae', 'state', 'active-loop.json');
  const state = readLoopState(root);
  const goal = state.goals[0];
  goal.ownedPaths = options.ownedPaths || ['src/feature.js'];
  goal.planCommands = options.planCommands || [['node', '--test', 'test/feature.test.js']];
  goal.successCriteria[0].runtime = options.runtime !== false;
  goal.executionRevision = executionRevision(goal);
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return goal;
}

function report(goal, overrides = {}) {
  const execution = {
    contractVersion: 1,
    taskDelta: {
      taskId: goal.id,
      revision: goal.executionRevision,
      criterionIds: goal.successCriteria.map(({ id }) => id),
      ownedPaths: goal.ownedPaths,
      artifactRefs: ['artifact-cli-pass'],
    },
    preTask: {
      captureMode: 'read-only',
      status: [' M src/feature.js'],
      ownership: goal.ownedPaths.map((ownedPath) => ({ path: ownedPath, state: 'modified' })),
    },
    commandValidation: {
      runs: 1,
      commands: goal.planCommands.map((argv) => ({ argv, status: 'valid' })),
    },
    terminalReport: {
      status: 'complete',
      taskId: goal.id,
      revision: goal.executionRevision,
      criteria: goal.successCriteria.map(({ id, runtime }) => ({
        id,
        status: 'PASS',
        artifactRefs: ['artifact-cli-pass'],
        ...(runtime ? { transition: { entrypoint: 'lazytrae loop record-evidence', before: 'pending', after: 'pass' } } : {}),
      })),
    },
    reviewLanes: LANES.map((id) => ({
      id,
      prior: id === 'qa' ? 'FAIL' : id === 'context' ? 'STALE' : 'PASS',
      inputAffected: id === 'security',
      rerun: ['qa', 'security', 'context'].includes(id),
      status: 'PASS',
      artifactRef: 'artifact-cli-pass',
    })),
  };
  return { ...execution, ...overrides };
}

function writeGate(root, execution) {
  const gate = makeCanonicalQualityGate();
  gate.execution = execution;
  writeCanonicalQualityGate(root, QUALITY_GATE_PATH, gate);
  return gate;
}

test('checkpoint accepts one compact task-bound terminal report and preserves all five PASS lanes', () => {
  const root = makeLoopFixture('lazytrae-compact-execution-');
  const goal = prepare(root);
  const gate = writeGate(root, report(goal));

  const result = runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: root });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(Buffer.byteLength(JSON.stringify(gate.execution)) < 4096);
  assert.deepEqual(readLoopState(root).final_quality_gate.execution.reviewLanes.map(({ status }) => status), Array(5).fill('PASS'));
});

test('checkpoint rejects incomplete or stale terminal recovery without accepting memory', () => {
  for (const terminalReport of [
    { status: 'missing' },
    { status: 'complete', revision: digest('stale') },
    { status: 'complete', criteria: [] },
  ]) {
    const root = makeLoopFixture('lazytrae-terminal-recovery-');
    const goal = prepare(root);
    const canonical = report(goal);
    writeGate(root, { ...canonical, terminalReport: { ...canonical.terminalReport, ...terminalReport } });
    const before = fs.readFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'));

    const result = runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: root });

    assert.equal(result.status, 1);
    assert.deepEqual(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json')), before);
  }
});

test('checkpoint rejects unsafe or multiply validated plan commands', () => {
  for (const mutation of [
    (execution) => { execution.commandValidation.runs = 2; },
    (execution) => { execution.commandValidation.commands[0].argv.push(';', 'rm', '-rf'); },
    (execution) => { execution.commandValidation.commands = []; },
  ]) {
    const root = makeLoopFixture('lazytrae-command-validation-');
    const goal = prepare(root);
    const execution = report(goal);
    mutation(execution);
    writeGate(root, execution);

    assert.equal(runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: root }).status, 1);
  }
});

test('checkpoint requires exact read-only owned-path provenance and runtime transitions', () => {
  for (const mutation of [
    (execution) => { execution.preTask.captureMode = 'write'; },
    (execution) => { execution.preTask.ownership = []; },
    (execution) => { delete execution.terminalReport.criteria[0].transition; },
    (execution) => { execution.terminalReport.criteria[0].transition.after = 'pending'; },
  ]) {
    const root = makeLoopFixture('lazytrae-provenance-transition-');
    const goal = prepare(root);
    const execution = report(goal);
    mutation(execution);
    writeGate(root, execution);

    assert.equal(runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: root }).status, 1);
  }
});

test('checkpoint reruns only failed missing stale or input-affected lanes', () => {
  for (const mutation of [
    (execution) => { execution.reviewLanes.find(({ id }) => id === 'goal').rerun = true; },
    (execution) => { execution.reviewLanes.find(({ id }) => id === 'qa').rerun = false; },
    (execution) => { execution.reviewLanes.find(({ id }) => id === 'security').rerun = false; },
    (execution) => { execution.reviewLanes.find(({ id }) => id === 'context').status = 'FAIL'; },
  ]) {
    const root = makeLoopFixture('lazytrae-focused-rerun-');
    const goal = prepare(root);
    const execution = report(goal);
    mutation(execution);
    writeGate(root, execution);

    assert.equal(runCli(['loop', 'checkpoint', '--quality-gate-json', QUALITY_GATE_PATH], { cwd: root }).status, 1);
  }
});
