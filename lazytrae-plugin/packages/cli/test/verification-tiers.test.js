'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tiers = require('../src/lib/verification-tiers');

// ---------------------------------------------------------------------------
// 1. Tier selection matrix — lowest sufficient tier from changed boundary.
// ---------------------------------------------------------------------------
const SELECTION_MATRIX = [
  ['doc change', { kind: 'doc' }, {}, 'V0'],
  ['metadata change', { kind: 'metadata' }, {}, 'V0'],
  ['formatting change', { kind: 'formatting' }, {}, 'V0'],
  ['inert fixture change', { kind: 'inert-fixture' }, {}, 'V0'],
  ['localized reversible behavior', { flags: { localizedReversible: true } }, {}, 'V1'],
  ['bare object (no flags)', {}, {}, 'V1'],
  ['cross-module behavior', { flags: { crossModule: true } }, {}, 'V2'],
  ['state behavior', { flags: { state: true } }, {}, 'V2'],
  ['parser behavior', { flags: { parser: true } }, {}, 'V2'],
  ['migration behavior', { flags: { migration: true } }, {}, 'V2'],
  ['lifecycle behavior', { flags: { lifecycle: true } }, {}, 'V2'],
  ['host-routing behavior', { flags: { hostRouting: true } }, {}, 'V2'],
  ['security boundary', { flags: { security: true } }, {}, 'V3'],
  ['trust boundary', { flags: { trust: true } }, {}, 'V3'],
  ['shared contract change', { flags: { sharedContract: true } }, {}, 'V3'],
  ['broad infrastructure change', { flags: { broadInfra: true } }, {}, 'V3'],
  ['unexplained focused failure', { kind: 'localized' }, { unexplainedFocusedFailure: true }, 'V3'],
  ['string kind: doc', 'doc', {}, 'V0'],
  ['string kind: security', 'security', {}, 'V3'],
  ['string kind: cross-module', 'cross-module', {}, 'V2'],
  ['string kind: localized', 'localized', {}, 'V1'],
];

for (const [label, boundary, risk, expected] of SELECTION_MATRIX) {
  test(`selectTier: ${label} -> ${expected}`, () => {
    assert.equal(tiers.selectTier(boundary, risk), expected);
  });
}

// ---------------------------------------------------------------------------
// 2. No-promotion rule — counts/size/"complex" naming never promote.
// ---------------------------------------------------------------------------
const NO_PROMOTION_MATRIX = [
  ['called "complex" but is a doc change', { kind: 'complex', flags: { doc: true } }, 'V0'],
  ['called "complex" with no behavioral flags', { kind: 'complex' }, 'V1'],
  ['called "large" with no behavioral flags', { kind: 'large' }, 'V1'],
  ['500 tests touched, localized change', { flags: { localizedReversible: true } }, 'V1'],
  ['huge plan size, doc change', { kind: 'doc' }, 'V0'],
  ['many agents, cross-module change', { flags: { crossModule: true } }, 'V2'],
  ['many agents, localized change', { flags: { localizedReversible: true } }, 'V1'],
  ['object with testCount/fileCount/agentCount only', { testCount: 999, fileCount: 500, agentCount: 42 }, 'V1'],
  ['string "complex"', 'complex', 'V1'],
  ['string "epic"', 'epic', 'V1'],
];

for (const [label, boundary, expected] of NO_PROMOTION_MATRIX) {
  test(`no-promotion: ${label} stays at lowest tier ${expected}`, () => {
    assert.equal(tiers.selectTier(boundary), expected);
  });
}

// A doc change that ALSO reaches a security boundary must promote (real risk,
// not naming) — guards against both over- and under-promotion.
test('selectTier: doc + security boundary promotes to V3 (real risk wins)', () => {
  assert.equal(tiers.selectTier({ kind: 'doc', flags: { security: true } }), 'V3');
});

test('selectTier: crossModule + doc promotes to V2 (boundary wins over inspect)', () => {
  assert.equal(tiers.selectTier({ flags: { crossModule: true, doc: true } }), 'V2');
});

// ---------------------------------------------------------------------------
// 3. Receipt reuse boundaries — green reusable iff declared inputs + covered
//    behavior unchanged.
// ---------------------------------------------------------------------------
function sampleReceipt(overrides) {
  return tiers.makeReceipt(Object.assign({
    tier: 'V1',
    argv: ['node', '--test', 'test/foo.test.js'],
    surface: 'completion-gates.js',
    covered_behavior: 'foo-module:add',
    tree: 'abc123',
    revision: 'sha-1',
    environment_fingerprint: { node: '22.22.2', os: 'darwin' },
    result: 'pass',
    artifact_ref: '.lazytrae/evidence/foo.json',
  }, overrides));
}

const baseInputs = {
  argv: ['node', '--test', 'test/foo.test.js'],
  surface: 'completion-gates.js',
  covered_behavior: 'foo-module:add',
  tree: 'abc123',
  revision: 'sha-1',
  environment_fingerprint: { node: '22.22.2', os: 'darwin' },
};

test('reuseReceipt: identical green receipt is reusable', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing, baseInputs), true);
});

test('reuseReceipt: failed receipt is never reusable', () => {
  const existing = sampleReceipt({ result: 'fail' });
  assert.equal(tiers.reuseReceipt(existing, baseInputs), false);
});

test('reuseReceipt: red (non-pass) result is never reusable', () => {
  const existing = sampleReceipt({ result: 'fail' });
  assert.equal(tiers.isGreenReceipt(existing), false);
  assert.equal(tiers.reuseReceipt(existing, baseInputs), false);
});

test('reuseReceipt: changed covered_behavior invalidates reuse', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing,
    Object.assign({}, baseInputs, { covered_behavior: 'foo-module:remove' })), false);
});

test('reuseReceipt: changed tree invalidates reuse', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing,
    Object.assign({}, baseInputs, { tree: 'def456' })), false);
});

test('reuseReceipt: changed revision invalidates reuse', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing,
    Object.assign({}, baseInputs, { revision: 'sha-2' })), false);
});

test('reuseReceipt: changed environment_fingerprint invalidates reuse', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing,
    Object.assign({}, baseInputs, { environment_fingerprint: { node: '20.0.0', os: 'darwin' } })), false);
});

test('reuseReceipt: changed argv invalidates reuse', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing,
    Object.assign({}, baseInputs, { argv: ['node', '--test', 'test/bar.test.js'] })), false);
});

test('reuseReceipt: changed surface invalidates reuse', () => {
  const existing = sampleReceipt({});
  assert.equal(tiers.reuseReceipt(existing,
    Object.assign({}, baseInputs, { surface: 'alternate-surface' })), false);
});

test('reuseReceipt: missing existing receipt is not reusable', () => {
  assert.equal(tiers.reuseReceipt(null, baseInputs), false);
  assert.equal(tiers.reuseReceipt(undefined, baseInputs), false);
});

// ---------------------------------------------------------------------------
// 4. Failure rerun scope — V1 failure does not cascade to V2/V3 suites; only
//    the failed check + directly affected checks rerun.
// ---------------------------------------------------------------------------
const CHECKS = [
  { id: 'v1-focus', coversBoundary: 'foo:add', dependsOn: [], tier: 'V1' },
  { id: 'v2-integ', coversBoundary: 'foo:add', dependsOn: ['foo:add'], tier: 'V2' },
  { id: 'v2-other', coversBoundary: 'bar:add', dependsOn: ['bar:add'], tier: 'V2' },
  { id: 'v3-comp', coversBoundary: 'security', dependsOn: ['security'], tier: 'V3' },
  { id: 'v1-unrelated', coversBoundary: 'baz:add', dependsOn: [], tier: 'V1' },
];

test('rerunScopeOnFailure: V1 failure reruns failed + directly affected only', () => {
  const scope = tiers.rerunScopeOnFailure(CHECKS[0], CHECKS);
  assert.deepEqual([...scope].sort(), ['v1-focus', 'v2-integ']);
});

test('rerunScopeOnFailure: does NOT include higher-tier suites with other boundaries', () => {
  const scope = tiers.rerunScopeOnFailure(CHECKS[0], CHECKS);
  assert.ok(!scope.has('v3-comp'), 'comprehensive suite must not be pulled in');
  assert.ok(!scope.has('v2-other'), 'unrelated integration suite must not be pulled in');
  assert.ok(!scope.has('v1-unrelated'), 'unrelated focused check must not be pulled in');
});

test('rerunScopeOnFailure: includes the failed check id even with no dependency graph', () => {
  const scope = tiers.rerunScopeOnFailure({ id: 'solo', coversBoundary: 'x' }, []);
  assert.deepEqual([...scope], ['solo']);
});

test('failureTriggersHigherTierSuite is always false (no cascade)', () => {
  assert.equal(tiers.failureTriggersHigherTierSuite(), false);
  assert.equal(tiers.FAILURE_PROMOTES_TIER, false);
});

// ---------------------------------------------------------------------------
// 5. Tier ordering / helpers.
// ---------------------------------------------------------------------------
test('tierRank orders V0<V1<V2<V3', () => {
  assert.ok(tiers.tierRank('V0') < tiers.tierRank('V1'));
  assert.ok(tiers.tierRank('V1') < tiers.tierRank('V2'));
  assert.ok(tiers.tierRank('V2') < tiers.tierRank('V3'));
});

test('TIERS expose V0-V3 with name + selection + action', () => {
  for (const id of ['V0', 'V1', 'V2', 'V3']) {
    const t = tiers.TIERS[id];
    assert.ok(t && typeof t === 'object', `${id} present`);
    assert.equal(t.id, id);
    assert.ok(typeof t.name === 'string' && t.name.length > 0);
    assert.ok(typeof t.selection === 'string' && t.selection.length > 0);
    assert.ok(typeof t.action === 'string' && t.action.length > 0);
  }
});

test('shared fixture consumed: TIERS equal embedded canonical when fixture lacks block', () => {
  // The shared fixture does not currently carry a verification_tiers block, so
  // TIERS must equal the embedded canonical copy (single source of truth).
  assert.equal(tiers.TIERS, tiers.EMBEDDED_TIERS);
});

// ---------------------------------------------------------------------------
// 6. Persistence round-trip using os.tmpdir() + fs.mkdtempSync (repo pattern).
//    Simulates two phases reusing a green receipt across an unchanged tree.
// ---------------------------------------------------------------------------
test('receipt reuse across phases via temp dir (os.tmpdir + mkdtempSync)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-vt-'));
  try {
    const receipt = sampleReceipt({});
    const file = path.join(dir, 'receipt.json');
    fs.writeFileSync(file, JSON.stringify(receipt));

    // Phase 2: a later stage wants to rerun the same check.
    const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
    const currentInputs = {
      argv: loaded.argv,
      surface: loaded.surface,
      covered_behavior: loaded.covered_behavior,
      tree: loaded.tree,
      revision: loaded.revision,
      environment_fingerprint: loaded.environment_fingerprint,
    };
    // Green, unchanged inputs => reuse, do NOT rerun.
    assert.equal(tiers.reuseReceipt(loaded, currentInputs), true);

    // A new revision lands => inputs changed => must rerun, not reuse.
    assert.equal(tiers.reuseReceipt(loaded,
      Object.assign({}, currentInputs, { revision: 'sha-CHANGED' })), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
