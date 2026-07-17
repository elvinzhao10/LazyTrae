const fs = require('fs');
const path = require('path');
const { loadContract, readConfig, redactText, resolveApproval, resolveCapability } = require('./automatic-tooling-policy');

const METERED = new Set(['web']);
const ALWAYS_ASK_ACTIONS = new Set(['auth', 'form', 'upload', 'download', 'publish', 'external-write', 'purchase', 'destructive', 'secret-read']);
const ENVIRONMENT_CREDENTIALS = { context7: ['CONTEXT7_API_KEY', 'CONTEXT7_TOKEN'], web: ['WEB_API_KEY', 'BRAVE_API_KEY'], grep_app: ['GITHUB_TOKEN', 'GREP_APP_TOKEN'] };

function configuredCredential(provider, config, environment) {
  const reference = config.credential_refs[provider];
  if (typeof reference === 'string') return reference;
  const name = (ENVIRONMENT_CREDENTIALS[provider] || []).find(candidate => Object.hasOwn(environment, candidate));
  return name ? `env:${name}` : null;
}

function providerMatrix(options = {}) {
  const environment = options.environment || process.env;
  const config = options.config || readConfig({ environment });
  const { contract } = loadContract();
  return Object.entries(contract.providers).map(([id, provider]) => ({
    id,
    kind: provider.kind,
    selfHosted: Boolean(config.endpoints[id] && !/context7\.com|grep\.app/.test(config.endpoints[id])),
    pricing: METERED.has(id) ? 'metered' : 'free-or-host-governed',
    apiKey: configuredCredential(id, config, environment) !== null,
    credential: configuredCredential(id, config, environment),
    readOnly: id !== 'playwright',
    reachability: 'not-tested',
  }));
}

function sanitizeQuery(value, environment) {
  let query = redactText(String(value || ''), environment);
  query = query.replace(/(?:authorization\s*:\s*)?bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
  query = query.replace(/\b(token|secret|api[_-]?key|password)\s*[:=]\s*[^\s&,;]+/gi, '$1=[REDACTED]');
  query = query.replace(/(?:^|[\s/])\.env\b/g, ' [SENSITIVE_PATH]');
  query = query.replace(/(?:^|\s)\/?(?:Users|home|private|var)\/[^\s]*/g, ' [PATH]');
  return query.slice(0, 512).trim();
}

function denied(provider) {
  return { status: 'denied', code: 'AUTOMATIC_TOOLING_PERMISSION_DENIED', provider };
}

function approvalFor(input, resolution) {
  if (ALWAYS_ASK_ACTIONS.has(input.action)) return { kind: 'prompt-required' };
  if (input.approval) return input.approval;
  return resolveApproval({ workspace: input.workspace, ...resolution }, { mode: input.mode || 'automatic', environment: input.environment });
}

function withinWorkspace(workspace, candidate) {
  const root = fs.realpathSync(workspace);
  const target = fs.realpathSync(candidate);
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function withTimeout(invoke, request, timeout) {
  return new Promise(resolve => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); resolve({ timeout: true }); }, timeout);
    Promise.resolve(invoke(request, { signal: controller.signal })).then(value => { clearTimeout(timer); resolve({ value }); }, () => { clearTimeout(timer); resolve({ error: true }); });
  });
}

async function runProviderRequest(input) {
  const environment = input.environment || process.env;
  const config = input.config || readConfig({ environment });
  let resolution;
  try { resolution = resolveCapability(input.capability, { config, environment, toolpackPath: input.toolpackPath }); } catch (error) {
    const status = error.message === 'AUTOMATIC_TOOLING_UNKNOWN_PROVIDER' ? 'misconfigured' : 'unavailable';
    return { status, code: error.message, provider: null };
  }
  const provider = resolution.provider;
  if (input.capability === 'filesystem_read' && (!input.path || !withinWorkspace(input.workspace, input.path))) return denied(provider);
  if (METERED.has(provider) && !(input.automaticSpend === true && Number.isFinite(input.budget) && input.budget > 0)) return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_METERED_PROVIDER_DENIED', provider };
  if (approvalFor({ ...input, environment }, resolution).kind !== 'allowed') return denied(provider);
  const query = sanitizeQuery(input.query, environment);
  if (query === '') return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE', provider };
  const result = await withTimeout(input.invoke, { capability: input.capability, provider, query, endpoint: config.endpoints[provider] || null, readOnly: input.capability !== 'browser_automation' }, input.timeout || 30000);
  if (result.timeout) return { status: 'timeout', code: 'AUTOMATIC_TOOLING_TIMEOUT', provider };
  if (result.error || !result.value || typeof result.value.text !== 'string') return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE', provider };
  return { status: 'success', provider, output: { trust: 'untrusted', text: sanitizeQuery(result.value.text, environment) } };
}

module.exports = { providerMatrix, runProviderRequest, sanitizeQuery, withinWorkspace };
