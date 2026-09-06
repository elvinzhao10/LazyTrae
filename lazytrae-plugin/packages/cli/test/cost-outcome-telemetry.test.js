'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const packageRoot = path.resolve(__dirname, '..');
const telemetryPath = path.join(packageRoot, 'src', 'lib', 'cost-outcome-telemetry.js');
const telemetry = require(telemetryPath);

function record(runId, overrides = {}) {
  return {
    schema_version: 'lazyseries.cost-outcome.v1',
    run_id: runId,
    project_identity: 'fixture/project',
    route: 'affected',
    risk_reason: 'changed-runtime-input',
    elapsed_ms: 25,
    tool_invocations: 3,
    agent_invocations: 1,
    evidence_bytes: 128,
    reruns: 0,
    rework_count: 0,
    gate_outcomes: [{ gate_id: 'runtime-check', outcome: 'passed' }],
    tokens: { source: 'native', input_tokens: 10, output_tokens: 5, unavailable_reason: null },
    ...overrides,
  };
}

function invoke(projectRoot, entry, env = {}) {
  return spawnSync(process.execPath, [
    '-e',
    `require(process.argv[1]).recordCostOutcome(process.argv[2], JSON.parse(process.argv[3]))`,
    telemetryPath,
    projectRoot,
    JSON.stringify(entry),
  ], { cwd: packageRoot, encoding: 'utf8', env: { ...process.env, ...env } });
}

function readStore(projectRoot) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, '.lazytrae', 'state', 'telemetry', 'cost-outcomes.json'), 'utf8'));
}

test('production telemetry persists validated measured cost outcomes without baseline claims', (t) => {
  // Given
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-telemetry-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true }));
  // When
  telemetry.recordCostOutcome(projectRoot, record('affected-1'));
  telemetry.recordCostOutcome(projectRoot, record('comprehensive-1', {
    route: 'comprehensive',
    risk_reason: 'release-sensitive-change',
    agent_invocations: 5,
    reruns: 2,
  }));
  // Then
  const store = readStore(projectRoot);
  assert.equal(store.current_run.route, 'comprehensive');
  assert.equal(store.current_run.agent_invocations, 5);
  assert.equal(store.current_run.tokens.input_tokens, 10);
  assert.equal(store.completed.length, 2);
  assert.deepEqual(store.completed.map(({ run_id: runId }) => runId), ['affected-1', 'comprehensive-1']);
  assert.deepEqual(store.current_run.gate_outcomes, [{ gate_id: 'runtime-check', outcome: 'passed' }]);
});

test('retains only latest twenty completed records', (t) => {
  // Given
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-telemetry-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true }));
  // When
  for (let index = 0; index < 22; index += 1) {
    telemetry.recordCostOutcome(projectRoot, record(`retention-${index}`));
  }
  // Then
  const store = readStore(projectRoot);
  assert.equal(store.completed.length, 20);
  assert.deepEqual(store.completed.map(({ run_id: runId }) => runId), Array.from({ length: 20 }, (_, index) => `retention-${index + 2}`));
});

test('recovers an interrupted telemetry transaction on the next write', (t) => {
  // Given
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-telemetry-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true }));
  // When
  const interrupted = invoke(projectRoot, record('interrupted-1'), { LAZYTRAE_TRANSACTION_CRASH_AT: 'commit' });
  const recovered = invoke(projectRoot, record('recovered-1'));
  // Then
  assert.equal(interrupted.status, 86);
  assert.equal(recovered.status, 0);
  const store = readStore(projectRoot);
  assert.deepEqual(store.completed.map(({ run_id: runId }) => runId), ['interrupted-1', 'recovered-1']);
});
