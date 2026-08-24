const fs = require('fs');
const path = require('path');
const {
  INTERNAL_STATE_MAPPING,
  createReadinessRecord,
  normalizeV1ReadinessRecord,
  readinessContractIntegrity,
  validateReadinessRecord,
} = require('./readiness-v2-contract');
const { indexState, ownedExecutable } = require('./codegraph-lifecycle');
const { readinessStatus: lspReadinessStatus } = require('./lsp-lifecycle');
const { inspectHostCapabilitiesForReadiness } = require('./tooling-capabilities');
const { readReceipt, validateReceipt } = require('./tooling-root');
const { OPTIONAL_CAPABILITIES, readToolingState, toolingStatePath } = require('./tooling-state');

const CAPABILITIES = [
  ['local_search', 'ripgrep'], ['structural_search', 'ast-grep'], ['code_navigation', 'lsp'],
  ['architecture_search', 'codegraph'], ['documentation_search', 'context7'], ['web_search', 'web'],
  ['external_code_search', 'grep_app'], ['browser_automation', 'playwright'], ['filesystem_read', 'filesystem'],
];

function record(capability, provider, status, message, reasonCode = null, receipt = null, details = {}) {
  return createReadinessRecord(capability, provider, status, message, reasonCode);
}

function contractFailureRecords() {
  return CAPABILITIES.map(([capability, provider]) => record(capability, provider, 'failed-optional', 'The packaged readiness contract failed its integrity check.', 'CONTRACT_INTEGRITY_INVALID', null, { source: 'contract' }));
}

function receiptSummary(root) {
  try {
    const receipt = readReceipt(root);
    validateReceipt(root, receipt);
    return { owner: receipt.owner, schema_version: receipt.schema_version, state: 'ready' };
  } catch (_) {
    return null;
  }
}

function stateSnapshot(repoRoot) {
  const statePath = toolingStatePath(repoRoot);
  if (!fs.existsSync(statePath)) return { initialized: false };
  try {
    return { initialized: true, state: readToolingState(repoRoot) };
  } catch (error) {
    return { initialized: true, error };
  }
}

function notInitializedRecords() {
  return CAPABILITIES.map(([capability, provider]) => record(capability, provider, 'not-initialized', 'LazyTrae tooling state has not been initialized.', 'RECEIPT_ABSENT', null, { source: 'state' }));
}

function coreRecord(capability, provider, inspection) {
  if (inspection.path) return record(capability, provider, 'package-ready', `A ${provider} executable is discoverable; compatibility is not executed by this report.`, null, null, { source: 'host', command: inspection.command, path: inspection.path, compatibility: 'not-executed' });
  return record(capability, provider, 'missing', `No compatible ${provider} provider is available.`, 'PROVIDER_NOT_FOUND', null, { source: 'detection' });
}

function lspRecord(repoRoot) {
  const toolingRoot = path.join(repoRoot, '.lazytrae', 'tooling');
  const result = lspReadinessStatus(repoRoot, toolingRoot);
  if (result.state === 'ready') {
    const owned = result.source === 'owned';
    return record('code_navigation', 'lsp', owned ? 'owned-ready' : 'package-ready', owned ? 'A receipt-owned LSP provider is ready.' : 'An existing local LSP provider is ready.', null, owned ? receiptSummary(toolingRoot) : null, { source: result.source, language: result.language });
  }
  if (result.state === 'incompatible') return record('code_navigation', 'lsp', 'incompatible', result.reason, 'HOST_VERSION_UNSUPPORTED', null, { source: 'compatibility', language: result.language });
  return record('code_navigation', 'lsp', 'missing', result.reason, 'PROVIDER_NOT_FOUND', null, { source: 'detection', language: result.language });
}

function codeGraphRecord(repoRoot, state) {
  const capability = state.capabilities.codegraph;
  if (capability && capability.state === 'failed') return record('architecture_search', 'codegraph', 'failed-optional', 'The optional CodeGraph lifecycle reported a failure.', 'OPTIONAL_PROVIDER_UNAVAILABLE', null, { source: 'state' });
  if (!capability || capability.enabled !== true) return record('architecture_search', 'codegraph', 'disabled', 'The optional CodeGraph provider is disabled.', 'EXPLICIT_ENABLE_REQUIRED', null, { source: 'policy' });
  if (typeof capability.tooling_root !== 'string') return record('architecture_search', 'codegraph', 'missing', 'No receipt-owned CodeGraph tooling root is configured.', 'TOOLING_ROOT_ABSENT', null, { source: 'state' });
  const executable = ownedExecutable(capability.tooling_root);
  if (!executable) {
    const status = fs.existsSync(capability.tooling_root) ? 'incompatible' : 'missing';
    return record('architecture_search', 'codegraph', status, 'The configured CodeGraph tooling root is not a valid receipt-owned provider.', status === 'incompatible' ? 'RECEIPT_INVALID' : 'PROVIDER_NOT_FOUND', null, { source: 'receipt' });
  }
  const index = indexState(repoRoot);
  if (index === 'ready') return record('architecture_search', 'codegraph', 'owned-ready', 'A receipt-owned CodeGraph provider and caller-managed index are ready.', null, receiptSummary(capability.tooling_root), { source: 'receipt' });
  if (index === 'incompatible') return record('architecture_search', 'codegraph', 'incompatible', 'The project CodeGraph index path is unsafe or incompatible.', 'INDEX_INCOMPATIBLE', null, { source: 'index' });
  return record('architecture_search', 'codegraph', 'not-initialized', 'The receipt-owned CodeGraph provider has no valid caller-managed index.', 'INDEX_NOT_INITIALIZED', receiptSummary(capability.tooling_root), { source: 'index' });
}

function optionalRecord(capability, provider, state) {
  const configured = state.capabilities[provider];
  if (configured && configured.state === 'failed') return record(capability, provider, 'failed-optional', 'The optional provider lifecycle reported a failure.', 'OPTIONAL_PROVIDER_UNAVAILABLE', null, { source: 'state' });
  if (!configured || configured.enabled !== true) return record(capability, provider, 'disabled', 'The optional provider is disabled.', 'EXPLICIT_ENABLE_REQUIRED', null, { source: 'policy' });
  return record(capability, provider, 'missing', 'The optional provider is configured, but host/MCP connection is not verified by this package report.', 'HOST_CONNECTION_UNVERIFIED', null, { source: 'configuration' });
}

function readinessReport(repoRoot, contractPaths) {
  if (!readinessContractIntegrity(contractPaths)) return contractFailureRecords();
  const snapshot = stateSnapshot(repoRoot);
  if (!snapshot.initialized) return notInitializedRecords();
  if (snapshot.error) return CAPABILITIES.map(([capability, provider]) => record(capability, provider, 'failed-optional', 'LazyTrae tooling state is malformed.', 'STATE_INVALID', null, { source: 'state' }));
  const host = new Map(inspectHostCapabilitiesForReadiness().map(value => [value.name, value]));
  return [
    coreRecord('local_search', 'ripgrep', host.get('ripgrep')),
    coreRecord('structural_search', 'ast-grep', host.get('ast-grep')),
    lspRecord(repoRoot),
    codeGraphRecord(repoRoot, snapshot.state),
    optionalRecord('documentation_search', 'context7', snapshot.state),
    record('web_search', 'web', 'missing', 'The host-governed web provider is not verified by package readiness.', 'HOST_CONNECTION_UNVERIFIED', null, { source: 'host' }),
    optionalRecord('external_code_search', 'grep_app', snapshot.state),
    optionalRecord('browser_automation', 'playwright', snapshot.state),
    optionalRecord('filesystem_read', 'filesystem', snapshot.state),
  ];
}

function formatLegacyCapabilityStatus(repoRoot) {
  const capabilities = readToolingState(repoRoot).capabilities;
  return Object.entries(OPTIONAL_CAPABILITIES).map(([name, capability]) => {
    const state = capabilities[name]?.enabled === true ? 'enabled' : 'disabled';
    return `${name}: ${state} (optional, configuration only; ${capability.description})`;
  }).join('\n');
}

function formatReadinessSummary(records) {
  const groups = new Map();
  for (const value of records) {
    const status = value.internal_status || value.status;
    const members = groups.get(status) || [];
    members.push(value.provider || value.capability || 'unknown');
    groups.set(status, members);
  }
  const summary = [...groups.entries()]
    .map(([status, members]) => `${status}=${members.length} [${members.join(', ')}]`)
    .join(', ');
  return `Capability readiness (report-only; host and MCP connection remain unverified): ${summary}`;
}

module.exports = {
  INTERNAL_STATE_MAPPING,
  formatLegacyCapabilityStatus,
  formatReadinessSummary,
  normalizeV1ReadinessRecord,
  readinessContractIntegrity,
  readinessReport,
  validateReadinessRecord,
};
