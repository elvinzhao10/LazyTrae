const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  INTERNAL_STATE_MAPPING,
  normalizeV1ReadinessRecord,
  readinessContractIntegrity,
  readinessReport,
  validateReadinessRecord,
} = require('../src/lib/lazyseries-capability-readiness');

const contractPath = path.join(__dirname, '..', 'contracts', 'lazyseries-capability-readiness.v2.json');
const fixtureRoot = path.join(__dirname, '..', 'contracts', 'fixtures', 'readiness-v2');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), 'utf8'));
}

test('validates the checksummed v2 contract and package fixture', () => {
  // Given: the mirrored v2 contract and its valid package receipt.
  const bytes = fs.readFileSync(contractPath);
  const declared = fs.readFileSync(`${contractPath}.sha256`, 'utf8').trim().split(/\s+/)[0];

  // When: the real contract boundary parses the receipt.
  const parsed = validateReadinessRecord(fixture('valid-package.json'), { sourceScope: 'package' });

  // Then: checksum integrity and the v2 evidence boundary are observable.
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), declared);
  assert.equal(readinessContractIntegrity(), true);
  assert.equal(parsed.schema_version, 2);
  assert.equal(parsed.contract_version, '2.0.0');
  assert.equal(parsed.readiness_scope, 'package');
  assert.equal(validateReadinessRecord(fixture('prompt-injection.json'), { sourceScope: 'package' }).readiness_scope, 'package');
  for (const line of fs.readFileSync(path.join(fixtureRoot, 'sha256sums.txt'), 'utf8').trim().split('\n')) {
    const [digest, name] = line.split(/\s+/);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(fixtureRoot, name))).digest('hex'), digest);
  }
});

test('maps every internal state exactly once', () => {
  // Given: the complete legacy producer status vocabulary.
  const expected = {
    'package-ready': ['invoke-documented', 'documented-tested', 'ready', 'not-run', 'package'],
    'owned-ready': ['invoke-documented', 'documented-tested', 'ready', 'not-run', 'package'],
    missing: ['unavailable', 'unavailable', 'missing', 'not-run', 'package'],
    incompatible: ['unavailable', 'unavailable', 'incompatible', 'not-run', 'package'],
    disabled: ['descriptor-only', 'documented-untested', 'disabled', 'not-run', 'package'],
    'failed-optional': ['unavailable', 'unavailable', 'failed', 'not-run', 'package'],
    'not-initialized': ['descriptor-only', 'documented-untested', 'not-checked', 'not-run', 'package'],
    'probe-observed': ['observe-only', 'observed-build-specific', 'not-checked', 'observed', 'probe'],
    'current-session-ready': ['invoke-documented', 'documented-tested', 'ready', 'observed', 'current-session'],
  };

  // When: the shared mapping is enumerated.
  const actual = Object.fromEntries(Object.entries(INTERNAL_STATE_MAPPING));

  // Then: the mapping is total, deterministic, and has no duplicate state key.
  assert.deepEqual(actual, expected);
  assert.equal(Object.keys(actual).length, 9);
});

test('fails closed for corrupt checksum and malformed or forged receipts', (t) => {
  // Given: a corrupt checksum and the shared adversarial fixtures.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-readiness-v2-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const checksumPath = path.join(root, 'contract.sha256');
  fs.writeFileSync(checksumPath, `${'0'.repeat(64)}  contract.json\n`);

  // When/Then: integrity and each untrusted receipt fail at the parser boundary.
  assert.equal(readinessContractIntegrity({ contractPath, checksumPath }), false);
  assert.throws(() => validateReadinessRecord(fixture('missing-evidence.json'), { sourceScope: 'package' }), /evidence/);
  assert.throws(() => validateReadinessRecord(fixture('unknown-version.json'), { sourceScope: 'package' }), /contract_version/);
  assert.throws(() => validateReadinessRecord(fixture('unknown-field.json'), { sourceScope: 'package' }), /unknown fields/);
  const unknownStatus = fixture('valid-package.json');
  unknownStatus.internal_status = 'future-status';
  assert.throws(() => validateReadinessRecord(unknownStatus, { sourceScope: 'package' }), /internal_status/);
  assert.throws(
    () => validateReadinessRecord(fixture('forged-current-session.json'), { sourceScope: 'current-session', currentSessionId: 'session-real' }),
    /current session/,
  );
  assert.throws(() => validateReadinessRecord(fixture('forged-current-session.json'), { sourceScope: 'package' }), /package evidence/);
});

test('normalizes a minimal v1 receipt in memory without mutating it', () => {
  // Given: immutable historical v1 ownership evidence.
  const legacy = Object.freeze({
    schema_version: 1,
    contract_version: '0.18.0',
    contract_digest: fixture('valid-package.json').policy_digest,
    host: 'lazytrae',
    capability: 'local_search',
    provider: 'ripgrep',
    status: 'package-ready',
    readiness_scope: 'package-ready',
    reason_code: null,
    message: 'legacy',
    receipt: null,
    details: Object.freeze({ source: 'host' }),
  });

  // When: the read-only importer normalizes it.
  const normalized = normalizeV1ReadinessRecord(legacy);

  // Then: only the returned value is v2 and it passes the real parser.
  assert.equal(legacy.schema_version, 1);
  assert.equal(normalized.schema_version, 2);
  assert.equal(normalized.host, 'trae-cli');
  assert.deepEqual(validateReadinessRecord(normalized, { sourceScope: 'package' }), normalized);
});

test('the active readiness writer emits v2 only', (t) => {
  // Given: an uninitialized caller workspace.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-readiness-v2-writer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // When: the active producer reports capability readiness.
  const records = readinessReport(root);

  // Then: every emitted record is package-scoped v2 for the TraeCode CLI surface.
  assert.ok(records.length > 0);
  assert.ok(records.every(record => record.schema_version === 2));
  assert.ok(records.every(record => record.contract_version === '2.0.0'));
  assert.ok(records.every(record => record.host === 'trae-cli'));
  assert.ok(records.every(record => record.readiness_scope === 'package'));
  assert.ok(records.every(record => record.public_label !== 'observed-build-specific'));
});
