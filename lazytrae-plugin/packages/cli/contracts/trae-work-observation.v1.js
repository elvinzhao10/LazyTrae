'use strict';

const fs = require('node:fs');

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const MAX_FIXTURE_BYTES = 1024 * 1024;
const CAPABILITY_MODES = Object.freeze([
  ['background-parallel-tasks', 'observe-only'],
  ['cross-device-resume', 'observe-only'],
  ['privacy-mode', 'observe-only'],
  ['multi-format-workspace', 'observe-only'],
  ['comments', 'observe-only'],
  ['revisions', 'observe-only'],
  ['artifacts-references', 'observe-only'],
  ['design-mode', 'observe-only'],
  ['agent-sharing', 'observe-only'],
  ['security-scan', 'observe-only'],
  ['pages', 'descriptor-only'],
  ['vercel', 'descriptor-only'],
  ['supabase', 'descriptor-only'],
  ['marketplace-publication', 'unavailable'],
].map(([capability_id, native_mode]) => Object.freeze({ capability_id, native_mode })));
const EXPECTED_MODES = new Map(CAPABILITY_MODES.map(item => [item.capability_id, item.native_mode]));
const PRIVATE_KEY = /(?:^|_)(?:email|phone|address|name|prompt|transcript|content|body|message|secret|credential|token|password|api_?key|private_?key|authorization|oauth|cloud_?invocation|upload|publish|deploy|canonical_?write)(?:$|_)/i;
const PRIVATE_VALUE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\bBearer\s+[A-Za-z0-9._-]{10,}|\bsk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

function fail(message) {
  throw new Error(message);
}

function object(value, name) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') fail(`${name} must be an object`);
  return value;
}

function exactKeys(value, required, name) {
  const keys = Object.keys(object(value, name));
  const missing = required.filter(key => !Object.hasOwn(value, key));
  const unknown = keys.filter(key => !required.includes(key));
  if (missing.length) fail(`${name} missing ${missing.join(', ')}`);
  if (unknown.length) fail(`${name} has unknown fields: ${unknown.join(', ')}`);
}

function text(value, name, pattern = null) {
  if (typeof value !== 'string' || value.length === 0) fail(`${name} must be a non-empty string`);
  if (pattern && !pattern.test(value)) fail(`${name} is malformed`);
}

function timestamp(value, name) {
  text(value, name);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    fail(`${name} is malformed`);
  }
}

function rejectPrivate(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectPrivate(item, `${location}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (PRIVATE_KEY.test(key)) fail(`private or mutating field at ${location}.${key}`);
      rejectPrivate(item, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && PRIVATE_VALUE.test(value)) fail(`private value at ${location}`);
}

function validateSession(session, now) {
  exactKeys(session, ['session_id', 'status', 'observed_at', 'expires_at', 'host_evidence_sha256'], 'session');
  text(session.session_id, 'session.session_id', ID);
  if (session.status !== 'current') fail('session.status must be current');
  timestamp(session.observed_at, 'session.observed_at');
  timestamp(session.expires_at, 'session.expires_at');
  text(session.host_evidence_sha256, 'session.host_evidence_sha256', SHA256);
  if (Date.parse(session.observed_at) > Date.parse(now)) fail('session observation is from the future');
  if (Date.parse(session.expires_at) <= Date.parse(now)) fail('session evidence is stale');
  if (Date.parse(session.expires_at) <= Date.parse(session.observed_at)) fail('session expiry must follow observation');
}

function validateDescriptors(descriptors) {
  if (!Array.isArray(descriptors)) fail('descriptors must be an array');
  if (descriptors.length !== CAPABILITY_MODES.length) fail('descriptors must contain the complete capability set');
  const seen = new Set();
  descriptors.forEach((descriptor, index) => {
    exactKeys(descriptor, ['capability_id', 'native_mode', 'status', 'evidence_sha256'], `descriptors[${index}]`);
    const expectedMode = EXPECTED_MODES.get(descriptor.capability_id);
    if (!expectedMode || seen.has(descriptor.capability_id)) fail(`descriptors[${index}].capability_id is unsupported or duplicated`);
    seen.add(descriptor.capability_id);
    if (descriptor.native_mode !== expectedMode) fail(`${descriptor.capability_id} must remain ${expectedMode}`);
    const expectedStatus = expectedMode === 'unavailable'
      ? 'unavailable'
      : expectedMode === 'descriptor-only' ? 'described' : 'observed';
    if (descriptor.status !== expectedStatus) fail(`${descriptor.capability_id} status must be ${expectedStatus}`);
    text(descriptor.evidence_sha256, `descriptors[${index}].evidence_sha256`, SHA256);
  });
}

function validateCanonicalReferences(references) {
  if (!Array.isArray(references) || references.length === 0) fail('canonical_refs must be a non-empty array');
  const seen = new Set();
  const kinds = new Set();
  references.forEach((reference, index) => {
    exactKeys(reference, ['kind', 'canonical_id', 'sha256', 'access'], `canonical_refs[${index}]`);
    if (!['task', 'evidence'].includes(reference.kind)) fail(`canonical_refs[${index}].kind is unsupported`);
    text(reference.canonical_id, `canonical_refs[${index}].canonical_id`, ID);
    text(reference.sha256, `canonical_refs[${index}].sha256`, SHA256);
    if (reference.access !== 'read-only') fail('canonical references must remain read-only');
    const identity = `${reference.kind}:${reference.canonical_id}`;
    if (seen.has(identity)) fail('canonical references must be unique');
    seen.add(identity);
    kinds.add(reference.kind);
  });
  if (!kinds.has('task') || !kinds.has('evidence')) fail('canonical task and evidence references are required');
}

function validateWorkObservation(value, { now = new Date().toISOString() } = {}) {
  timestamp(now, 'now');
  rejectPrivate(value);
  const fields = ['schema_version', 'contract_version', 'record_type', 'observation_id', 'host', 'observed_at', 'session', 'privacy_receipt', 'workspace', 'descriptors', 'canonical_refs', 'agent_import'];
  exactKeys(value, fields, 'trae-work-observation');
  if (value.schema_version !== 1 || value.contract_version !== '1.0.0') fail('contract version is unsupported');
  if (value.record_type !== 'trae-work-observation' || value.host !== 'trae-work') fail('record identity is unsupported');
  text(value.observation_id, 'observation_id', ID);
  timestamp(value.observed_at, 'observed_at');
  if (Date.parse(value.observed_at) > Date.parse(now)) fail('observation is from the future');
  validateSession(object(value.session, 'session'), now);
  exactKeys(value.privacy_receipt, ['receipt_id', 'policy', 'status', 'policy_sha256', 'observation_sha256'], 'privacy_receipt');
  text(value.privacy_receipt.receipt_id, 'privacy_receipt.receipt_id', ID);
  if (value.privacy_receipt.policy !== 'privacy-mode') fail('privacy policy is unsupported');
  if (!['enabled', 'disabled', 'unknown'].includes(value.privacy_receipt.status)) fail('privacy status is unsupported');
  text(value.privacy_receipt.policy_sha256, 'privacy_receipt.policy_sha256', SHA256);
  text(value.privacy_receipt.observation_sha256, 'privacy_receipt.observation_sha256', SHA256);
  exactKeys(value.workspace, ['status', 'workspace_sha256', 'revision_sha256'], 'workspace');
  if (value.workspace.status !== 'clean') fail('workspace observation must be clean');
  text(value.workspace.workspace_sha256, 'workspace.workspace_sha256', SHA256);
  text(value.workspace.revision_sha256, 'workspace.revision_sha256', SHA256);
  validateDescriptors(value.descriptors);
  validateCanonicalReferences(value.canonical_refs);
  exactKeys(value.agent_import, ['status', 'manifest_sha256', 'signature_sha256'], 'agent_import');
  if (value.agent_import.status !== 'signed') fail('agent import must be signed');
  text(value.agent_import.manifest_sha256, 'agent_import.manifest_sha256', SHA256);
  text(value.agent_import.signature_sha256, 'agent_import.signature_sha256', SHA256);
  return value;
}

function cli(argv) {
  const [file, now = new Date().toISOString()] = argv;
  if (!file || argv.length > 2) fail('usage: trae-work-observation.v1.js <json-file> [now]');
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) fail('observation fixture must be a regular file');
  if (stat.size > MAX_FIXTURE_BYTES) fail('observation fixture exceeds size limit');
  const parsed = validateWorkObservation(JSON.parse(fs.readFileSync(file, 'utf8')), { now });
  process.stdout.write(`${JSON.stringify(parsed)}\n`);
}

if (require.main === module) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { CAPABILITY_MODES, validateWorkObservation };
