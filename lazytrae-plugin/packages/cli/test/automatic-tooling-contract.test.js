const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const contractPath = path.join(__dirname, '..', 'contracts', 'automatic-tooling-contract.v1.json');
const digestPath = `${contractPath}.sha256`;
const canonicalCapabilities = [
  'local_search',
  'structural_search',
  'code_navigation',
  'architecture_search',
  'documentation_search',
  'web_search',
  'external_code_search',
  'browser_automation',
  'filesystem_read',
];
const canonicalProviders = [
  'ripgrep',
  'ast_grep',
  'lsp',
  'codegraph',
  'context7',
  'web',
  'grep_app',
  'playwright',
  'filesystem',
];

function assertAutomaticProvisioning(contract) {
  assert.deepEqual(contract.automatic_provisioning?.local_foundation, {
    providers: ['ripgrep', 'ast_grep', 'lsp'],
    install_and_use: 'allowed_without_interruption',
    destination: 'private_receipt_owned_lazyseries_toolpack',
    lsp: 'matching_workspace_language_only',
    download: 'version_pinned_normal_size_only',
    forbid_writes: ['target_repository_dependencies', 'target_repository_lockfiles', 'host_configuration'],
  }, 'local foundation automatic provisioning must remain narrowly allowed');
  assert.deepEqual(contract.automatic_provisioning.ask_once, {
    providers: ['codegraph', 'playwright'],
    conditions: ['unusual_large_tooling_or_models', 'outside_root_access'],
  }, 'large, architecture, browser, and outside-root work must remain ask-once');
  assert.deepEqual(contract.automatic_provisioning.remote, {
    costs: 'ask_once',
    credentials_or_auth: 'ask_once',
    writes: 'ask_once',
    egress: 'explicit_provider_selection',
  }, 'remote sensitive operations must remain approved');
}

function readContract(snapshotPath, checksumPath) {
  assert.ok(fs.existsSync(snapshotPath), `missing contract snapshot: ${snapshotPath}`);
  assert.ok(fs.existsSync(checksumPath), `missing contract checksum: ${checksumPath}`);
  const bytes = fs.readFileSync(snapshotPath);
  const expectedChecksum = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  assert.match(expectedChecksum, /^[a-f0-9]{64}$/i, 'checksum must be a SHA-256 hex digest');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expectedChecksum, 'contract checksum mismatch');

  let contract;
  try {
    contract = JSON.parse(bytes);
  } catch (error) {
    assert.fail(`malformed contract JSON: ${error.message}`);
  }
  assert.equal(contract.schema, 'lazy-series.automatic-tooling.contract');
  assert.equal(contract.schema_version, 1, 'unknown schema versions are rejected');
  assert.equal(contract.contract_version, '1.1.0');
  assert.deepEqual(Object.keys(contract.providers).sort(), [...canonicalProviders].sort(), 'unknown providers are rejected');
  assert.deepEqual(Object.keys(contract.capabilities).sort(), [...canonicalCapabilities].sort(), 'unknown capabilities are rejected');
  for (const [capability, definition] of Object.entries(contract.capabilities)) {
    assert.equal(definition.id, capability);
    assert.ok(Array.isArray(definition.providers) && definition.providers.length > 0, `${capability} needs a provider`);
    assert.ok(Array.isArray(definition.fallbacks), `${capability} needs explicit fallbacks`);
    for (const provider of definition.providers) {
      assert.ok(Object.hasOwn(contract.providers, provider), `unknown provider ${provider} for ${capability}`);
    }
    for (const fallback of definition.fallbacks) {
      assert.ok(Object.hasOwn(contract.capabilities, fallback), `unknown fallback ${fallback} for ${capability}`);
    }
  }
  for (const field of ['permissions', 'provenance', 'automatic_provisioning', 'operating_bounds', 'timeouts', 'error_types', 'cost_egress_data_policy']) {
    assert.ok(contract[field] && typeof contract[field] === 'object', `missing ${field}`);
  }
  assertAutomaticProvisioning(contract);
  return contract;
}

function copyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-automatic-tooling-contract-'));
  const snapshot = path.join(root, 'automatic-tooling-contract.v1.json');
  const checksum = `${snapshot}.sha256`;
  return { root, snapshot, checksum };
}

test('automatic tooling contract is versioned, checksummed, and fails closed', () => {
  const fixture = copyFixture();
  try {
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /missing contract snapshot/);

    fs.copyFileSync(contractPath, fixture.snapshot);
    fs.copyFileSync(digestPath, fixture.checksum);
    const contract = readContract(fixture.snapshot, fixture.checksum);
    assert.deepEqual(Object.keys(contract.capabilities).sort(), [...canonicalCapabilities].sort());

    const malformed = JSON.parse(fs.readFileSync(fixture.snapshot, 'utf8'));
    malformed.schema_version = 999;
    fs.writeFileSync(fixture.snapshot, JSON.stringify(malformed));
    fs.writeFileSync(fixture.checksum, `${crypto.createHash('sha256').update(fs.readFileSync(fixture.snapshot)).digest('hex')}\n`);
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /unknown schema versions/);

    malformed.schema_version = 1;
    malformed.providers.unknown_provider = { kind: 'local_binary', commands: ['unknown'], network: 'none' };
    fs.writeFileSync(fixture.snapshot, JSON.stringify(malformed));
    fs.writeFileSync(fixture.checksum, `${crypto.createHash('sha256').update(fs.readFileSync(fixture.snapshot)).digest('hex')}\n`);
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /unknown providers/);

    delete malformed.providers.unknown_provider;
    malformed.capabilities.local_search.providers = ['unknown_provider'];
    fs.writeFileSync(fixture.snapshot, JSON.stringify(malformed));
    fs.writeFileSync(fixture.checksum, `${crypto.createHash('sha256').update(fs.readFileSync(fixture.snapshot)).digest('hex')}\n`);
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /unknown provider/);

    malformed.capabilities.local_search.providers = ['ripgrep'];
    malformed.capabilities.unknown_capability = { id: 'unknown_capability', providers: ['ripgrep'], fallbacks: [] };
    fs.writeFileSync(fixture.snapshot, JSON.stringify(malformed));
    fs.writeFileSync(fixture.checksum, `${crypto.createHash('sha256').update(fs.readFileSync(fixture.snapshot)).digest('hex')}\n`);
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /unknown capabilities/);

    delete malformed.capabilities.unknown_capability;
    malformed.capabilities.local_search.fallbacks = ['unknown_capability'];
    fs.writeFileSync(fixture.snapshot, JSON.stringify(malformed));
    fs.writeFileSync(fixture.checksum, `${crypto.createHash('sha256').update(fs.readFileSync(fixture.snapshot)).digest('hex')}\n`);
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /unknown fallback/);

    const priorPolicy = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    priorPolicy.automatic_provisioning.local_foundation.install_and_use = 'ask_once';
    fs.writeFileSync(fixture.snapshot, JSON.stringify(priorPolicy));
    fs.writeFileSync(fixture.checksum, `${crypto.createHash('sha256').update(fs.readFileSync(fixture.snapshot)).digest('hex')}\n`);
    assert.throws(() => readContract(fixture.snapshot, fixture.checksum), /local foundation automatic provisioning/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
