'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv = require('ajv');

const contractsDir = path.join(__dirname, '..', 'contracts');
const fixtureDir = path.join(contractsDir, 'fixtures', 'v103');
const contractPath = path.join(contractsDir, 'adaptive-harness-contract.v1.json');
const schemaPath = path.join(contractsDir, 'adaptive-harness-contract.v1.schema.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function parseChecksumFile(text) {
  const entries = new Map();
  for (const line of text.trim().split('\n')) {
    const match = /^([0-9a-f]{64})  ([0-9]{2}-[a-z0-9-]+\.json)$/.exec(line);
    assert.ok(match, `invalid checksum line: ${line}`);
    assert.equal(entries.has(match[2]), false, `duplicate checksum entry: ${match[2]}`);
    entries.set(match[2], match[1]);
  }
  return entries;
}

function loadFamily() {
  const contractBytes = fs.readFileSync(contractPath);
  const contract = JSON.parse(contractBytes);
  const schema = readJson(schemaPath);
  const manifest = readJson(path.join(fixtureDir, 'manifest.json'));
  const checksums = parseChecksumFile(fs.readFileSync(path.join(fixtureDir, 'sha256sums.txt'), 'utf8'));
  const fixtureBytes = new Map();
  const fixtures = new Map();
  for (const entry of manifest.fixtures) {
    const bytes = fs.readFileSync(path.join(fixtureDir, entry.file));
    fixtureBytes.set(entry.file, bytes);
    fixtures.set(entry.file, JSON.parse(bytes));
  }
  return { checksums, contract, contractBytes, fixtureBytes, fixtures, manifest, schema };
}

function relationshipErrors(manifest, fixtureBytes, fixtures, checksums) {
  const errors = [];
  const manifestFiles = new Set();
  for (const entry of manifest.fixtures) {
    manifestFiles.add(entry.file);
    const bytes = fixtureBytes.get(entry.file);
    const fixture = fixtures.get(entry.file);
    if (!bytes || !fixture) {
      errors.push(`missing fixture: ${entry.file}`);
      continue;
    }
    const actual = sha256(bytes);
    if (entry.sha256 !== actual) errors.push(`manifest digest mismatch: ${entry.file}`);
    if (checksums.get(entry.file) !== actual) errors.push(`checksum mismatch: ${entry.file}`);
    if (entry.id !== fixture.id) errors.push(`manifest id mismatch: ${entry.file}`);
    if (entry.category !== fixture.category) errors.push(`manifest category mismatch: ${entry.file}`);
  }
  for (const file of checksums.keys()) {
    if (!manifestFiles.has(file)) errors.push(`unexpected checksum entry: ${file}`);
  }
  return errors;
}

function validators(schema) {
  const ajv = new Ajv({ allErrors: true, schemaId: 'auto', strict: false });
  const validateContract = ajv.compile(schema);
  return {
    validateContract,
    validateFixture: ajv.compile({
      $ref: '#/definitions/fixture',
      definitions: schema.definitions,
    }),
    validateManifest: ajv.compile({
      $ref: '#/definitions/fixture_manifest',
      definitions: schema.definitions,
    }),
  };
}

test('validates the portable root contract and concrete approval policy', () => {
  // Given: the checked-in root contract, schema, and checksum sidecar.
  const family = loadFamily();
  const { validateContract } = validators(family.schema);

  // When: the contract is validated and its continuation policy is inspected.
  const valid = validateContract(family.contract);

  // Then: schema, checksum, continuation, revision, and approval boundaries agree.
  assert.equal(valid, true, JSON.stringify(validateContract.errors));
  assert.equal(sha256(family.contractBytes), fs.readFileSync(`${contractPath}.sha256`, 'utf8').trim().split(/\s+/)[0]);
  assert.deepEqual(new Set(family.contract.continuation_policy.required_matches), new Set([
    'hostFingerprint',
    'requestDigest',
    'revisionFingerprint',
    'scopeFingerprint',
  ]));
  assert.deepEqual(new Set(family.contract.continuation_policy.re_evaluate_before_reuse),
    new Set(['approval', 'risk']));
  assert.equal(family.contract.fingerprint_policy.revision_unavailable, 'fail-closed');
  assert.deepEqual(new Set(family.contract.fingerprint_policy.revision_material), new Set([
    'committed-base',
    'nonignored-untracked-content',
    'staged-content',
    'tracked-working-content',
  ]));
  assert.equal(family.contract.authority_matrix['release-review'], 'automatic');
  assert.equal(family.contract.authority_matrix['security-review'], 'automatic');
  assert.deepEqual(new Set(family.contract.approval_policy.approval_required_action_classes), new Set([
    'account-marketplace-or-publish-mutation',
    'browser-or-desktop-control',
    'credentials-auth-or-paid-service',
    'host-mcp-settings-mutation',
    'install-or-download',
    'persistent-capability',
    'remote-data-egress',
  ]));
});

test('validates every fixture, exact request digest, manifest entry, and checksum entry', () => {
  // Given: the complete fixture family and its two integrity indexes.
  const family = loadFamily();
  const { validateFixture, validateManifest } = validators(family.schema);

  // When: every artifact and relationship is independently checked.
  assert.equal(validateManifest(family.manifest), true, JSON.stringify(validateManifest.errors));
  assert.equal(family.manifest.fixtures.length, 10);
  for (const entry of family.manifest.fixtures) {
    const fixture = family.fixtures.get(entry.file);
    assert.equal(validateFixture(fixture), true, `${entry.file}: ${JSON.stringify(validateFixture.errors)}`);
    assert.equal(fixture.expected_snapshot.adaptive.requestDigest,
      `sha256:${sha256(Buffer.from(fixture.request, 'utf8'))}`, entry.file);
    const history = fixture.expected_snapshot.adaptive.escalationHistory;
    assert.equal(fixture.expected_snapshot.adaptive.escalationCount, history.length, entry.file);
    assert.ok(history.length <= family.contract.escalation_bounds.max_auto_escalations, entry.file);
    const ownedResponsibilities = fixture.expected_decision.ownership
      .map((item) => item.responsibility);
    assert.equal(ownedResponsibilities.length, new Set(ownedResponsibilities).size,
      `duplicate responsibility owner: ${entry.file}`);
    assert.deepEqual(new Set(ownedResponsibilities), new Set(fixture.expected_decision.responsibilities),
      `ownership coverage mismatch: ${entry.file}`);
    for (const [index, transition] of history.entries()) {
      assert.equal(transition.sequence, index + 1, entry.file);
      if (index > 0) assert.equal(transition.fromMode, history[index - 1].toMode, entry.file);
    }
  }

  // Then: the ten binding categories and both integrity indexes agree with actual bytes.
  assert.deepEqual(relationshipErrors(
    family.manifest, family.fixtureBytes, family.fixtures, family.checksums), []);
  const digestSummary = readJson(path.join(contractsDir, 'adaptive-harness-v103-digest.json'));
  for (const artifact of digestSummary.artifacts) {
    const bytes = fs.readFileSync(path.join(contractsDir, artifact.name));
    assert.equal(artifact.sha256, sha256(bytes), artifact.name);
    assert.equal(artifact.size_bytes, bytes.length, artifact.name);
  }
  for (const fixtureEntry of digestSummary.fixtures) {
    const bytes = fs.readFileSync(path.join(fixtureDir, fixtureEntry.name));
    assert.equal(fixtureEntry.sha256, sha256(bytes), fixtureEntry.name);
    assert.equal(fixtureEntry.size_bytes, bytes.length, fixtureEntry.name);
  }
  assert.equal(digestSummary.fixture_directory.manifest_sha256,
    sha256(fs.readFileSync(path.join(fixtureDir, 'manifest.json'))));
  assert.equal(digestSummary.fixture_directory.sha256sums_sha256,
    sha256(fs.readFileSync(path.join(fixtureDir, 'sha256sums.txt'))));
  assert.deepEqual(new Set(family.manifest.fixtures.map((entry) => entry.category)), new Set([
    'broad-feature-unresolved-design',
    'direct-task-verification-failure',
    'explicit-named-workflow',
    'localized-one-file-correction',
    'multi-session-migration',
    'preferred-capability-unavailable',
    'release-or-publication-change',
    'security-sensitive-authorization-change',
    'stale-continuation-snapshot',
    'unfamiliar-cross-file-bug',
  ]));
});

test('makes responsibility ownership and stale continuation executable', () => {
  // Given: the security and stale-continuation fixtures.
  const family = loadFamily();
  const security = family.fixtures.get('04-orchestrated-security-change.json');
  const stale = family.fixtures.get('10-responsibility-ownership.json');

  // When: ownership and old/new continuation material are compared.
  const implementationOwner = security.expected_decision.ownership
    .find((item) => item.responsibility === 'implementation');
  const securityReviewer = security.expected_decision.ownership
    .find((item) => item.responsibility === 'security-review');

  // Then: review is independent but not approval-gated, and stale completion cannot resume.
  assert.equal(implementationOwner.ownerClass, 'implementation-owner');
  assert.equal(securityReviewer.ownerClass, 'independent-reviewer');
  assert.equal(security.expected_decision.approval_required, false);
  assert.deepEqual(stale.continuation_case.changedMaterial, ['revisionFingerprint']);
  assert.equal(stale.continuation_case.oldFingerprints.requestDigest,
    stale.continuation_case.newFingerprints.requestDigest);
  assert.equal(stale.continuation_case.oldFingerprints.scopeFingerprint,
    stale.continuation_case.newFingerprints.scopeFingerprint);
  assert.equal(stale.continuation_case.oldFingerprints.hostFingerprint,
    stale.continuation_case.newFingerprints.hostFingerprint);
  assert.notEqual(stale.continuation_case.oldFingerprints.revisionFingerprint.digest,
    stale.continuation_case.newFingerprints.revisionFingerprint.digest);
  assert.equal(stale.continuation_case.preservedDiagnostic.preserved, true);
  assert.equal(stale.continuation_case.priorCompletionEvidence, 'rejected');
  assert.deepEqual(stale.continuation_case.reclassifiedDecision, stale.expected_decision);
});

test('rejects malformed, mapped, fake-digest, and stale-sidecar mutations', () => {
  // Given: valid root, fixture, manifest, and checksum artifacts.
  const family = loadFamily();
  const { validateContract, validateFixture } = validators(family.schema);

  // When: each trust boundary is mutated independently.
  const rootLeak = structuredClone(family.contract);
  rootLeak.host_mapping = { capability: 'implementation-choice' };
  const fixtureLeak = structuredClone(family.fixtures.get('01-direct-localized-fix.json'));
  fixtureLeak.expected_snapshot.adaptive.runtimeResolution = { 'text-search': 'host-native' };
  const textLeak = structuredClone(family.fixtures.get('01-direct-localized-fix.json'));
  textLeak.expected_decision.user_explanation.selected = 'package-lsp';
  const fakeDigest = structuredClone(family.fixtures.get('01-direct-localized-fix.json'));
  fakeDigest.expected_snapshot.adaptive.requestDigest = 'sha256:not-a-digest';
  const staleManifest = structuredClone(family.manifest);
  staleManifest.fixtures[0].sha256 = '0'.repeat(64);
  const staleChecksums = new Map(family.checksums);
  staleChecksums.set(family.manifest.fixtures[0].file, '0'.repeat(64));

  // Then: schema and relationship checks reject every mutation, including malformed JSON.
  assert.equal(validateContract(rootLeak), false);
  assert.equal(validateFixture(fixtureLeak), false);
  assert.equal(validateFixture(textLeak), false);
  assert.equal(validateFixture(fakeDigest), false);
  assert.match(relationshipErrors(
    staleManifest, family.fixtureBytes, family.fixtures, family.checksums).join('\n'),
  /manifest digest mismatch/);
  assert.match(relationshipErrors(
    family.manifest, family.fixtureBytes, family.fixtures, staleChecksums).join('\n'),
  /checksum mismatch/);
  assert.throws(() => JSON.parse('{'), SyntaxError);
  const serializedFixtures = [...family.fixtureBytes.values()]
    .map((bytes) => bytes.toString('utf8')).join('\n');
  assert.doesNotMatch(serializedFixtures,
    /runtimeResolution|host-native|package-lsp|package-cli|package-loop-store|lsp-bridge|\/Users\/|\.worktrees\//);
});
