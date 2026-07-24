'use strict';

const crypto = require('node:crypto');
const { validateAdaptiveSnapshot } = require('./adaptive-snapshot');

const SHA256 = /^sha256:[0-9a-f]{64}$/;

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

function approvalClasses(text, context) {
  const classes = boundedStrings(context.approvalRequiredClasses || context.approval_classes);
  const rules = [
    ['install-or-download', /\b(install|download)\b/i, /\b(do not|don't|without)\s+(install|download)/i],
    ['remote-data-egress', /\b(upload|send|egress)\b.*\b(repo|repository|source|data)\b|\bremote data\b|\b(?:git\s+)?push\b.*\b(?:to|branch|origin|remote|github|main|master|production)\b/i, /\bdo not\s+(upload|send|push)/i],
    ['browser-or-desktop-control', /\b(use|run)\s+playwright\b|\b(control|click|open|automate)\b.*\b(browser|desktop)\b/i, /\b(do not|don't|never|without)\s+(use|run|control|click|open|automate)/i],
    ['credentials-auth-or-paid-service', /\b(use|enter|change|rotate|renew|revoke|delete|update|set)\b.*\b(credentials?|password|paid service|api key|access token|deploy token|secret)\b|\blog in\b/i, /\bdo not\s+(use|enter|change|rotate|renew|revoke|delete|update|set|log in)/i],
    ['host-mcp-settings-mutation', /\b(add|change|edit|configure)\b.*\b((mcp|host)\s+settings?|mcp\s+connector|connector\b.*\bhost\s+settings?)\b/i, /\b(do not|don't|never|without)\s+(add|change|edit|configure)/i],
    ['persistent-capability', /\b(persist|enable permanently)\b.*\b(provider|capability|tooling)\b/i, /\bdo not\s+(persist|enable)/i],
    ['account-marketplace-or-publish-mutation', /\b(publish|marketplace|account mutation)\b/i, /\b(do not|don't|without)\s+(publish|mutate)/i],
  ];
  for (const [name, positive, negative] of rules) {
    if (positive.test(text) && !negative.test(text)) classes.push(name);
  }
  return [...new Set(classes)].sort();
}

function fingerprintContext(request, context) {
  const supplied = context.currentFingerprints || context.current_fingerprints || {};
  const revision = context.revisionFingerprint || supplied.revisionFingerprint;
  return {
    requestDigest: sha256Digest(request),
    revisionFingerprint: revision && ['available', 'unavailable'].includes(revision.status)
      ? { status: revision.status, digest: revision.status === 'available' && SHA256.test(revision.digest) ? revision.digest : null }
      : { status: 'unavailable', digest: null },
    scopeFingerprint: SHA256.test(context.scopeFingerprint || supplied.scopeFingerprint || '')
      ? context.scopeFingerprint || supplied.scopeFingerprint
      : stableDigest({ boundary: 'adaptive-prompt', scope: context.scope || 'unspecified' }),
    hostFingerprint: SHA256.test(context.hostFingerprint || supplied.hostFingerprint || '')
      ? context.hostFingerprint || supplied.hostFingerprint
      : stableDigest({ host: 'unverified-library-context' }),
  };
}

function compatibleSnapshotIdentity(prior, identity) {
  return validateAdaptiveSnapshot(prior)
    && prior.requestDigest === identity.requestDigest
    && prior.scopeFingerprint === identity.scopeFingerprint
    && prior.hostFingerprint === identity.hostFingerprint
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
