const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  approvalKey,
  chooseCredentialReference,
  encryptCredential,
  defaultConfigPath,
  defaultToolpackPath,
  decryptCredential,
  loadConfig,
  readLedger,
  readVersionedDataKey,
  redactText,
  resolveApproval,
  resolveCapability,
  saveConfig,
  writeApproval,
} = require('../src/lib/automatic-tooling-policy');

function temporaryHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazyseries-policy-'));
  return { root, environment: { HOME: root, XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(root, 'data') } };
}

test('automatic tooling policy creates a private user config that only accepts opaque credential references', () => {
  const fixture = temporaryHome();
  try {
    // Given: an empty XDG configuration directory.
    const configPath = defaultConfigPath(fixture.environment);

    // When: the policy loads its user configuration.
    const config = loadConfig({ environment: fixture.environment });

    // Then: the default is private and raw credential values are rejected on save.
    assert.equal(configPath, path.join(fixture.environment.XDG_CONFIG_HOME, 'lazyseries', 'config.yaml'));
    assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
    assert.deepEqual(config.credential_refs, {});
    assert.throws(() => saveConfig({ credential_refs: { context7: 'raw-secret-value' } }, { environment: fixture.environment }), /opaque credential reference/);
    assert.throws(() => saveConfig({ endpoints: { context7: 'https://token@example.test/mcp' } }, { environment: fixture.environment }), /endpoint/);
    fs.writeFileSync(configPath, 'not: [valid');
    assert.throws(() => loadConfig({ environment: fixture.environment }), /valid JSON-compatible YAML/);
    const outside = path.join(fixture.root, 'outside');
    fs.mkdirSync(outside);
    fs.rmSync(fixture.environment.XDG_CONFIG_HOME, { recursive: true, force: true });
    fs.symlinkSync(outside, fixture.environment.XDG_CONFIG_HOME);
    assert.throws(() => loadConfig({ environment: fixture.environment }), /symlink/);
    fs.mkdirSync(path.join(outside, 'lazyseries'));
    fs.writeFileSync(path.join(outside, 'lazyseries', 'config.yaml'), '{}');
    assert.throws(() => loadConfig({ environment: fixture.environment }), /symlink/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('automatic tooling policy resolves only contract providers and deterministic private toolpack overrides', () => {
  const fixture = temporaryHome();
  try {
    // Given: a private toolpack selecting one contract provider.
    const toolpack = path.join(fixture.root, 'toolpack');
    fs.mkdirSync(toolpack, { recursive: true, mode: 0o700 });
    const receipt = path.join(toolpack, 'toolpack.json');
    fs.writeFileSync(receipt, JSON.stringify({ selection: { structural_search: 'ast_grep' } }), { mode: 0o600 });
    fs.chmodSync(receipt, 0o600);

    // When: structural search is resolved from the user toolpack.
    const resolution = resolveCapability('structural_search', { toolpackPath: toolpack });

    // Then: the contract provider wins deterministically and the default is private too.
    assert.equal(resolution.provider, 'ast_grep');
    assert.deepEqual(resolution.fallbacks, ['local_search']);
    assert.equal(defaultToolpackPath(fixture.environment), path.join(fixture.environment.XDG_DATA_HOME, 'lazyseries', 'toolpack'));
    fs.writeFileSync(path.join(toolpack, 'toolpack.json'), JSON.stringify({ selection: { structural_search: 'unknown' } }));
    assert.throws(() => resolveCapability('structural_search', { toolpackPath: toolpack }), /AUTOMATIC_TOOLING_UNKNOWN_PROVIDER/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('automatic tooling policy encrypts credentials with a versioned key without leaking a sentinel', () => {
  // Given: an approved secret read and a deterministic 256-bit Keychain-provided data key.
  const sentinel = 'SENTINEL_NEVER_PRINT_7f59';
  const dataKey = Buffer.alloc(32, 7);

  // When: an encrypted user credential record is created.
  const record = encryptCredential({ credential: sentinel, dataKey, keyId: 'keychain:lazyseries.v2', approval: { kind: 'allowed' } });

  // Then: ciphertext carries the key version but never the raw sentinel.
  assert.equal(record.key_id, 'keychain:lazyseries.v2');
  assert.equal(JSON.stringify(record).includes(sentinel), false);
  assert.equal(decryptCredential({ record, dataKey, approval: { kind: 'allowed' } }), sentinel);
  assert.deepEqual(readVersionedDataKey({ reference: 'keychain:lazyseries.v2', approval: { kind: 'allowed' }, keychainRead: () => dataKey.toString('base64') }), dataKey);
  assert.throws(() => encryptCredential({ credential: sentinel, dataKey, keyId: 'keychain:lazyseries.v2', approval: { kind: 'prompt-required' } }), /approval/);
});

test('automatic tooling policy chooses credential references by keychain then environment then encrypted config', () => {
  // Given: all three opaque reference types for a provider.
  const references = { keychain: 'keychain:lazyseries.context7', environment: 'env:CONTEXT7_TOKEN', encrypted: 'encrypted:context7.v2' };

  // When: the credential policy picks the first available reference.
  const chosen = chooseCredentialReference(references, { hasKeychain: true, environment: { CONTEXT7_TOKEN: 'SENTINEL_NEVER_PRINT_7f59' }, hasEncrypted: true });
  const fallback = chooseCredentialReference(references, { hasKeychain: false, environment: { CONTEXT7_TOKEN: 'SENTINEL_NEVER_PRINT_7f59' }, hasEncrypted: true });

  // Then: precedence is deterministic and only the environment variable name is exposed.
  assert.deepEqual(chosen, { kind: 'keychain', reference: 'keychain:lazyseries.context7' });
  assert.deepEqual(fallback, { kind: 'environment', reference: 'env:CONTEXT7_TOKEN', name: 'CONTEXT7_TOKEN' });
});

test('automatic tooling policy binds approvals to workspace provider capability and contract digest', () => {
  const fixture = temporaryHome();
  try {
    // Given: an approval recorded for one canonical workspace and contract digest.
    const workspace = path.join(fixture.root, 'workspace');
    fs.mkdirSync(workspace);
    const key = approvalKey({ workspace, capability: 'browser_automation', provider: 'playwright' });
    writeApproval({ key, decision: 'workspace' }, { environment: fixture.environment });

    // When: the matching operation is evaluated, then the digest changes.
    const allowed = resolveApproval({ workspace, capability: 'browser_automation', provider: 'playwright' }, { environment: fixture.environment });
    const stale = resolveApproval({ workspace, capability: 'browser_automation', provider: 'playwright', contractDigest: '0'.repeat(64) }, { environment: fixture.environment });

    // Then: only the exact binding is reusable; browser actions always require a prompt first.
    assert.equal(allowed.kind, 'prompt-required');
    assert.equal(stale.kind, 'prompt-required');
    assert.notEqual(key, approvalKey({ workspace, capability: 'browser_automation', provider: 'playwright', contractDigest: '0'.repeat(64) }));
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('automatic tooling policy consumes once decisions and honors deny and revoke', () => {
  const fixture = temporaryHome();
  try {
    // Given: a local request with an ask-once approval ledger entry.
    const workspace = path.join(fixture.root, 'workspace');
    fs.mkdirSync(workspace);
    const request = { workspace, capability: 'local_search', provider: 'ripgrep' };
    const key = approvalKey(request);
    writeApproval({ key, decision: 'once' }, { environment: fixture.environment });

    // When: the request is evaluated twice, then denied and revoked.
    const once = resolveApproval(request, { environment: fixture.environment });
    const missing = resolveApproval(request, { environment: fixture.environment });
    writeApproval({ key, decision: 'deny' }, { environment: fixture.environment });
    const denied = resolveApproval(request, { environment: fixture.environment });
    writeApproval({ key, decision: 'revoke' }, { environment: fixture.environment });

    // Then: all transitions are deterministic.
    assert.equal(once.kind, 'allowed');
    assert.equal(missing.kind, 'prompt-required');
    assert.equal(denied.kind, 'denied');
    assert.equal(resolveApproval(request, { environment: fixture.environment }).kind, 'prompt-required');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('automatic tooling policy redacts sentinel environment values without inspecting environment names as values', () => {
  // Given: a sentinel present only in an environment variable.
  const sentinel = 'SENTINEL_NEVER_PRINT_7f59';
  const environment = { LAZYSERIES_TEST_SECRET: sentinel };

  // When: text is prepared for diagnostics.
  const redacted = redactText(`token=${sentinel}`, environment);

  // Then: the raw sentinel is absent and the environment key remains discoverable by name.
  assert.equal(redacted.includes(sentinel), false);
  assert.equal(redacted, 'token=[REDACTED]');
  assert.equal(Object.hasOwn(environment, 'LAZYSERIES_TEST_SECRET'), true);
});

test('automatic tooling policy rejects permissive existing config and approval files', () => {
  const fixture = temporaryHome();
  try {
    const configPath = defaultConfigPath(fixture.environment);
    loadConfig({ environment: fixture.environment });
    fs.chmodSync(configPath, 0o644);
    assert.throws(() => loadConfig({ environment: fixture.environment }), /private policy file/);

    const workspace = path.join(fixture.root, 'workspace');
    fs.mkdirSync(workspace);
    writeApproval({ key: approvalKey({ workspace, capability: 'local_search', provider: 'ripgrep' }), decision: 'workspace' }, { environment: fixture.environment });
    const approvalPath = path.join(fixture.environment.XDG_CONFIG_HOME, 'lazyseries', 'approvals.json');
    fs.chmodSync(approvalPath, 0o644);
    assert.throws(() => readLedger({ environment: fixture.environment }), /private policy file/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('automatic tooling policy rejects unowned or writable toolpack overrides', () => {
  const fixture = temporaryHome();
  try {
    const toolpack = path.join(fixture.root, 'toolpack');
    fs.mkdirSync(toolpack, { mode: 0o777 });
    const receipt = path.join(toolpack, 'toolpack.json');
    fs.writeFileSync(receipt, JSON.stringify({ selection: { structural_search: 'ast_grep' } }), { mode: 0o666 });
    fs.chmodSync(toolpack, 0o777);
    fs.chmodSync(receipt, 0o666);
    assert.throws(() => resolveCapability('structural_search', { toolpackPath: toolpack }), /private toolpack/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('automatic mode requires a clean inspected Git workspace', () => {
  const fixture = temporaryHome();
  try {
    const workspace = path.join(fixture.root, 'workspace');
    fs.mkdirSync(workspace);
    require('node:child_process').spawnSync('git', ['init'], { cwd: workspace });
    const request = { workspace, capability: 'local_search', provider: 'ripgrep' };
    assert.equal(resolveApproval(request, { environment: fixture.environment, mode: 'automatic' }).kind, 'allowed');
    fs.writeFileSync(path.join(workspace, 'dirty.txt'), 'dirty\n');
    assert.deepEqual(resolveApproval(request, { environment: fixture.environment, mode: 'automatic' }), { kind: 'prompt-required', reason: 'workspace-not-clean' });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
