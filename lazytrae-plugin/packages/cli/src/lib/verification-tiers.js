'use strict';

// Verification tiers for LazySeries v1.3.0 (plan Section 9 + T6,
// "scale ceremony to task complexity").
//
// This module is the Trae adapter's single implementation of the shared
// V0-V3 verification contract. The tier *definitions* are the cross-repository
// LazySeries contract; we consume them here (and prefer a `verification_tiers`
// block in the shared fixture when one exists) so we never fork divergent
// per-host definitions.
//
// Core guarantees (plan Section 8, 9, 10):
//   - selectTier picks the LOWEST sufficient tier. Test/file/plan/agent counts
//     and a request merely being called "complex" can NEVER promote a tier.
//   - A verification is selected ONCE from the changed boundary and risk, then
//     reused while its declared inputs stay unchanged (green receipt reuse).
//   - A failing focused (V1) check triggers diagnosis; it does NOT cascade to
//     the full V2/V3 suite. Rerun the failed check, then only directly
//     affected checks.
//   - The comprehensive (V3) gate runs ONCE, normally in protected CI.

const fs = require('fs');
const path = require('path');

// Canonical V0-V3 tier definitions (plan Section 9). Used directly, or as the
// fallback when the shared fixture does not yet carry a `verification_tiers`
// block. Keeping them here makes the adapter self-contained while still
// preferring the shared contract when present.
const EMBEDDED_TIERS = Object.freeze({
  V0: Object.freeze({
    id: 'V0',
    name: 'inspect',
    selection: 'documentation, metadata, formatting, or inert fixture changes',
    action: 'Run syntax/schema/static checks only when applicable; no new test required by default.',
  }),
  V1: Object.freeze({
    id: 'V1',
    name: 'focused',
    selection: 'localized reversible behavior',
    action: 'Run the smallest existing test or direct user-surface scenario covering the changed boundary.',
  }),
  V2: Object.freeze({
    id: 'V2',
    name: 'integrated',
    selection: 'cross-module, state, parser, migration, lifecycle, or host-routing behavior',
    action: 'Run focused checks plus one real consumer/integration scenario.',
  }),
  V3: Object.freeze({
    id: 'V3',
    name: 'comprehensive',
    selection: 'security/trust boundaries, release packaging, shared contract/schema changes, broad infrastructure changes, or an unexplained focused failure',
    action: 'Run the repository comprehensive gate once, normally in protected CI.',
  }),
});

const TIER_ORDER = Object.freeze(['V0', 'V1', 'V2', 'V3']);

const FIXTURE_PATH = path.resolve(
  __dirname, '..', '..', 'contracts', 'fixtures',
  'lazyseries-v130-scenarios.v1.json',
);

// Consume the shared LazySeries contract. If the fixture later carries a
// `verification_tiers` block (the cross-repo source of truth), we use it;
// otherwise we fall back to the embedded canonical copy. Either way the
// definitions are never independently forked.
function loadSharedTiers() {
  try {
    const doc = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    if (doc && typeof doc.verification_tiers === 'object' && doc.verification_tiers !== null) {
      const block = doc.verification_tiers;
      if (['V0', 'V1', 'V2', 'V3'].every((id) => block[id] && typeof block[id] === 'object')) {
        return Object.freeze({
          V0: Object.freeze(block.V0),
          V1: Object.freeze(block.V1),
          V2: Object.freeze(block.V2),
          V3: Object.freeze(block.V3),
        });
      }
    }
  } catch (_) {
    // Missing or malformed fixture: keep the embedded canonical copy.
  }
  return EMBEDDED_TIERS;
}

const TIERS = loadSharedTiers();

// Presentation-tier names (small/medium/complex) are NEVER verification tiers.
// They are deliberately ignored by selectTier so they cannot promote a check.
const NON_PROMOTING_KINDS = new Set([
  'small', 'medium', 'complex', 'large', 'epic',
]);

const KIND_TO_FLAG = Object.freeze({
  doc: 'doc',
  documentation: 'doc',
  metadata: 'metadata',
  formatting: 'formatting',
  fixture: 'inertFixture',
  'inert-fixture': 'inertFixture',
  inertfixture: 'inertFixture',
  security: 'security',
  trust: 'trust',
  'shared-contract': 'sharedContract',
  sharedcontract: 'sharedContract',
  'broad-infra': 'broadInfra',
  broadinfra: 'broadInfra',
  'cross-module': 'crossModule',
  crossmodule: 'crossModule',
  state: 'state',
  parser: 'parser',
  migration: 'migration',
  lifecycle: 'lifecycle',
  'host-routing': 'hostRouting',
  hostrouting: 'hostRouting',
  localized: 'localizedReversible',
  behavior: 'localizedReversible',
  reversible: 'localizedReversible',
});

// Normalize a changed-boundary descriptor into a structured flag set.
// Accepts a string kind or an object:
//   { kind, flags: { doc, metadata, formatting, inertFixture, localizedReversible,
//                     crossModule, state, parser, migration, lifecycle, hostRouting,
//                     security, trust, sharedContract, broadInfra } }
// Presentation-tier names (small/medium/complex/...) are intentionally dropped.
function normalizeBoundary(changedBoundary) {
  const flags = {
    doc: false,
    metadata: false,
    formatting: false,
    inertFixture: false,
    localizedReversible: false,
    crossModule: false,
    state: false,
    parser: false,
    migration: false,
    lifecycle: false,
    hostRouting: false,
    security: false,
    trust: false,
    sharedContract: false,
    broadInfra: false,
  };
  if (changedBoundary == null) return { kind: null, flags };
  if (typeof changedBoundary === 'string') {
    const kind = changedBoundary.trim().toLowerCase();
    if (NON_PROMOTING_KINDS.has(kind)) return { kind, flags }; // no promotion
    const flag = KIND_TO_FLAG[kind];
    if (flag) flags[flag] = true;
    return { kind, flags };
  }
  if (typeof changedBoundary === 'object') {
    const kind = typeof changedBoundary.kind === 'string'
      ? changedBoundary.kind.trim().toLowerCase() : null;
    if (kind && NON_PROMOTING_KINDS.has(kind)) {
      // A presentation tier was named but no behavioral flags supplied:
      // keep it un-promoting. Apply any explicit flags regardless.
    }
    const src = changedBoundary.flags && typeof changedBoundary.flags === 'object'
      ? changedBoundary.flags : changedBoundary;
    for (const key of Object.keys(flags)) {
      if (src[key] === true) flags[key] = true;
    }
    if (kind && KIND_TO_FLAG[kind] && !NON_PROMOTING_KINDS.has(kind)) {
      flags[KIND_TO_FLAG[kind]] = true;
    }
    return { kind, flags };
  }
  return { kind: null, flags };
}

// Normalize a risk descriptor. The ONLY risk that can promote a tier is an
// unexplained focused failure (-> V3). Counts, sizes, and agent counts are
// intentionally NOT read here.
function normalizeRisk(risk) {
  const out = { unexplainedFocusedFailure: false };
  if (risk == null) return out;
  if (typeof risk === 'string') {
    out.unexplainedFocusedFailure = /\b(unexplained|mystery|unknown[- ]cause)\b/i.test(risk)
      && /\b(failure|fail|regression|breakage)\b/i.test(risk);
    return out;
  }
  if (typeof risk === 'object') {
    if (risk.unexplainedFocusedFailure === true) out.unexplainedFocusedFailure = true;
    if (risk.unexplained_focused_failure === true) out.unexplainedFocusedFailure = true;
  }
  return out;
}

function tierRank(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < 0 ? Number.POSITIVE_INFINITY : idx;
}

// selectTier(changedBoundary, risk) -> the lowest sufficient tier id.
//
// Promotion happens ONLY for the changed boundary or an observed risk:
//   - V3 if security | trust | sharedContract | broadInfra | unexplained focused failure
//   - V2 if crossModule | state | parser | migration | lifecycle | hostRouting
//   - V0 if doc | metadata | formatting | inertFixture (and nothing higher)
//   - V1 otherwise (localized reversible behavior)
// Test/file/plan/agent counts and "complex" naming are never consulted.
function selectTier(changedBoundary, risk) {
  const { flags } = normalizeBoundary(changedBoundary);
  const r = normalizeRisk(risk);

  if (flags.security || flags.trust || flags.sharedContract
    || flags.broadInfra || r.unexplainedFocusedFailure) {
    return 'V3';
  }
  if (flags.crossModule || flags.state || flags.parser
    || flags.migration || flags.lifecycle || flags.hostRouting) {
    return 'V2';
  }
  if (flags.doc || flags.metadata || flags.formatting || flags.inertFixture) {
    return 'V0';
  }
  return 'V1';
}

// Build a compact verification receipt. Fields are optional at construction but
// all are retained so reuse comparison is exact.
function makeReceipt(fields) {
  const f = fields || {};
  return {
    tier: f.tier != null ? f.tier : null,
    argv: f.argv != null ? f.argv : null,
    surface: f.surface != null ? f.surface : null,
    covered_behavior: f.covered_behavior != null ? f.covered_behavior : null,
    tree: f.tree != null ? f.tree : null,
    revision: f.revision != null ? f.revision : null,
    environment_fingerprint: f.environment_fingerprint != null ? f.environment_fingerprint : null,
    result: f.result != null ? f.result : null,
    artifact_ref: f.artifact_ref != null ? f.artifact_ref : null,
  };
}

function isGreenReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return false;
  const r = receipt.result;
  return r === 'pass' || r === 'green' || r === true;
}

// The declared inputs that, if unchanged, keep a green receipt reusable.
function declaredInputs(receipt) {
  const r = receipt || {};
  return {
    argv: r.argv != null ? r.argv : null,
    surface: r.surface != null ? r.surface : null,
    covered_behavior: r.covered_behavior != null ? r.covered_behavior : null,
    tree: r.tree != null ? r.tree : null,
    revision: r.revision != null ? r.revision : null,
    environment_fingerprint: r.environment_fingerprint != null ? r.environment_fingerprint : null,
  };
}

// Structural equality for declared-input values. argv is typically an array and
// environment_fingerprint is typically an object; reuse must compare by VALUE
// (two runs with the same command / same fingerprint are identical), not by
// reference identity. Scalars fall back to strict equality.
function valuesEqual(x, y) {
  if (x === y) return true;
  if (x == null || y == null) return x === y;
  if (Array.isArray(x) || Array.isArray(y)) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return false;
    return x.every((item, i) => valuesEqual(item, y[i]));
  }
  if (typeof x === 'object' && typeof y === 'object') {
    const kx = Object.keys(x);
    const ky = Object.keys(y);
    if (kx.length !== ky.length) return false;
    return kx.every((k) => valuesEqual(x[k], y[k]));
  }
  return false;
}

// reuseReceipt(existing, currentInputs) -> bool
// A green receipt is reusable iff it is green AND its declared inputs and
// covered behavior are unchanged. A failing or stale receipt is never reused.
function reuseReceipt(existing, currentInputs) {
  if (!isGreenReceipt(existing)) return false;
  const a = declaredInputs(existing);
  const b = declaredInputs(currentInputs);
  return valuesEqual(a.argv, b.argv)
    && valuesEqual(a.surface, b.surface)
    && valuesEqual(a.covered_behavior, b.covered_behavior)
    && valuesEqual(a.tree, b.tree)
    && valuesEqual(a.revision, b.revision)
    && valuesEqual(a.environment_fingerprint, b.environment_fingerprint);
}

// A focused (V1) failure must NOT cascade into the full V2/V3 suite. Rerun the
// failed check, then only checks whose declared dependencies (dependsOn
// boundaries) include the failed boundary. Higher-tier suites are NOT pulled in
// merely because a lower-tier check failed.
function rerunScopeOnFailure(failedCheck, allChecks) {
  const failed = failedCheck || {};
  const failedId = failed.id;
  const failedBoundary = failed.coversBoundary;
  const ids = new Set();
  if (failedId !== undefined && failedId !== null) ids.add(failedId);
  const checks = Array.isArray(allChecks) ? allChecks : [];
  for (const check of checks) {
    if (check.id === failedId) continue;
    const deps = Array.isArray(check.dependsOn) ? check.dependsOn : [];
    if (failedBoundary !== undefined && failedBoundary !== null && deps.includes(failedBoundary)) {
      ids.add(check.id);
    }
  }
  return ids;
}

// Explicit invariant: a failing focused check does not trigger a higher-tier
// blanket suite. Reviewers inspect existing evidence rather than rerun it.
const FAILURE_PROMOTES_TIER = false;

function failureTriggersHigherTierSuite() {
  return false;
}

module.exports = {
  EMBEDDED_TIERS,
  FAILURE_PROMOTES_TIER,
  TIERS,
  TIER_ORDER,
  declaredInputs,
  failureTriggersHigherTierSuite,
  isGreenReceipt,
  makeReceipt,
  normalizeBoundary,
  normalizeRisk,
  rerunScopeOnFailure,
  reuseReceipt,
  selectTier,
  tierRank,
  valuesEqual,
};
