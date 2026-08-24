'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { buildSurfaceRecords } = require('./trae-ide-observation-records');

const ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FEATURES = Object.freeze([
  Object.freeze({ canonicalId: 'lazyseries:feature:sandbox', nativeMode: 'observe-only', evidenceTier: 'host-observed' }),
  Object.freeze({ canonicalId: 'lazyseries:feature:mcp', nativeMode: 'observe-only', evidenceTier: 'host-observed' }),
  Object.freeze({ canonicalId: 'lazyseries:feature:model', nativeMode: 'descriptor-only', evidenceTier: 'host-descriptor' }),
  Object.freeze({ canonicalId: 'lazyseries:feature:plan-spec', nativeMode: 'descriptor-only', evidenceTier: 'host-descriptor' }),
  Object.freeze({ canonicalId: 'lazyseries:feature:task', nativeMode: 'descriptor-only', evidenceTier: 'host-descriptor' }),
  Object.freeze({ canonicalId: 'lazyseries:feature:diff', nativeMode: 'observe-only', evidenceTier: 'host-observed' }),
  Object.freeze({ canonicalId: 'lazyseries:feature:remote-ssh', nativeMode: 'descriptor-only', evidenceTier: 'host-descriptor' }),
]);

function fail(message) {
  throw new Error(message);
}

function record(value, name) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') fail(`${name} must be an object`);
  return value;
}

function exactKeys(value, required, optional, name) {
  const keys = Object.keys(record(value, name));
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter(key => !Object.hasOwn(value, key));
  const unknown = keys.filter(key => !allowed.has(key));
  if (missing.length > 0) fail(`${name} missing ${missing.join(', ')}`);
  if (unknown.length > 0) fail(`${name} has unknown fields: ${unknown.join(', ')}`);
}

function text(value, name, pattern = null) {
  if (typeof value !== 'string' || value.length === 0) fail(`${name} must be a non-empty string`);
  if (pattern !== null && !pattern.test(value)) fail(`${name} is malformed`);
}

function timestamp(value, name) {
  text(value, name);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) fail(`${name} is malformed`);
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEndpoint(value) {
  text(value, 'model.base_url');
  let endpoint;
  try { endpoint = new URL(value); } catch { fail('model.base_url is malformed'); }
  if (!['http:', 'https:'].includes(endpoint.protocol)) fail('model.base_url protocol is unsupported');
  endpoint.username = '';
  endpoint.password = '';
  endpoint.search = '';
  endpoint.hash = '';
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '') || '/';
  return endpoint.toString();
}

function normalizeRemoteRoot(value) {
  text(value, 'remote.root');
  try {
    const remote = new URL(value);
    remote.username = '';
    remote.password = '';
    remote.search = '';
    remote.hash = '';
    remote.pathname = remote.pathname.replace(/\/+$/, '') || '/';
    return remote.toString();
  } catch {
    return value.trim().replace(/\/+$/, '') || '/';
  }
}

function parseFeatureObservations(values) {
  if (!Array.isArray(values)) fail('feature_observations must be an array');
  const statuses = new Map();
  values.forEach((value, index) => {
    exactKeys(value, ['canonical_id', 'status'], [], `feature_observations[${index}]`);
    text(value.canonical_id, `feature_observations[${index}].canonical_id`, ID);
    if (!['observed', 'unsupported'].includes(value.status)) fail(`feature_observations[${index}].status is unsupported`);
    if (statuses.has(value.canonical_id)) fail(`duplicate feature observation: ${value.canonical_id}`);
    statuses.set(value.canonical_id, value.status);
  });
  const expected = new Set(FEATURES.map(feature => feature.canonicalId));
  if (statuses.size !== expected.size || [...statuses.keys()].some(id => !expected.has(id))) fail('feature_observations must cover the canonical Trae IDE feature set exactly');
  return statuses;
}

function observeTraeIde(snapshot, { now = new Date().toISOString() } = {}) {
  exactKeys(snapshot, [
    'schema_version', 'contract_version', 'record_type', 'host', 'observation_id', 'session_id',
    'observed_at', 'expires_at', 'source_receipt', 'sandbox', 'mcp', 'model', 'plan_spec', 'task',
    'diff', 'remote', 'feature_observations',
  ], [], 'snapshot');
  if (snapshot.schema_version !== 1) fail('schema_version is unsupported');
  if (snapshot.contract_version !== '1.1.0') fail('contract_version is unsupported');
  if (snapshot.record_type !== 'trae-ide-native-snapshot') fail('record_type must be trae-ide-native-snapshot');
  if (snapshot.host !== 'trae-ide') fail('host must be trae-ide');
  text(snapshot.observation_id, 'observation_id', ID);
  text(snapshot.session_id, 'session_id', ID);
  timestamp(snapshot.observed_at, 'observed_at');
  timestamp(snapshot.expires_at, 'expires_at');
  timestamp(now, 'now');

  exactKeys(snapshot.source_receipt, ['receipt_id', 'sha256'], [], 'source_receipt');
  text(snapshot.source_receipt.receipt_id, 'source_receipt.receipt_id', ID);
  text(snapshot.source_receipt.sha256, 'source_receipt.sha256', SHA256);
  exactKeys(snapshot.sandbox, ['mode', 'network', 'bypassed', 'permission_mutation_observed', 'filesystem_mode', 'terminal_mode'], [], 'sandbox');
  if (!['read-only', 'workspace-write'].includes(snapshot.sandbox.mode)) fail('sandbox.mode is unsupported');
  if (!['restricted', 'enabled'].includes(snapshot.sandbox.network)) fail('sandbox.network is unsupported');
  if (!['read-only', 'workspace-write'].includes(snapshot.sandbox.filesystem_mode)) fail('sandbox.filesystem_mode is unsupported');
  if (!['integrated', 'external', 'unavailable'].includes(snapshot.sandbox.terminal_mode)) fail('sandbox.terminal_mode is unsupported');
  if (typeof snapshot.sandbox.bypassed !== 'boolean' || typeof snapshot.sandbox.permission_mutation_observed !== 'boolean') fail('sandbox flags must be boolean');
  exactKeys(snapshot.model, ['base_url', 'expected_endpoint_fingerprint', 'context_window_tokens', 'tool_rounds_supported'], ['credential'], 'model');
  if (snapshot.model.credential !== undefined && typeof snapshot.model.credential !== 'string') fail('model.credential must be a string');
  text(snapshot.model.expected_endpoint_fingerprint, 'model.expected_endpoint_fingerprint', SHA256);
  exactKeys(snapshot.remote, ['root', 'expected_root_fingerprint', 'identity'], ['credential'], 'remote');
  if (snapshot.remote.credential !== undefined && typeof snapshot.remote.credential !== 'string') fail('remote.credential must be a string');
  text(snapshot.remote.expected_root_fingerprint, 'remote.expected_root_fingerprint', SHA256);
  const statuses = parseFeatureObservations(snapshot.feature_observations);
  const surfaceRecords = buildSurfaceRecords(snapshot);
  const modelEndpointFingerprint = fingerprint(normalizeEndpoint(snapshot.model.base_url));
  const remoteRootFingerprint = fingerprint(normalizeRemoteRoot(snapshot.remote.root));
  const invalidations = [];
  if (snapshot.sandbox.bypassed) invalidations.push('sandbox-bypass');
  if (snapshot.sandbox.permission_mutation_observed) invalidations.push('permission-mutation');
  if (modelEndpointFingerprint !== snapshot.model.expected_endpoint_fingerprint) invalidations.push('model-endpoint-changed');
  if (remoteRootFingerprint !== snapshot.remote.expected_root_fingerprint) invalidations.push('remote-root-changed');
  if (Date.parse(snapshot.expires_at) <= Date.parse(now) || Date.parse(snapshot.expires_at) <= Date.parse(snapshot.observed_at)) invalidations.push('observation-stale');

  return {
    schema_version: 1,
    contract_version: '1.1.0',
    record_type: 'trae-ide-observation-descriptor',
    descriptor_id: `descriptor:${snapshot.observation_id}`,
    observation_id: snapshot.observation_id,
    host: 'trae-ide',
    session_id: snapshot.session_id,
    status: invalidations.length === 0 ? 'valid' : 'invalid',
    observed_at: snapshot.observed_at,
    expires_at: snapshot.expires_at,
    remote_root_fingerprint: remoteRootFingerprint,
    model_endpoint_fingerprint: modelEndpointFingerprint,
    invalidations,
    source_receipt: { ...snapshot.source_receipt, redacted: true },
    surface_records: surfaceRecords,
    feature_descriptors: FEATURES.map(feature => ({
      canonical_id: feature.canonicalId,
      host_card: { card_id: `trae-ide:card:${feature.canonicalId.split(':').at(-1)}`, canonical_id: feature.canonicalId, read_only: true },
      native_mode: feature.nativeMode,
      evidence_tier: feature.evidenceTier,
      observation_status: statuses.get(feature.canonicalId),
    })),
  };
}

function cli(argv) {
  const [file, now = new Date().toISOString()] = argv;
  if (file === undefined) fail('usage: trae-ide-observation.js <snapshot.json> [now]');
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  process.stdout.write(`${JSON.stringify(observeTraeIde(snapshot, { now }))}\n`);
}

if (require.main === module) {
  try { cli(process.argv.slice(2)); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { FEATURES, fingerprint, normalizeEndpoint, normalizeRemoteRoot, observeTraeIde };
