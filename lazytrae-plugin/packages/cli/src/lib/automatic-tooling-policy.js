const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chooseCredentialReference, decryptCredential, encryptCredential, readVersionedDataKey } = require('./automatic-tooling-credentials');

const CONTRACT_PATH = path.resolve(__dirname, '..', '..', 'contracts', 'automatic-tooling-contract.v1.json');
const CONTRACT_DIGEST_PATH = `${CONTRACT_PATH}.sha256`;
const CONFIG_NAME = 'config.yaml';
const APPROVALS_NAME = 'approvals.json';
const CONFIG_DEFAULT = Object.freeze({ selection: {}, priority: [], endpoints: {}, credential_refs: {} });
const MODES = new Set(['automatic', 'ask-once', 'always-ask']);
const DECISIONS = new Set(['once', 'workspace', 'deny', 'revoke']);
const PROMPT_CAPABILITIES = new Set(['browser_automation', 'architecture_search']);

function configHome(environment = process.env) {
  return environment.XDG_CONFIG_HOME || path.join(environment.HOME || os.homedir(), '.config');
}

function dataHome(environment = process.env) {
  return environment.XDG_DATA_HOME || path.join(environment.HOME || os.homedir(), '.local', 'share');
}

function defaultConfigPath(environment) {
  return path.join(configHome(environment), 'lazyseries', CONFIG_NAME);
}

function defaultApprovalPath(environment) {
  return path.join(configHome(environment), 'lazyseries', APPROVALS_NAME);
}

function defaultToolpackPath(environment) {
  return path.join(dataHome(environment), 'lazyseries', 'toolpack');
}

function assertUserConfigHome(environment) {
  const home = configHome(environment);
  if (fs.existsSync(home) && fs.lstatSync(home).isSymbolicLink()) throw new Error('refusing symlinked policy directory ancestor');
}

function safeFile(pathname) {
  const stat = fs.lstatSync(pathname);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw new Error('refusing unsafe private policy file');
}

function ensurePrivateDirectory(directory) {
  const parent = path.dirname(directory);
  if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('refusing symlinked policy directory ancestor');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('refusing unsafe policy directory');
  fs.chmodSync(directory, 0o700);
}

function writePrivate(pathname, value) {
  ensurePrivateDirectory(path.dirname(pathname));
  if (fs.existsSync(pathname)) safeFile(pathname);
  const temporary = `${pathname}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    fs.writeFileSync(descriptor, value);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, pathname);
  fs.chmodSync(pathname, 0o600);
}

function readJson(pathname, label) {
  safeFile(pathname);
  try {
    return JSON.parse(fs.readFileSync(pathname, 'utf8'));
  } catch (_) {
    throw new Error(`${label} must be valid JSON-compatible YAML`);
  }
}

function isOpaqueCredentialReference(value) {
  return typeof value === 'string' && /^(?:keychain:[A-Za-z0-9._/-]+|env:[A-Za-z_][A-Za-z0-9_]*|encrypted:[A-Za-z0-9._-]+)$/.test(value);
}

function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('policy config must be an object');
  const allowed = new Set(Object.keys(CONFIG_DEFAULT));
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`unknown policy config field: ${key}`);
  const config = { ...CONFIG_DEFAULT, ...value };
  if (!config.selection || typeof config.selection !== 'object' || Array.isArray(config.selection)) throw new Error('selection must be an object');
  if (!Array.isArray(config.priority) || config.priority.some(item => typeof item !== 'string')) throw new Error('priority must be a string array');
  if (!config.endpoints || typeof config.endpoints !== 'object' || Array.isArray(config.endpoints)) throw new Error('endpoints must be an object');
  if (!config.credential_refs || typeof config.credential_refs !== 'object' || Array.isArray(config.credential_refs)) throw new Error('credential_refs must be an object');
  for (const endpoint of Object.values(config.endpoints)) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('unsafe');
    } catch (_) {
      throw new Error('endpoint must be an HTTPS URL without credentials');
    }
  }
  for (const reference of Object.values(config.credential_refs)) if (!isOpaqueCredentialReference(reference)) throw new Error('credential_refs must contain an opaque credential reference');
  return config;
}

function loadConfig(options = {}) {
  assertUserConfigHome(options.environment);
  const pathname = options.path || defaultConfigPath(options.environment);
  if (!fs.existsSync(pathname)) {
    const config = validateConfig(CONFIG_DEFAULT);
    writePrivate(pathname, `${JSON.stringify(config, null, 2)}\n`);
    return config;
  }
  return validateConfig(readJson(pathname, 'policy config'));
}

function readConfig(options = {}) {
  assertUserConfigHome(options.environment);
  const pathname = options.path || defaultConfigPath(options.environment);
  return fs.existsSync(pathname) ? validateConfig(readJson(pathname, 'policy config')) : validateConfig(CONFIG_DEFAULT);
}

function saveConfig(config, options = {}) {
  assertUserConfigHome(options.environment);
  const valid = validateConfig(config);
  writePrivate(options.path || defaultConfigPath(options.environment), `${JSON.stringify(valid, null, 2)}\n`);
  return valid;
}

function loadContract() {
  const bytes = fs.readFileSync(CONTRACT_PATH);
  const expected = fs.readFileSync(CONTRACT_DIGEST_PATH, 'utf8').trim().split(/\s+/)[0];
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (!/^[a-f0-9]{64}$/i.test(expected) || digest !== expected) throw new Error('AUTOMATIC_TOOLING_CHECKSUM_MISMATCH');
  const contract = JSON.parse(bytes);
  if (contract.schema !== 'lazy-series.automatic-tooling.contract' || contract.schema_version !== 1) throw new Error('AUTOMATIC_TOOLING_UNKNOWN_SCHEMA');
  return { contract, digest };
}

function readToolpack(pathname) {
  if (!fs.existsSync(pathname)) return CONFIG_DEFAULT;
  const stat = fs.lstatSync(pathname);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) throw new Error('refusing unsafe private toolpack directory');
  const file = path.join(pathname, 'toolpack.json');
  return fs.existsSync(file) ? validateConfig({ ...CONFIG_DEFAULT, ...readJson(file, 'toolpack') }) : CONFIG_DEFAULT;
}

function resolveCapability(capability, options = {}) {
  const { contract, digest } = loadContract();
  const definition = contract.capabilities[capability];
  if (!definition) throw new Error('AUTOMATIC_TOOLING_UNKNOWN_CAPABILITY');
  const config = options.config || loadConfig({ environment: options.environment });
  const toolpack = readToolpack(options.toolpackPath || defaultToolpackPath(options.environment));
  const selected = toolpack.selection[capability] || config.selection[capability];
  const provider = selected || definition.providers[0];
  if (!Object.hasOwn(contract.providers, provider)) throw new Error('AUTOMATIC_TOOLING_UNKNOWN_PROVIDER');
  if (!definition.providers.includes(provider)) throw new Error('AUTOMATIC_TOOLING_UNKNOWN_PROVIDER');
  return { capability, provider, fallbacks: [...definition.fallbacks], contractDigest: digest };
}

function canonicalWorkspace(workspace) {
  const resolved = fs.realpathSync.native(workspace);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('workspace must be a directory');
  return `${resolved}:${stat.dev}:${stat.ino}`;
}

function approvalKey(request) {
  const digest = request.contractDigest || loadContract().digest;
  return crypto.createHash('sha256').update(JSON.stringify({ workspace: canonicalWorkspace(request.workspace), capability: request.capability, provider: request.provider, digest })).digest('hex');
}

function readLedger(options = {}) {
  assertUserConfigHome(options.environment);
  const pathname = options.path || defaultApprovalPath(options.environment);
  if (!fs.existsSync(pathname)) return { version: 1, approvals: {} };
  const ledger = readJson(pathname, 'approval ledger');
  if (!ledger || ledger.version !== 1 || !ledger.approvals || typeof ledger.approvals !== 'object' || Array.isArray(ledger.approvals)) throw new Error('approval ledger is malformed');
  return ledger;
}

function writeApproval(entry, options = {}) {
  if (!entry || !DECISIONS.has(entry.decision) || typeof entry.key !== 'string') throw new Error('approval decision is invalid');
  assertUserConfigHome(options.environment);
  const pathname = options.path || defaultApprovalPath(options.environment);
  const ledger = readLedger({ path: pathname });
  if (entry.decision === 'revoke') delete ledger.approvals[entry.key];
  else ledger.approvals[entry.key] = entry.decision;
  writePrivate(pathname, `${JSON.stringify(ledger, null, 2)}\n`);
}

function requiresPrompt(request) {
  return request.secretRead === true || request.download === true || request.index === true || PROMPT_CAPABILITIES.has(request.capability);
}

function workspaceState(workspace) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: workspace, encoding: 'utf8', timeout: 5000 });
  if (result.error || result.status !== 0) return 'unavailable';
  return result.stdout.trim() === '' ? 'clean' : 'dirty';
}

function resolveApproval(request, options = {}) {
  const mode = options.mode || 'ask-once';
  if (!MODES.has(mode)) throw new Error('approval mode is invalid');
  if (mode === 'always-ask' || requiresPrompt(request)) return { kind: 'prompt-required' };
  if (mode === 'automatic') {
    const state = workspaceState(request.workspace);
    return state === 'clean' ? { kind: 'allowed' } : { kind: 'prompt-required', reason: state === 'dirty' ? 'workspace-not-clean' : 'workspace-inspection-required' };
  }
  const key = approvalKey(request);
  const ledger = readLedger({ environment: options.environment, path: options.path });
  const decision = ledger.approvals[key];
  if (decision === 'deny') return { kind: 'denied' };
  if (decision === 'workspace') return { kind: 'allowed' };
  if (decision === 'once') {
    delete ledger.approvals[key];
    writePrivate(options.path || defaultApprovalPath(options.environment), `${JSON.stringify(ledger, null, 2)}\n`);
    return { kind: 'allowed' };
  }
  return { kind: 'prompt-required' };
}

function redactText(text, environment = process.env) {
  let result = String(text);
  for (const value of Object.values(environment)) {
    if (typeof value === 'string' && value.length >= 8) result = result.split(value).join('[REDACTED]');
  }
  return result;
}

module.exports = { approvalKey, canonicalWorkspace, chooseCredentialReference, defaultApprovalPath, defaultConfigPath, defaultToolpackPath, decryptCredential, encryptCredential, isOpaqueCredentialReference, loadConfig, loadContract, readConfig, readLedger, readVersionedDataKey, redactText, resolveApproval, resolveCapability, saveConfig, writeApproval };
