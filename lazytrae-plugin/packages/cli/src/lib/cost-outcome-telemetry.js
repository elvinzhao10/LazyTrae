const fs = require('node:fs');
const path = require('node:path');
const { runTransaction } = require('./state-transaction');
const { validateCostOutcome } = require('../../contracts/validate-lazyseries-record');

const STORE_VERSION = 'lazyseries.cost-outcome-store.v1';
const RECORD_VERSION = 'lazyseries.cost-outcome.v1';
const RETENTION = 20;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/;

function requireRunId(runId) {
  if (typeof runId !== 'string' || !IDENTITY.test(runId)) {
    throw new Error('Telemetry run_id must be a bounded identity.');
  }
  return runId;
}

function buildCostOutcome(result, runId, elapsedMs) {
  const route = result.scenario === 'direct' ? 'direct' : 'comprehensive';
  return {
    schema_version: RECORD_VERSION,
    run_id: requireRunId(runId),
    project_identity: `${result.product}/project`,
    route,
    risk_reason: route === 'direct' ? 'baseline-direct' : 'baseline-six-module',
    elapsed_ms: Math.max(0, Math.floor(elapsedMs)),
    tool_invocations: result.cost.invocation_count,
    agent_invocations: result.route.actor_count,
    evidence_bytes: result.cost.evidence_bytes,
    reruns: result.cost.reruns,
    rework_count: result.cost.rework,
    gate_outcomes: result.outcome.gate_outcomes.map(({ gate, outcome }) => ({ gate_id: gate, outcome })),
    tokens: {
      source: 'unavailable',
      input_tokens: null,
      output_tokens: null,
      unavailable_reason: 'native token telemetry unavailable from host',
    },
  };
}

function readStore(storePath) {
  if (!fs.existsSync(storePath)) return { schema_version: STORE_VERSION, current_run: null, completed: [] };
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  if (store.schema_version !== STORE_VERSION || !Array.isArray(store.completed)) {
    throw new Error('Cost outcome telemetry store is invalid.');
  }
  return store;
}

function recordCostOutcome(repoRoot, record) {
  const validation = validateCostOutcome(record);
  if (!validation.ok) throw new Error(`Invalid cost outcome: ${validation.errors.join('; ')}`);
  const storePath = path.join(repoRoot, '.lazytrae', 'state', 'telemetry', 'cost-outcomes.json');
  return runTransaction(repoRoot, 'cost-outcome-telemetry', () => {
    const store = readStore(storePath);
    const completed = store.completed.filter(({ run_id: runId }) => runId !== record.run_id);
    completed.push(record);
    const next = {
      schema_version: STORE_VERSION,
      current_run: record,
      completed: completed.slice(-RETENTION),
    };
    return {
      members: [{ path: storePath, content: `${JSON.stringify(next, null, 2)}\n` }],
      result: next,
    };
  });
}

module.exports = { buildCostOutcome, recordCostOutcome };
