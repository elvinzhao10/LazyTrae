const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

test('setup and providers are noninteractive, redacted, and configure only on explicit request', () => {
  // Given: a temporary user home with an environment credential.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-providers-cli-'));
  const environment = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, 'config'), CONTEXT7_API_KEY: 'SENTINEL_NEVER_PRINT_7f59' };
  try {
    // When: the real CLI setup, status, test, and explicit configure surfaces run.
    const setup = runCli(['setup', '--non-interactive', '--json'], { env: environment });
    const status = runCli(['providers', '--json'], { env: environment });
    const checked = runCli(['providers', 'test', '--json'], { env: environment });
    const configured = runCli(['providers', 'configure', '--provider', 'context7', '--credential-ref', 'env:CONTEXT7_API_KEY', '--json'], { env: environment });

    // Then: status never leaks the credential, while configure creates the private config.
    for (const result of [setup, status, checked, configured]) {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(`${result.stdout}${result.stderr}`.includes('SENTINEL_NEVER_PRINT_7f59'), false);
    }
    assert.equal(fs.existsSync(path.join(home, 'config', 'lazyseries', 'config.yaml')), true);
    assert.equal(fs.statSync(path.join(home, 'config', 'lazyseries', 'config.yaml')).mode & 0o777, 0o600);
    assert.equal(JSON.parse(status.stdout).providers.find(provider => provider.id === 'context7').credential, 'env:CONTEXT7_API_KEY');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('providers configure rejects an unknown contract provider without changing existing configuration', () => {
  // Given: an existing private provider configuration with a stable content digest.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-providers-cli-'));
  const environment = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, 'config') };
  const configPath = path.join(home, 'config', 'lazyseries', 'config.yaml');
  try {
    const valid = runCli(['providers', 'configure', '--provider', 'context7', '--credential-ref', 'env:CONTEXT7_API_KEY', '--json'], { env: environment });
    const before = fs.readFileSync(configPath, 'utf8');
    const beforeDigest = crypto.createHash('sha256').update(before).digest('hex');

    // When: an explicit configure request names a provider absent from the verified contract.
    const unknown = runCli(['providers', 'configure', '--provider', 'typo_provider', '--credential-ref', 'env:TEST', '--json'], { env: environment });

    // Then: the CLI returns its typed contract error and makes no configuration change.
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /AUTOMATIC_TOOLING_UNKNOWN_PROVIDER/);
    const after = fs.readFileSync(configPath, 'utf8');
    assert.equal(after, before);
    assert.equal(crypto.createHash('sha256').update(after).digest('hex'), beforeDigest);
    assert.equal(after.includes('typo_provider'), false);
    assert.equal(`${unknown.stdout}${unknown.stderr}`.includes('env:TEST'), false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
