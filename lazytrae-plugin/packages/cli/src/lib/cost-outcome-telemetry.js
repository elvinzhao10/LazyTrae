const fs = require('node:fs');
const path = require('node:path');
const { runTransaction } = require('./state-transaction');
const { validateCostOutcome } = require('../../contracts/validate-lazyseries-record');

const STORE_VERSION = 'lazyseries.cost-outcome-store.v1';
const RETENTION = 20;

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

module.exports = { recordCostOutcome };
