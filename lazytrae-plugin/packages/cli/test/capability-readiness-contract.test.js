const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contractPath = path.join(__dirname, '..', 'contracts', 'lazyseries-capability-readiness.v1.json');
const fixturePath = path.join(__dirname, '..', 'contracts', 'fixtures', 'v018', 'readiness-records.json');
const policyDigest = '3a65e1d7108c1a607035cbb127117dc5c18d0116ddf88c3e9ca5aaa4db032c4a';
const statuses = [
  'package-ready',
  'owned-ready',
  'missing',
  'incompatible',
  'disabled',
  'failed-optional',
  'not-initialized',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateRecord(record, schema) {
  const properties = schema.properties;
  assert.deepEqual(Object.keys(record).sort(), [...schema.required].sort(), 'record must contain exactly the required fields');
  assert.equal(record.schema_version, properties.schema_version.const);
  assert.equal(record.contract_version, properties.contract_version.const);
  assert.equal(record.contract_digest, properties.contract_digest.const);
  assert.ok(properties.host.enum.includes(record.host), 'host must be declared by the contract');
  assert.equal(typeof record.capability, 'string');
  assert.ok(record.capability.length > 0, 'capability must not be empty');
  assert.ok(record.provider === null || typeof record.provider === 'string', 'provider must be nullable string');
  assert.ok(properties.status.enum.includes(record.status), 'status must be an exact declared value');
  assert.ok(properties.readiness_scope.enum.includes(record.readiness_scope), 'readiness scope must be declared by the contract');
  assert.ok(record.reason_code === null || typeof record.reason_code === 'string', 'reason_code must be nullable string');
  assert.equal(typeof record.message, 'string');
  assert.ok(typeof record.details === 'object' && record.details !== null && !Array.isArray(record.details), 'details must be an object');
  if (record.receipt !== null) {
    assert.deepEqual(Object.keys(record.receipt).sort(), [...properties.receipt.required].sort(), 'receipt must contain exactly owner, schema_version, and state');
    assert.equal(typeof record.receipt.owner, 'string');
    assert.equal(record.receipt.schema_version, properties.receipt.properties.schema_version.const);
    assert.equal(typeof record.receipt.state, 'string');
  }
}

test('capability readiness contract and fixture are checksummed and fail closed', () => {
  assert.ok(fs.existsSync(contractPath), `missing readiness contract: ${contractPath}`);
  assert.ok(fs.existsSync(`${contractPath}.sha256`), 'missing readiness contract checksum');
  assert.ok(fs.existsSync(fixturePath), `missing readiness fixture: ${fixturePath}`);

  const contractBytes = fs.readFileSync(contractPath);
  const checksum = fs.readFileSync(`${contractPath}.sha256`, 'utf8').trim().split(/\s+/)[0];
  assert.equal(crypto.createHash('sha256').update(contractBytes).digest('hex'), checksum, 'readiness contract checksum mismatch');

  const schema = readJson(contractPath);
  assert.equal(schema.schema_version, 1);
  assert.equal(schema.contract_version, '0.18.0');
  assert.equal(schema.properties.contract_digest.const, policyDigest, 'v1.1 automatic-tooling policy digest changed');
  assert.deepEqual(schema.properties.status.enum, statuses, 'status enum must remain exact and ordered');

  const fixture = readJson(fixturePath);
  assert.ok(Array.isArray(fixture.records), 'fixture must contain records');
  for (const record of fixture.records) validateRecord(record, schema);
  assert.deepEqual([...new Set(fixture.records.map((record) => record.status))].sort(), [...statuses].sort(), 'fixture must cover every readiness status');

  const invalid = structuredClone(fixture.records[0]);
  invalid.status = 'ready';
  assert.throws(() => validateRecord(invalid, schema), /status must be an exact declared value/);

  invalid.status = fixture.records[0].status;
  invalid.details = [];
  assert.throws(() => validateRecord(invalid, schema), /details must be an object/);
});
