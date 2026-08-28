'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { canonicalDigest, fileMaterial, sha256 } = require('./host-adapter-fingerprint');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const HOST_ALIASES = Object.freeze({ ide: 'trae-ide', cli: 'trae-cli', work: 'trae-work' });
const HOSTS = new Set(Object.values(HOST_ALIASES));
const SHA256 = /^[0-9a-f]{64}$/;
const FRESH_MS = 15 * 60 * 1000;
const IDE_CAPABILITIES = Object.freeze(['hooks', 'agents', 'skills', 'commands', 'mcp']);
const WORK_FORBIDDEN = Object.freeze(['native-cli', 'native-worktree', 'durable-checkpoint', 'a2a', 'nested-delegation']);
const WORK_PROFILES = new Set(['desktop/local', 'desktop/cloud', 'web/cloud', 'mobile/local', 'mobile/cloud']);

function evidence(fingerprint, values = {}) {
  return {
    fingerprint,
    observed_at: values.observedAt || null,
    expires_at: values.expiresAt || null,
    session_id: values.sessionId || null,
    build_version: values.buildVersion || null,
    build_sha256: values.buildSha256 || null,
  };
}

function capability(capabilityId, status, fingerprint, values) {
  return { capability_id: capabilityId, status, evidence: evidence(fingerprint, values) };
}

function unavailable(capabilityId, material, reason) {
  return capability(capabilityId, 'unavailable', canonicalDigest({ material, reason }));
}

function currentSession(repoRoot, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return false;
  try {
    const target = path.join(repoRoot, '.lazytrae', 'state', 'sessions.json');
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) return false;
    const state = JSON.parse(fs.readFileSync(target, 'utf8'));
    return state?.current_session_id === sessionId;
  } catch (_) {
    return false;
  }
}

function regularJson(target) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 'missing' : 'conflict';
    return { valid: false, material: { status, sha256: canonicalDigest(`json:${status}`) } };
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    return { valid: false, material: { status: 'conflict', sha256: canonicalDigest('json:not-regular') } };
  }
  const material = fileMaterial(target);
  try {
    JSON.parse(fs.readFileSync(target, 'utf8'));
    return { valid: true, material };
  } catch (_) {
    return { valid: false, material };
  }
}

function readProbe(target, now, sessionId, repoRoot) {
  if (!target) return { valid: false, fingerprint: canonicalDigest('probe:missing') };
  const checked = regularJson(target);
  if (!checked.valid) return { valid: false, fingerprint: checked.material.sha256 };
  const bytes = fs.readFileSync(target);
  const value = JSON.parse(bytes.toString('utf8'));
  const observedAt = fs.statSync(target).mtime.toISOString();
  const expiresAt = new Date(Date.parse(observedAt) + FRESH_MS).toISOString();
  const age = Date.parse(now) - Date.parse(observedAt);
  const argv = JSON.stringify(value.observed_argv);
  const valid = value.schema_version === 2 && value.contract_version === '2.0.0'
    && value.product === 'trae' && value.host === 'cli' && value.status === 'accessible'
    && value.host_readiness === 'pending' && value.binary && SHA256.test(value.binary.sha256)
    && typeof value.binary.version === 'string' && /^\d+\.\d+\.\d+/.test(value.binary.version)
    && argv === JSON.stringify([['--version'], ['--help']])
    && Array.isArray(value.capabilities) && age >= 0 && age <= FRESH_MS
    && currentSession(repoRoot, sessionId);
  return { valid, value, observedAt, expiresAt, fingerprint: sha256(bytes), sessionId };
}

function cliMatrix(repoRoot, options) {
  const probe = readProbe(options.probePath, options.now, options.sessionId, repoRoot);
  const probeEvidence = {
    observedAt: probe.observedAt,
    expiresAt: probe.expiresAt,
    sessionId: probe.sessionId,
    buildVersion: probe.value?.binary?.version,
    buildSha256: probe.value?.binary?.sha256,
  };
  const result = [];
  for (const id of ['version', 'help']) {
    result.push(probe.valid ? capability(id, 'host-executed', probe.fingerprint, probeEvidence)
      : unavailable(id, probe.fingerprint, 'fresh current-session probe required'));
  }
  const advertised = probe.valid && probe.value.capabilities.some(item => item?.name === 'config-read' && item.status === 'accessible');
  result.push(advertised ? capability('config-read', 'host-observed', probe.fingerprint, probeEvidence)
    : unavailable('config-read', probe.fingerprint, 'config read was not advertised'));
  const config = regularJson(path.join(repoRoot, '.trae', 'mcp.json'));
  result.push(config.valid ? capability('project-mcp-json', 'descriptor-only', config.material.sha256)
    : unavailable('project-mcp-json', config.material.sha256, 'project MCP configuration is missing or malformed'));
  const major = probe.valid ? Number.parseInt(probe.value.binary.version.split('.')[0], 10) : null;
  const names = new Set(probe.valid ? probe.value.capabilities.filter(item => item?.status === 'accessible').map(item => item.name) : []);
  const ambiguous = names.has('config-yaml') && names.has('config-toml');
  for (const [id, supported] of [
    ['config-yaml-candidate', major === 1 && !ambiguous],
    ['config-toml-candidate', major !== null && major >= 2 && !ambiguous],
    ['skills-traecli-candidate', major !== null],
    ['skills-trae-compat-candidate', major !== null && major >= 2],
  ]) {
    result.push(supported ? capability(id, 'descriptor-only', canonicalDigest({ id, major }))
      : unavailable(id, probe.fingerprint, ambiguous ? 'conflicting config paths' : 'unsupported or unprobed build'));
  }
  return result;
}

function ideMatrix() {
  const locations = Object.freeze({
    hooks: 'templates/hooks', agents: 'templates/agents', skills: 'templates/skills',
    commands: 'templates/commands', mcp: 'templates/mcp.json',
  });
  return IDE_CAPABILITIES.map(id => {
    const material = fileMaterial(path.join(PACKAGE_ROOT, locations[id]));
    return material.status === 'ready' ? capability(id, 'descriptor-only', material.sha256)
      : unavailable(id, material.sha256, 'package descriptor is missing');
  });
}

function workMatrix(client, execution) {
  if (!WORK_PROFILES.has(`${client}/${execution}`)) throw new Error('unsupported TraeWork client/execution profile');
  const ids = [`client-${client}`, `execution-${execution}`, 'skills', 'commands', 'mcp'];
  const supported = ids.map(id => capability(id, 'descriptor-only', canonicalDigest({ host: 'trae-work', client, execution, id })));
  return [...supported, ...WORK_FORBIDDEN.map(id => unavailable(id, `${client}/${execution}`, 'no native TraeWork claim'))];
}

function readReceipt(target, identity, base, descriptorSha256, repoRoot, now) {
  if (!target) return { supplied: false, valid: false };
  const checked = regularJson(target);
  if (!checked.valid) return { supplied: true, valid: false, fingerprint: checked.material.sha256 };
  const bytes = fs.readFileSync(target);
  const value = JSON.parse(bytes.toString('utf8'));
  const keys = ['build_sha256', 'build_version', 'capabilities', 'client', 'contract_version', 'descriptor_sha256', 'execution', 'expires_at', 'host', 'observed_at', 'schema_version', 'session_id'];
  const capabilityIds = new Set(base.filter(item => item.status !== 'unavailable').map(item => item.capability_id));
  const validCapabilities = Array.isArray(value.capabilities) && value.capabilities.length > 0
    && value.capabilities.every(item => item && JSON.stringify(Object.keys(item).sort()) === JSON.stringify(['artifact_sha256', 'capability_id'])
      && capabilityIds.has(item.capability_id) && SHA256.test(item.artifact_sha256))
    && new Set(value.capabilities.map(item => item.capability_id)).size === value.capabilities.length;
  const age = Date.parse(now) - Date.parse(value.observed_at);
  const valid = JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys)
    && value.schema_version === 1 && value.contract_version === '1.2.0'
    && value.host === identity.host && value.client === identity.client && value.execution === identity.execution
    && typeof value.build_version === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.build_version)
    && SHA256.test(value.build_sha256) && /^[A-Za-z0-9._:-]{1,128}$/.test(value.session_id)
    && value.descriptor_sha256 === descriptorSha256 && currentSession(repoRoot, value.session_id)
    && age >= 0 && age <= FRESH_MS && Date.parse(value.expires_at) > Date.parse(now)
    && validCapabilities;
  return { supplied: true, valid, value, fingerprint: sha256(bytes) };
}

function applyReceipt(base, receipt) {
  if (!receipt.supplied) return base;
  if (!receipt.valid) return base.map(item => unavailable(item.capability_id, receipt.fingerprint || 'receipt', 'receipt is invalid or stale'));
  const observed = new Set(receipt.value.capabilities.map(item => item.capability_id));
  return base.map(item => observed.has(item.capability_id)
    ? capability(item.capability_id, 'host-observed', receipt.fingerprint, {
      observedAt: receipt.value.observed_at, expiresAt: receipt.value.expires_at, sessionId: receipt.value.session_id,
      buildVersion: receipt.value.build_version, buildSha256: receipt.value.build_sha256,
    }) : item);
}

function buildCapabilityMatrix(repoRoot, host, options = {}) {
  const stableHost = HOST_ALIASES[host] || host;
  if (!HOSTS.has(stableHost)) throw new Error(`unsupported host capability matrix: ${host}`);
  const now = options.now || new Date().toISOString();
  if (Number.isNaN(Date.parse(now))) throw new Error('matrix time is malformed');
  const client = stableHost === 'trae-cli' ? 'terminal' : stableHost === 'trae-ide' ? 'desktop' : options.client;
  const execution = stableHost === 'trae-work' ? options.execution : 'local';
  const initial = stableHost === 'trae-cli' ? cliMatrix(repoRoot, { ...options, now })
    : stableHost === 'trae-ide' ? ideMatrix() : workMatrix(client, execution);
  const descriptorSha256 = canonicalDigest({ host: stableHost, client, execution, capabilities: initial });
  const shell = { host: stableHost, client, execution };
  const receipt = readReceipt(options.receiptPath, shell, initial, descriptorSha256, repoRoot, now);
  const capabilities = stableHost === 'trae-cli' ? initial : applyReceipt(initial, receipt);
  const matrix = { schema_version: 1, contract_version: '1.2.0', ...shell, descriptor_sha256: descriptorSha256, capabilities };
  return { ...matrix, matrix_sha256: canonicalDigest(matrix) };
}

module.exports = { buildCapabilityMatrix };
