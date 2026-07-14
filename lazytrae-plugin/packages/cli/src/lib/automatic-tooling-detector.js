const { loadContract, redactText } = require('./automatic-tooling-policy');

const CAPABILITY_ALIASES = Object.freeze({
  documentation: 'documentation_search',
  library_documentation: 'documentation_search',
  docs: 'documentation_search',
  repository_search: 'local_search',
  code_search: 'external_code_search',
  architecture: 'architecture_search',
  browser: 'browser_automation',
});

const FALLBACK_CHAINS = Object.freeze({
  documentation_search: ['filesystem_read', 'documentation_search', 'web_search'],
  external_code_search: ['local_search', 'external_code_search', 'web_search'],
  architecture_search: ['architecture_search', 'code_navigation', 'structural_search', 'local_search'],
  code_navigation: ['code_navigation', 'structural_search', 'local_search'],
  structural_search: ['structural_search', 'local_search'],
  local_search: ['local_search'],
  browser_automation: ['browser_automation'],
  filesystem_read: ['filesystem_read', 'local_search'],
  web_search: ['web_search'],
});

const KNOWN_CAPABILITIES = new Set(Object.keys(FALLBACK_CHAINS));
const SECRET_ASSIGNMENT = /\b(?:api[_-]?key|access[_-]?token|credential|password|secret|token)\s*(?:=|:)\s*[^\s,;]+/gi;
const SECRET_WHITESPACE = /\b(?:api[_-]?key|access[_-]?token|credential|password|secret|token)\s+[^\s,;]+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/gi;
const ABSOLUTE_PATH = /(?:^|\s)(?:\/[^\s]+|[A-Za-z]:\\[^\s]+)/g;

function canonicalCapability(value) {
  if (typeof value !== 'string') throw new Error('AUTOMATIC_TOOLING_UNKNOWN_CAPABILITY');
  const capability = CAPABILITY_ALIASES[value] || value;
  const { contract } = loadContract();
  if (!KNOWN_CAPABILITIES.has(capability) || !Object.hasOwn(contract.capabilities, capability)) throw new Error('AUTOMATIC_TOOLING_UNKNOWN_CAPABILITY');
  return capability;
}

function redactQuery(value, environment = process.env) {
  return redactText(String(value), environment)
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(SECRET_ASSIGNMENT, match => `${match.split(/\s*(?:=|:)\s*/, 1)[0]}=[REDACTED]`)
    .replace(SECRET_WHITESPACE, match => `${match.split(/\s+/, 1)[0]} [REDACTED]`)
    .replace(ABSOLUTE_PATH, ' [PATH]')
    .slice(0, 512);
}

function normalizeContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context) || typeof context.question !== 'string' || context.question.trim() === '' || context.question.length > 4000) {
    throw new Error('capability context must contain a bounded question');
  }
  const repository = context.repository && typeof context.repository === 'object' && !Array.isArray(context.repository) ? context.repository : {};
  const count = value => Number.isInteger(value) && value >= 0 && value <= 1000000 ? value : 0;
  return {
    question: redactQuery(context.question).trim(),
    alreadyTriedLocal: context.alreadyTriedLocal === true,
    repository: {
      languages: Array.isArray(repository.languages) ? repository.languages.filter(value => typeof value === 'string').slice(0, 20) : [],
      packages: Array.isArray(repository.packages) ? repository.packages.filter(value => typeof value === 'string').slice(0, 100) : [],
      fileCount: count(repository.fileCount),
      moduleCount: count(repository.moduleCount),
    },
  };
}

function detectNeed(context) {
  const normalized = normalizeContext(context);
  const text = normalized.question.toLowerCase();
  const evidence = { alreadyTriedLocal: normalized.alreadyTriedLocal, languageCount: normalized.repository.languages.length, packageCount: normalized.repository.packages.length, fileCount: normalized.repository.fileCount, moduleCount: normalized.repository.moduleCount };
  if (/\b(browser|ui|user interface|visual|layout|click|form)\b/.test(text)) return { capability: 'browser_automation', reason: 'explicit-browser-or-ui-task', evidence };
  if (/\b(architecture|dependency graph|cross[- ]module)\b/.test(text) || normalized.repository.moduleCount >= 20 || normalized.repository.fileCount >= 400) return { capability: 'architecture_search', reason: 'cross-module-or-large-repository-analysis', evidence };
  if (/\b(github|open[- ]source implementation|public code|how is .+ implemented)\b/.test(text)) return { capability: 'external_code_search', reason: 'external-code-evidence-requested', evidence };
  const versionSpecific = /\b(current|latest|version|v\d+|\d+\.\d+)\b/.test(text) || normalized.repository.packages.some(packageName => /@\d/.test(packageName));
  if (/\b(current|latest|version|v\d+|api|how does|how do|documentation|docs)\b/.test(text)) return { capability: 'documentation_search', reason: versionSpecific ? 'version-specific-documentation-request' : 'documentation-request', evidence };
  return { capability: normalized.alreadyTriedLocal ? 'web_search' : 'local_search', reason: normalized.alreadyTriedLocal ? 'local-evidence-already-exhausted' : 'local-repository-evidence-first', evidence };
}

function normalizeOutcome(capability, response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return { status: 'provider_error', capability };
  const resolved = canonicalCapability(response.capability || capability);
  const status = ['success', 'unavailable', 'denied', 'timeout', 'misconfigured', 'provider_error'].includes(response.status) ? response.status : 'provider_error';
  return { status, capability: resolved, output: typeof response.output === 'string' ? response.output.slice(0, 65536) : '' };
}

async function executeFallback(input, invoke) {
  if (!input || typeof input !== 'object' || typeof invoke !== 'function') throw new Error('capability fallback requires an input and adapter');
  const capability = canonicalCapability(input.capability);
  const query = redactQuery(input.query || '');
  if (query === '') throw new Error('capability query is required');
  const attempts = [];
  for (const next of FALLBACK_CHAINS[capability]) {
    const response = normalizeOutcome(next, await invoke({ capability: next, query, reason: input.reason || 'contract-fallback' }));
    attempts.push({ capability: next, status: response.status });
    if (response.status === 'denied') return { status: 'denied', capability: next };
    if (response.status === 'success') return { status: 'success', capability: next, attempts, output: { trust: 'untrusted', text: response.output } };
  }
  return { status: 'unavailable', capability, attempts };
}

function parseDetectorArgs(args) {
  if (args[0] !== 'detect' || args[1] !== '--context' || args.length !== 3) throw new Error('usage: lazytrae tooling capability detect --context <json>');
  try { return JSON.parse(args[2]); } catch (_) { throw new Error('capability context must be valid JSON'); }
}

function parseFallbackArgs(args) {
  if (args[0] !== 'fallback' || !args[1]) throw new Error('usage: lazytrae tooling capability fallback <capability> --query <text> --outcomes <json>');
  const queryIndex = args.indexOf('--query');
  const outcomesIndex = args.indexOf('--outcomes');
  if (args.length !== 6 || queryIndex < 0 || outcomesIndex < 0 || !args[queryIndex + 1] || !args[outcomesIndex + 1]) throw new Error('usage: lazytrae tooling capability fallback <capability> --query <text> --outcomes <json>');
  try { return { capability: args[1], query: args[queryIndex + 1], outcomes: JSON.parse(args[outcomesIndex + 1]) }; } catch (_) { throw new Error('capability outcomes must be valid JSON'); }
}

function normalizeOutcomes(outcomes) {
  if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) throw new Error('capability outcomes must be an object');
  const normalized = {};
  for (const [alias, value] of Object.entries(outcomes)) {
    const capability = canonicalCapability(alias);
    const status = ['success', 'unavailable', 'denied', 'timeout', 'misconfigured', 'provider_error'].includes(value) ? value : 'provider_error';
    if (normalized[capability] !== 'denied') normalized[capability] = status;
    if (status === 'denied') normalized[capability] = 'denied';
  }
  return normalized;
}

async function runDetector(args) {
  if (args[0] === 'detect') return detectNeed(parseDetectorArgs(args));
  const input = parseFallbackArgs(args);
  const outcomes = normalizeOutcomes(input.outcomes);
  return executeFallback(input, request => ({ status: outcomes[request.capability] || 'unavailable' }));
}

module.exports = { canonicalCapability, detectNeed, executeFallback, redactQuery, runDetector };
