const fs = require('fs');
const path = require('path');
const { writeRepoFile } = require('./templates');
const { managedLocalServer } = require('./local-launcher');

const TOOLING_STATE_PATH = path.join('.lazytrae', 'state', 'tooling.json');
const MANAGED_CODEGRAPH_SERVER = 'lazytrae_codegraph';
const MANAGED_CODEGRAPH_DESCRIPTION = 'Optional receipt-owned CodeGraph MCP bridge. Enable only after you create the project-local .codegraph index.';
const OPTIONAL_CAPABILITIES = {
  context7: {
    serverName: 'lazytrae_context7',
    url: 'https://mcp.context7.com/mcp',
    description: 'Optional Context7 library documentation MCP. Enabled explicitly; credentials stay in the host environment.',
  },
  grep_app: {
    serverName: 'lazytrae_grep_app',
    url: 'https://mcp.grep.app',
    description: 'Experimental optional grep_app public-code MCP. Enabled explicitly; endpoint is unpinned.',
  },
  filesystem: {
    serverName: 'lazytrae_filesystem',
    command: 'npx',
    args: repoRoot => ['-y', '@modelcontextprotocol/server-filesystem@2026.7.10', fs.realpathSync(repoRoot)],
    description: 'Optional project-scoped filesystem MCP. Enabled explicitly; npx runs only when the configured MCP host starts it.',
  },
  playwright: {
    serverName: 'lazytrae_playwright',
    command: 'npx',
    args: () => ['-y', '@playwright/mcp@0.0.78'],
    description: 'Optional Playwright browser MCP. Enabled explicitly; npx runs only when the configured MCP host starts it.',
  },
};
function defaultToolingState() {
  return {
    schema_version: 1,
    capabilities: {},
  };
}

function toolingStatePath(repoRoot) {
  return path.join(repoRoot, TOOLING_STATE_PATH);
}

function readToolingState(repoRoot) {
  const target = toolingStatePath(repoRoot);
  if (!fs.existsSync(target)) return defaultToolingState();
  const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.capabilities || typeof parsed.capabilities !== 'object' || Array.isArray(parsed.capabilities)) {
    throw new Error('tooling state must contain an object capabilities map');
  }
  return parsed;
}

function ensureToolingState(repoRoot) {
  const target = toolingStatePath(repoRoot);
  if (fs.existsSync(target)) return false;
  writeRepoFile(repoRoot, target, JSON.stringify(defaultToolingState(), null, 2) + '\n');
  return true;
}

function setCodeGraphCapability(repoRoot, capability) {
  const state = readToolingState(repoRoot);
  state.capabilities.codegraph = capability;
  writeRepoFile(repoRoot, toolingStatePath(repoRoot), JSON.stringify(state, null, 2) + '\n');
}

function setOptionalCapability(repoRoot, name, enabled) {
  if (!Object.hasOwn(OPTIONAL_CAPABILITIES, name)) throw new Error(`unknown optional capability: ${name}`);
  const state = readToolingState(repoRoot);
  state.capabilities[name] = { enabled, state: enabled ? 'ready' : 'disabled' };
  writeRepoFile(repoRoot, toolingStatePath(repoRoot), JSON.stringify(state, null, 2) + '\n');
}

function optionalServer(repoRoot, capability) {
  if (capability.url) {
    return { url: capability.url, required: false, description: capability.description };
  }
  return {
    command: capability.command,
    args: capability.args(repoRoot),
    required: false,
    description: capability.description,
  };
}

function managedOptionalServers(repoRoot) {
  const capabilities = readToolingState(repoRoot).capabilities;
  return Object.fromEntries(Object.entries(OPTIONAL_CAPABILITIES).flatMap(([name, capability]) => {
    if (capabilities[name]?.enabled !== true) return [];
    return [[capability.serverName, optionalServer(repoRoot, capability)]];
  }));
}

function managedCodeGraphServer(repoRoot) {
  const capability = readToolingState(repoRoot).capabilities.codegraph;
  if (!capability || capability.enabled !== true || typeof capability.tooling_root !== 'string') return null;
  return managedLocalServer({
    repoRoot,
    args: ['codegraph', '--target', fs.realpathSync(repoRoot), '--tooling-root', capability.tooling_root],
    required: false,
    description: MANAGED_CODEGRAPH_DESCRIPTION,
    kind: 'codegraph',
  });
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isManagedOptionalServer(repoRoot, name, server) {
  return Object.values(OPTIONAL_CAPABILITIES).some(capability =>
    name === capability.serverName && sameJson(server, optionalServer(repoRoot, capability)));
}

module.exports = {
  TOOLING_STATE_PATH,
  defaultToolingState,
  ensureToolingState,
  MANAGED_CODEGRAPH_SERVER,
  MANAGED_CODEGRAPH_DESCRIPTION,
  OPTIONAL_CAPABILITIES,
  isManagedOptionalServer,
  managedCodeGraphServer,
  managedOptionalServers,
  readToolingState,
  setCodeGraphCapability,
  setOptionalCapability,
  toolingStatePath,
};
