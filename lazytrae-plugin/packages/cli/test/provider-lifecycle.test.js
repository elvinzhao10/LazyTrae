const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const { providerMatrix, runProviderRequest } = require('../src/lib/provider-lifecycle');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-provider-'));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

test('provider matrix discovers environment names only and never creates configuration', () => {
  // Given: an absent configuration directory and a credential-like environment value.
  const root = fixture();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-provider-home-'));
  const environment = { HOME: home, XDG_CONFIG_HOME: path.join(home, 'config'), CONTEXT7_API_KEY: 'SENTINEL_NEVER_PRINT_7f59' };
  try {
    // When: noninteractive provider status is requested.
    const matrix = providerMatrix({ environment, workspace: root });

    // Then: only the variable name is visible and no user configuration was created.
    assert.equal(JSON.stringify(matrix).includes('SENTINEL_NEVER_PRINT_7f59'), false);
    assert.equal(matrix.find(item => item.id === 'context7').credential, 'env:CONTEXT7_API_KEY');
    assert.equal(fs.existsSync(path.join(environment.XDG_CONFIG_HOME, 'lazyseries', 'config.yaml')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
});

test('provider request redacts egress, blocks metered automatic work, and returns untrusted output', async () => {
  // Given: a clean workspace and a configured metered web provider.
  const root = fixture();
  try {
    const config = { selection: { web_search: 'web' }, priority: [], endpoints: { web: 'https://search.example.test' }, credential_refs: {} };
    let invoked = false;

    // When: automatic metered work is requested without an explicit bounded budget.
    const blocked = await runProviderRequest({ workspace: root, capability: 'web_search', query: 'token=SENTINEL_NEVER_PRINT_7f59 /private/path', config, environment: { SECRET: 'SENTINEL_NEVER_PRINT_7f59' }, invoke: async () => { invoked = true; } });

    // Then: the provider was not called.
    assert.deepEqual(blocked, { status: 'unavailable', code: 'AUTOMATIC_TOOLING_METERED_PROVIDER_DENIED', provider: 'web' });
    assert.equal(invoked, false);
    const allowed = await runProviderRequest({ workspace: root, capability: 'documentation_search', query: 'React 19 token=SENTINEL_NEVER_PRINT_7f59', config, environment: { SECRET: 'SENTINEL_NEVER_PRINT_7f59' }, approval: { kind: 'allowed' }, invoke: async request => ({ text: `answer for ${request.query}` }) });
    assert.equal(allowed.status, 'success');
    assert.equal(allowed.output.trust, 'untrusted');
    assert.equal(JSON.stringify(allowed).includes('SENTINEL_NEVER_PRINT_7f59'), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('provider request denies browser forms and times out temporary adapters without a fallback', async () => {
  // Given: a browser request and a temporary adapter that never completes.
  const root = fixture();
  try {
    // When: a form action is attempted, then anonymous inspection is approved but times out.
    const denied = await runProviderRequest({ workspace: root, capability: 'browser_automation', query: 'https://example.test', action: 'form', config: { selection: {}, priority: [], endpoints: {}, credential_refs: {} }, invoke: async () => ({ text: 'bad' }) });
    const timedOut = await runProviderRequest({ workspace: root, capability: 'browser_automation', query: 'https://example.test', config: { selection: {}, priority: [], endpoints: {}, credential_refs: {} }, approval: { kind: 'allowed' }, timeout: 5, invoke: () => new Promise(() => {}) });

    // Then: both outcomes are typed and neither attempts another provider.
    assert.deepEqual(denied, { status: 'denied', code: 'AUTOMATIC_TOOLING_PERMISSION_DENIED', provider: 'playwright' });
    assert.deepEqual(timedOut, { status: 'timeout', code: 'AUTOMATIC_TOOLING_TIMEOUT', provider: 'playwright' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('provider lifecycle redacts bearer secrets and aborts an adapter child on timeout', async () => {
  // Given: a provider adapter that records egress and starts a child process.
  const root = fixture();
  let egress;
  let child;
  let childExit;
  try {
    // When: bearer-bearing input is sent and a second adapter times out.
    const redacted = await runProviderRequest({ workspace: root, capability: 'documentation_search', query: 'Authorization: Bearer arbitrary-token .env token=also-secret', config: { selection: {}, priority: [], endpoints: {}, credential_refs: {} }, approval: { kind: 'allowed' }, invoke: async request => { egress = request.query; return { text: 'Bearer response-token token=response-secret .env' }; } });
    const timedOut = await runProviderRequest({ workspace: root, capability: 'documentation_search', query: 'React', config: { selection: {}, priority: [], endpoints: {}, credential_refs: {} }, approval: { kind: 'allowed' }, timeout: 20, invoke: (_request, control) => new Promise(() => { child = spawn('sleep', ['60'], { detached: true }); childExit = new Promise(resolve => child.once('close', resolve)); control.signal.addEventListener('abort', () => process.kill(-child.pid, 'SIGKILL')); }) });

    // Then: both egress and untrusted output redact secret forms, and timeout reaps the child.
    assert.match(egress, /\[REDACTED\]/);
    assert.doesNotMatch(egress, /arbitrary-token|also-secret|\.env/);
    assert.doesNotMatch(redacted.output.text, /response-token|response-secret|\.env/);
    assert.deepEqual(timedOut, { status: 'timeout', code: 'AUTOMATIC_TOOLING_TIMEOUT', provider: 'context7' });
    await childExit;
    assert.throws(() => process.kill(child.pid, 0), /ESRCH/);
  } finally { if (child) { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) {} } fs.rmSync(root, { recursive: true, force: true }); }
});

test('provider lifecycle treats bad provider configuration as misconfigured and never lets general approval bypass browser actions', async () => {
  // Given: an invalid selected provider and an otherwise approved browser action.
  const root = fixture();
  try {
    // When: each request is evaluated.
    const bad = await runProviderRequest({ workspace: root, capability: 'documentation_search', query: 'React', config: { selection: { documentation_search: 'not-a-provider' }, priority: [], endpoints: {}, credential_refs: {} }, approval: { kind: 'allowed' }, invoke: async () => ({ text: 'never' }) });
    const browser = await runProviderRequest({ workspace: root, capability: 'browser_automation', query: 'https://example.test', action: 'auth', config: { selection: {}, priority: [], endpoints: {}, credential_refs: {} }, approval: { kind: 'allowed' }, invoke: async () => ({ text: 'never' }) });

    // Then: both fail closed with their distinct typed outcomes.
    assert.deepEqual(bad, { status: 'misconfigured', code: 'AUTOMATIC_TOOLING_UNKNOWN_PROVIDER', provider: null });
    assert.deepEqual(browser, { status: 'denied', code: 'AUTOMATIC_TOOLING_PERMISSION_DENIED', provider: 'playwright' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
