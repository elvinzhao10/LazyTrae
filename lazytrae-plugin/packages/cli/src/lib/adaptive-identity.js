'use strict';

const crypto = require('node:crypto');
const { validateAdaptiveSnapshot } = require('./adaptive-snapshot');

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const RUNTIME_MATERIAL_FIELDS = Object.freeze([
  'host', 'profile', 'probe', 'binary', 'session', 'worktree', 'mcp',
  'generated_asset', 'marketplace',
]);

function sha256Digest(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableDigest(value) {
  return sha256Digest(JSON.stringify(stableValue(value)));
}

function boundedStrings(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry) => typeof entry === 'string' && entry.length > 0))]
    : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function runtimeFingerprint(context, supplied) {
  const selectedHost = context.selected_host || supplied.selected_host;
  const fingerprints = context.runtime_fingerprints || supplied.runtime_fingerprints;
  if (selectedHost === undefined && fingerprints === undefined) return null;
  const material = isPlainObject(fingerprints) && typeof selectedHost === 'string'
    ? fingerprints[selectedHost] : null;
  const exact = isPlainObject(material)
    && JSON.stringify(Object.keys(material).sort()) === JSON.stringify([...RUNTIME_MATERIAL_FIELDS].sort());
  const available = exact && material.host === selectedHost
    && RUNTIME_MATERIAL_FIELDS.slice(1).every((field) => isPlainObject(material[field])
      && JSON.stringify(Object.keys(material[field]).sort()) === JSON.stringify(['digest', 'status'])
      && material[field].status === 'available'
      && SHA256.test(material[field].digest));
  return {
    status: available ? 'available' : 'unavailable',
    digest: stableDigest(available
      ? { selected_host: selectedHost, ...material }
      : { selected_host: typeof selectedHost === 'string' ? selectedHost : null, status: 'unavailable' }),
  };
}

function isNegatedApprovalAction(prefix) {
  return /\b(do not|don't|never|without)\s+(?:git\s+)?$/i.test(prefix);
}

function isDiscussion(prefix) {
  return /\b(discuss|document|describe|explain|mention|reference|review)\b[^.?!;\n]*\bhow\s+to\s*$/i.test(prefix);
}

function approvalClasses(text, context) {
  const classes = boundedStrings(context.approvalRequiredClasses || context.approval_classes);
  const rules = [
    ['install-or-download', /\b(install|download)\b/i],
    ['remote-data-egress', /\b(upload|send|egress)\b[^.?!;\n]*\b(repo|repository|source|data)\b|\bremote data\b|\bgit\s+push\b|\bpush\b(?:\s+(?:the\s+)?(?:changes?|branch|repository|repo|code|source|release|origin|upstream|remote|main|master)\b|\s+[\w.-]+\/[\w./-]+)/i],
    ['browser-or-desktop-control', /\b(use|run)\s+playwright\b|\b(control|click|open|automate)\b.*\b(browser|desktop)\b/i],
    ['credentials-auth-or-paid-service', /\b(?:use|enter|change|rotate|renew|revoke|delete|update|set)\b(?:(?!\b(?:use|enter|change|rotate|renew|revoke|delete|update|set)\b)[^.?!;\n])*\b(?:credentials?|password|paid service|api key|access token|deploy token|secret)\b|\blog in\b/i],
    ['host-mcp-settings-mutation', /\b(add|change|edit|configure)\b.*\b((mcp|host)\s+settings?|mcp\s+connector|connector\b.*\bhost\s+settings?)\b/i],
    ['persistent-capability', /\b(persist|enable permanently)\b.*\b(provider|capability|tooling)\b/i],
    ['account-marketplace-or-publish-mutation', /\b(publish|marketplace|account mutation)\b/i],
  ];
  for (const [name, positive] of rules) {
    const matches = text.matchAll(new RegExp(positive.source, `${positive.flags}g`));
    for (const match of matches) {
      const prefix = text.slice(Math.max(0, match.index - 64), match.index);
      if (!isNegatedApprovalAction(prefix)
        && !isDiscussion(prefix)) {
        classes.push(name);
        break;
      }
    }
  }
  return [...new Set(classes)].sort();
}

function fingerprintContext(request, context) {
  const supplied = context.currentFingerprints || context.current_fingerprints || {};
  const revision = context.revisionFingerprint || supplied.revisionFingerprint;
  const runtime = runtimeFingerprint(context, supplied);
  const legacyHost = context.hostFingerprint || supplied.hostFingerprint || '';
  return {
    requestDigest: sha256Digest(request),
    revisionFingerprint: revision && ['available', 'unavailable'].includes(revision.status)
      ? { status: revision.status, digest: revision.status === 'available' && SHA256.test(revision.digest) ? revision.digest : null }
      : { status: 'unavailable', digest: null },
    scopeFingerprint: SHA256.test(context.scopeFingerprint || supplied.scopeFingerprint || '')
      ? context.scopeFingerprint || supplied.scopeFingerprint
      : stableDigest({ boundary: 'adaptive-prompt', scope: context.scope || 'unspecified' }),
    hostFingerprint: runtime?.digest || (SHA256.test(legacyHost)
      ? legacyHost
      : stableDigest({ host: 'unverified-library-context' })),
    hostFingerprintStatus: runtime?.status || (SHA256.test(legacyHost) ? 'available' : 'unavailable'),
  };
}

function compatibleSnapshotIdentity(prior, identity) {
  return validateAdaptiveSnapshot(prior)
    && prior.requestDigest === identity.requestDigest
    && prior.scopeFingerprint === identity.scopeFingerprint
    && prior.hostFingerprint === identity.hostFingerprint
    && identity.hostFingerprintStatus === 'available'
    && prior.revisionFingerprint?.status === 'available'
    && identity.revisionFingerprint.status === 'available'
    && prior.revisionFingerprint.digest === identity.revisionFingerprint.digest;
}

function compatibleSnapshot(prior, identity, risk, approval) {
  return compatibleSnapshotIdentity(prior, identity)
    && prior.risk === risk
    && JSON.stringify(prior.approval?.requiredClasses || []) === JSON.stringify(approval.requiredClasses)
    && prior.approval?.status !== 'denied';
}

module.exports = {
  approvalClasses,
  boundedStrings,
  compatibleSnapshot,
  compatibleSnapshotIdentity,
  fingerprintContext,
  sha256Digest,
  stableDigest,
};
