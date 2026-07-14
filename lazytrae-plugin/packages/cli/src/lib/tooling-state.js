const fs = require('fs');
const path = require('path');
const { writeRepoFile } = require('./templates');
const { readExistingFile } = require('./safe-write');

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
const LEGACY_REMOTE_SERVERS = {
  context7: { url: 'https://mcp.context7.com/mcp', required: false, description: 'Documentation lookup for open-source libraries' },
  context7_docs: { url: 'https://mcp.context7.com/mcp', required: false, description: 'Documentation search MCP server — optional template (alias for context7)' },
  grep_app: { url: 'https://mcp.grep.app', required: false, description: 'Remote code search from grep.app' },
};
const LEGACY_LOCAL_SERVERS = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem@2026.7.10', '.'],
    required: false,
    description: 'Filesystem access MCP server — optional template pinned to a reviewed version',
  },
  playwright: {
    command: 'npx',
    args: ['-y', '@playwright/mcp@0.0.78'],
    required: false,
    description: 'Browser automation MCP server via Playwright — optional template pinned to a reviewed version',
  },
};
const LEGACY_CODEGRAPH_PLACEHOLDER = {
  required: false,
  disabled: true,
  description: 'Optional CodeGraph analysis. LazyTrae keeps its 15 built-in heuristic context tools available until an explicit receipt-owned CodeGraph installation and caller-created .codegraph index are enabled.',
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
  return {
    command: 'lazytrae',
    args: ['codegraph', '--target', repoRoot, '--tooling-root', capability.tooling_root],
    required: false,
    description: MANAGED_CODEGRAPH_DESCRIPTION,
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isManagedCodeGraphServer(name, server) {
  return name === MANAGED_CODEGRAPH_SERVER
    && server
    && server.command === 'lazytrae'
    && Array.isArray(server.args)
    && server.args[0] === 'codegraph'
    && server.args[1] === '--target'
    && typeof server.args[2] === 'string'
    && server.args[3] === '--tooling-root'
    && typeof server.args[4] === 'string'
    && server.required === false
    && server.description === MANAGED_CODEGRAPH_DESCRIPTION;
}

function isLegacyManagedCodeGraphServer(name, server) {
  return name === 'codegraph'
    && server
    && server.command === 'lazytrae'
    && Array.isArray(server.args)
    && server.args[0] === 'codegraph'
    && server.args[1] === '--target'
    && typeof server.args[2] === 'string'
    && server.args[3] === '--tooling-root'
    && typeof server.args[4] === 'string'
    && server.required === false
    && server.description === MANAGED_CODEGRAPH_DESCRIPTION;
}

function isManagedOptionalServer(repoRoot, name, server) {
  return Object.values(OPTIONAL_CAPABILITIES).some(capability =>
    name === capability.serverName && sameJson(server, optionalServer(repoRoot, capability)));
}

function isLegacyManagedRemoteServer(name, server) {
  return Object.hasOwn(LEGACY_REMOTE_SERVERS, name) && sameJson(server, LEGACY_REMOTE_SERVERS[name]);
}

function isLegacyManagedLocalServer(name, server) {
  return Object.hasOwn(LEGACY_LOCAL_SERVERS, name) && sameJson(server, LEGACY_LOCAL_SERVERS[name]);
}

function hasLegacyRemoteTemplate(servers) {
  return sameJson(servers.context7_docs, LEGACY_REMOTE_SERVERS.context7_docs);
}

function mergeMcpTemplate(repoRoot, templatePath, destinationPath) {
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const templateServers = { ...(template.mcpServers || {}) };
  const codeGraph = managedCodeGraphServer(repoRoot);
  if (codeGraph) templateServers[MANAGED_CODEGRAPH_SERVER] = codeGraph;
  Object.assign(templateServers, managedOptionalServers(repoRoot));
  const existingFile = readExistingFile(repoRoot, destinationPath, 'utf8');
  if (!existingFile.exists) {
    const content = codeGraph || Object.keys(managedOptionalServers(repoRoot)).length > 0
      ? JSON.stringify({ ...template, mcpServers: templateServers }, null, 2) + '\n'
      : fs.readFileSync(templatePath, 'utf8');
    writeRepoFile(repoRoot, destinationPath, content);
    return true;
  }

  const existing = JSON.parse(existingFile.content);
  const existingServers = existing.mcpServers || {};
  const legacyRemoteTemplate = hasLegacyRemoteTemplate(existingServers);
  const userServers = Object.fromEntries(
    Object.entries(existingServers).filter(([name, server]) => {
      if (Object.hasOwn(templateServers, name)) {
        if (templateServers[name].disabled === true) {
          return !sameJson(server, templateServers[name])
            && !(legacyRemoteTemplate && isLegacyManagedRemoteServer(name, server))
            && !isLegacyManagedLocalServer(name, server);
        }
        return !isManagedOptionalServer(repoRoot, name, server)
          && !isManagedCodeGraphServer(name, server)
          && !isLegacyManagedCodeGraphServer(name, server);
      }
      if (isManagedCodeGraphServer(name, server) || isLegacyManagedCodeGraphServer(name, server)) return false;
      if (isManagedOptionalServer(repoRoot, name, server) || isLegacyManagedRemoteServer(name, server)) return false;
      return !(name === 'codegraph' && sameJson(server, LEGACY_CODEGRAPH_PLACEHOLDER));
    }),
  );
  const merged = {
    ...existing,
    ...template,
    mcpServers: {
      ...templateServers,
      ...userServers,
    },
  };
  const next = JSON.stringify(merged, null, 2) + '\n';
  if (next === existingFile.content) return false;
  writeRepoFile(repoRoot, destinationPath, next);
  return true;
}

module.exports = {
  TOOLING_STATE_PATH,
  defaultToolingState,
  ensureToolingState,
  MANAGED_CODEGRAPH_SERVER,
  OPTIONAL_CAPABILITIES,
  managedCodeGraphServer,
  managedOptionalServers,
  mergeMcpTemplate,
  readToolingState,
  setCodeGraphCapability,
  setOptionalCapability,
  toolingStatePath,
};
