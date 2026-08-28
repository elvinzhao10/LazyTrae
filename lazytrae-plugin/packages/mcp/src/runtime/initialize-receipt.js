const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('./path-boundary');
const { atomicWriteFile } = require('./safe-write');

const RECEIPT_FILE = 'mcp-initialize-receipt.json';
const RECEIPT_OWNER = 'lazytrae-mcp';
const RECEIPT_SCHEMA_VERSION = 1;
const PROTOCOL_VERSION = '2024-11-05';
const SERVER_VERSION = '1.2.0';
const MAX_CLIENT_LABEL_LENGTH = 80;
const MAX_RECEIPT_BYTES = 8192;
const MAX_RECEIPT_AGE_MS = 24 * 60 * 60 * 1000;

function receiptPath(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.trim() === '') {
    throw new Error('project root is unavailable');
  }
  return path.join(path.resolve(repoRoot), '.lazytrae', 'state', RECEIPT_FILE);
}

function sanitizeClientLabel(params) {
  const clientInfo = params && typeof params === 'object' && !Array.isArray(params)
    ? params.clientInfo
    : null;
  const raw = clientInfo && typeof clientInfo === 'object' && !Array.isArray(clientInfo)
    ? clientInfo.name
    : null;
  if (typeof raw !== 'string') return undefined;
  const label = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^A-Za-z0-9._:+@() -]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CLIENT_LABEL_LENGTH);
  return label || undefined;
}

function timestamp(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function expectedKeys(receipt) {
  const keys = Object.keys(receipt).sort();
  const required = [
    'initialized_at',
    'last_initialized_at',
    'owner',
    'pid',
    'protocol_version',
    'schema_version',
    'server_version',
  ];
  if (Object.hasOwn(receipt, 'client_label')) required.push('client_label');
  return JSON.stringify(keys) === JSON.stringify(required.sort());
}

function inspectInitializeReceipt(repoRoot) {
  let target;
  try {
    target = receiptPath(repoRoot);
    const root = path.resolve(repoRoot);
    assertSafeRepoWritePath(root, target);
  } catch (error) {
    return { state: 'invalid', detail: 'receipt path is outside the project state boundary' };
  }

  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error && error.code === 'ENOENT') return { state: 'missing', detail: 'no initialize evidence has been recorded' };
    return { state: 'invalid', detail: 'receipt could not be inspected safely' };
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) {
    return { state: 'invalid', detail: 'receipt is not a regular LazyTrae-owned file' };
  }
  if (stat.size > MAX_RECEIPT_BYTES) {
    return { state: 'invalid', detail: 'receipt exceeds the bounded size limit' };
  }

  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (_) {
    return { state: 'invalid', detail: 'receipt is not valid JSON' };
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || !expectedKeys(receipt)) {
    return { state: 'invalid', detail: 'receipt schema is not owned by LazyTrae MCP' };
  }
  if (receipt.owner !== RECEIPT_OWNER
    || receipt.schema_version !== RECEIPT_SCHEMA_VERSION
    || receipt.protocol_version !== PROTOCOL_VERSION
    || receipt.server_version !== SERVER_VERSION
    || !Number.isInteger(receipt.pid)
    || receipt.pid <= 0
    || (Object.hasOwn(receipt, 'client_label')
      && (typeof receipt.client_label !== 'string' || receipt.client_label.length > MAX_CLIENT_LABEL_LENGTH))) {
    return { state: 'invalid', detail: 'receipt ownership or schema fields are invalid' };
  }

  const initializedAt = timestamp(receipt.initialized_at);
  const lastInitializedAt = timestamp(receipt.last_initialized_at);
  if (!initializedAt || !lastInitializedAt || lastInitializedAt.getTime() < initializedAt.getTime()) {
    return { state: 'invalid', detail: 'receipt timestamps are invalid' };
  }

  const age = Date.now() - lastInitializedAt.getTime();
  if (age > MAX_RECEIPT_AGE_MS) {
    return {
      state: 'stale',
      receipt,
      detail: `initialize evidence is stale (${Math.floor(age / 3_600_000)}h old)`,
    };
  }
  return { state: 'valid', receipt, detail: 'initialize evidence was previously observed' };
}

function requireExistingState(root) {
  for (const segment of ['.lazytrae', path.join('.lazytrae', 'state')]) {
    let stat;
    try {
      stat = fs.lstatSync(path.join(root, segment));
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        const unavailable = new Error('project state is unavailable');
        unavailable.code = 'ENOENT';
        throw unavailable;
      }
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      const unsafe = new Error('project state is not a regular directory');
      unsafe.code = 'EUNSAFE';
      throw unsafe;
    }
  }
}

function requireSafeReceiptTarget(target) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) {
    const unsafe = new Error('receipt target is not a regular file');
    unsafe.code = 'EUNSAFE';
    throw unsafe;
  }
}

function writeInitializeReceipt(repoRoot, params = {}, now = new Date()) {
  const target = receiptPath(repoRoot);
  const prior = inspectInitializeReceipt(repoRoot);
  const nowIso = now.toISOString();
  const initializedAt = prior.receipt && prior.receipt.initialized_at
    ? prior.receipt.initialized_at
    : nowIso;
  const receipt = {
    owner: RECEIPT_OWNER,
    schema_version: RECEIPT_SCHEMA_VERSION,
    protocol_version: PROTOCOL_VERSION,
    server_version: SERVER_VERSION,
    pid: process.pid,
    initialized_at: initializedAt,
    last_initialized_at: nowIso,
  };
  const clientLabel = sanitizeClientLabel(params);
  if (clientLabel) receipt.client_label = clientLabel;
  const root = path.resolve(repoRoot);
  requireExistingState(root);
  requireSafeReceiptTarget(target);
  atomicWriteFile(root, target, JSON.stringify(receipt, null, 2) + '\n', 'utf8', 0o600);
  return receipt;
}

function tryWriteInitializeReceipt(repoRoot, params = {}) {
  try {
    return { ok: true, receipt: writeInitializeReceipt(repoRoot, params) };
  } catch (error) {
    return { ok: false, error };
  }
}

function receiptWriteDiagnostic(error) {
  const code = error && typeof error.code === 'string' ? error.code : 'error';
  return `LazyTrae MCP initialize receipt write skipped (${code}).`;
}

module.exports = {
  MAX_RECEIPT_AGE_MS,
  PROTOCOL_VERSION,
  RECEIPT_FILE,
  RECEIPT_OWNER,
  RECEIPT_SCHEMA_VERSION,
  SERVER_VERSION,
  inspectInitializeReceipt,
  receiptPath,
  receiptWriteDiagnostic,
  sanitizeClientLabel,
  tryWriteInitializeReceipt,
  writeInitializeReceipt,
};
