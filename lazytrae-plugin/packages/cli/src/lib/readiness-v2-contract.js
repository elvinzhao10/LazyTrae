const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CONTRACT_VERSION = '2.0.0';
const POLICY_DIGEST = '3a65e1d7108c1a607035cbb127117dc5c18d0116ddf88c3e9ca5aaa4db032c4a';
const CONTRACT_SHA256 = '17898bbc1812c445c26bddacbe286d53eabcd5f2add3f30d10c2515942db1f87';
const CONTRACT_PATH = path.resolve(__dirname, '..', '..', 'contracts', 'lazyseries-capability-readiness.v2.json');
const HOSTS = new Set(['codebuddy-cli', 'codebuddy-ide', 'workbuddy', 'trae-cli', 'trae-ide', 'trae-work']);
const REQUIRED_FIELDS = new Set([
  'schema_version', 'contract_version', 'policy_digest', 'host', 'capability', 'provider',
  'internal_status', 'native_mode', 'public_label', 'package_status', 'probe_status',
  'readiness_scope', 'reason_code', 'message', 'evidence',
]);
const EVIDENCE_FIELDS = new Set(['scope', 'ref', 'sha256', 'session_id']);
const INTERNAL_STATE_MAPPING = Object.freeze({
  'package-ready': Object.freeze(['invoke-documented', 'documented-tested', 'ready', 'not-run', 'package']),
  'owned-ready': Object.freeze(['invoke-documented', 'documented-tested', 'ready', 'not-run', 'package']),
  missing: Object.freeze(['unavailable', 'unavailable', 'missing', 'not-run', 'package']),
  incompatible: Object.freeze(['unavailable', 'unavailable', 'incompatible', 'not-run', 'package']),
  disabled: Object.freeze(['descriptor-only', 'documented-untested', 'disabled', 'not-run', 'package']),
  'failed-optional': Object.freeze(['unavailable', 'unavailable', 'failed', 'not-run', 'package']),
  'not-initialized': Object.freeze(['descriptor-only', 'documented-untested', 'not-checked', 'not-run', 'package']),
  'probe-observed': Object.freeze(['observe-only', 'observed-build-specific', 'not-checked', 'observed', 'probe']),
  'current-session-ready': Object.freeze(['invoke-documented', 'documented-tested', 'ready', 'observed', 'current-session']),
});

function exactFields(value, expected, subject) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${subject} must be an object`);
  const actual = Object.keys(value);
  const unknown = actual.filter(key => !expected.has(key));
  const missing = [...expected].filter(key => !Object.hasOwn(value, key));
  if (unknown.length) throw new Error(`${subject} has unknown fields: ${unknown.sort().join(', ')}`);
  if (missing.length) throw new Error(`${subject} is missing required field: ${missing.sort().join(', ')}`);
}

function readinessContractIntegrity(paths = {}) {
  const contractPath = paths.contractPath || CONTRACT_PATH;
  const checksumPath = paths.checksumPath || `${contractPath}.sha256`;
  try {
    const bytes = fs.readFileSync(contractPath);
    const [declared] = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/);
    const contract = JSON.parse(bytes.toString('utf8'));
    return declared === CONTRACT_SHA256
      && crypto.createHash('sha256').update(bytes).digest('hex') === CONTRACT_SHA256
      && contract.schema_version === 2
      && contract.contract_version === CONTRACT_VERSION
      && contract.properties?.policy_digest?.const === POLICY_DIGEST
      && JSON.stringify(contract['x-internal-state-mapping']) === JSON.stringify(INTERNAL_STATE_MAPPING);
  } catch (_) {
    return false;
  }
}

function createReadinessRecord(capability, provider, internalStatus, message, reasonCode = null, host = 'trae-cli') {
  if (typeof internalStatus !== 'string' || !Object.hasOwn(INTERNAL_STATE_MAPPING, internalStatus)) throw new Error(`internal_status is unknown: ${internalStatus}`);
  const mapping = INTERNAL_STATE_MAPPING[internalStatus];
  const [nativeMode, publicLabel, packageStatus, probeStatus, readinessScope] = mapping;
  return {
    schema_version: 2,
    contract_version: CONTRACT_VERSION,
    policy_digest: POLICY_DIGEST,
    host,
    capability,
    provider,
    internal_status: internalStatus,
    native_mode: nativeMode,
    public_label: publicLabel,
    package_status: packageStatus,
    probe_status: probeStatus,
    readiness_scope: readinessScope,
    reason_code: reasonCode,
    message,
    evidence: {
      scope: readinessScope,
      ref: `automatic-tooling-contract.v1.json#sha256=${POLICY_DIGEST}`,
      sha256: POLICY_DIGEST,
      session_id: null,
    },
  };
}

function validateReadinessRecord(value, options = {}) {
  exactFields(value, REQUIRED_FIELDS, 'readiness receipt');
  if (value.schema_version !== 2) throw new Error('schema_version must be 2');
  if (value.contract_version !== CONTRACT_VERSION) throw new Error(`contract_version must be ${CONTRACT_VERSION}`);
  if (value.policy_digest !== POLICY_DIGEST) throw new Error('policy_digest does not match the packaged policy');
  if (!HOSTS.has(value.host)) throw new Error('host is not a declared LazySeries surface');
  if (typeof value.capability !== 'string' || !value.capability) throw new Error('capability must be a non-empty string');
  if (value.provider !== null && typeof value.provider !== 'string') throw new Error('provider must be a string or null');
  if (typeof value.internal_status !== 'string' || !Object.hasOwn(INTERNAL_STATE_MAPPING, value.internal_status)) throw new Error('internal_status is unknown');
  const mapping = INTERNAL_STATE_MAPPING[value.internal_status];
  const actual = [value.native_mode, value.public_label, value.package_status, value.probe_status, value.readiness_scope];
  if (JSON.stringify(actual) !== JSON.stringify(mapping)) throw new Error('internal_status mapping is inconsistent');
  if (value.reason_code !== null && typeof value.reason_code !== 'string') throw new Error('reason_code must be a string or null');
  if (typeof value.message !== 'string') throw new Error('message must be a string');
  exactFields(value.evidence, EVIDENCE_FIELDS, 'evidence');
  if (value.evidence.scope !== value.readiness_scope) throw new Error('evidence scope does not match readiness_scope');
  if (typeof value.evidence.ref !== 'string' || !value.evidence.ref) throw new Error('evidence ref must be a non-empty string');
  if (!/^[0-9a-f]{64}$/.test(value.evidence.sha256)) throw new Error('evidence sha256 must be a lowercase SHA-256 digest');
  if (options.sourceScope !== value.readiness_scope) {
    if (options.sourceScope === 'package') throw new Error('package evidence cannot emit host-ready readiness');
    throw new Error('source scope does not match readiness_scope');
  }
  if (options.sourceScope === 'current-session') {
    if (!options.currentSessionId || value.evidence.session_id !== options.currentSessionId) throw new Error('evidence does not belong to the current session');
  } else if (value.evidence.session_id !== null) {
    throw new Error('non-session evidence must not contain a session_id');
  }
  return value;
}

function normalizeV1ReadinessRecord(value) {
  const required = new Set(['schema_version', 'contract_version', 'contract_digest', 'host', 'capability', 'provider', 'status', 'readiness_scope', 'reason_code', 'message', 'receipt', 'details']);
  exactFields(value, required, 'historical v1 readiness receipt');
  if (value.schema_version !== 1 || value.contract_version !== '0.18.0') throw new Error('historical v1 readiness receipt is invalid');
  const host = { lazybuddy: 'codebuddy-cli', lazytrae: 'trae-cli' }[value.host];
  if (!host || typeof value.status !== 'string' || !Object.hasOwn(INTERNAL_STATE_MAPPING, value.status)) throw new Error('historical v1 readiness receipt has unknown host or status');
  return createReadinessRecord(value.capability, value.provider, value.status, value.message, value.reason_code, host);
}

function main(argv) {
  const fileIndex = argv.indexOf('--file');
  const scopeIndex = argv.indexOf('--source-scope');
  const sessionIndex = argv.indexOf('--current-session-id');
  const contractIndex = argv.indexOf('--contract-path');
  const checksumIndex = argv.indexOf('--checksum-path');
  if (fileIndex < 0 || scopeIndex < 0 || !argv[fileIndex + 1] || !argv[scopeIndex + 1]) throw new Error('usage: readiness-v2-contract.js --file FILE --source-scope SCOPE [--current-session-id ID]');
  const contractPaths = contractIndex < 0 ? {} : {
    contractPath: argv[contractIndex + 1],
    checksumPath: checksumIndex < 0 ? `${argv[contractIndex + 1]}.sha256` : argv[checksumIndex + 1],
  };
  if (!readinessContractIntegrity(contractPaths)) throw new Error('contract checksum or policy binding is invalid');
  const value = JSON.parse(fs.readFileSync(argv[fileIndex + 1], 'utf8'));
  const parsed = validateReadinessRecord(value, { sourceScope: argv[scopeIndex + 1], currentSessionId: sessionIndex < 0 ? undefined : argv[sessionIndex + 1] });
  process.stdout.write(`${JSON.stringify(parsed)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`readiness receipt invalid: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = {
  CONTRACT_PATH,
  INTERNAL_STATE_MAPPING,
  createReadinessRecord,
  normalizeV1ReadinessRecord,
  readinessContractIntegrity,
  validateReadinessRecord,
};
