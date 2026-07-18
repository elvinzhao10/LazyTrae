const fs = require('fs');
const { assertSafeRepoWritePath } = require('./path-boundary');
const { isAtomicRenamePermissionError, readExistingFile } = require('./safe-write');
const { writeRepoFile } = require('./templates');
const { classifyCoreServer, isManagedLocalServer, managedCoreServer } = require('./local-launcher');
const {
  isManagedOptionalServer, MANAGED_CODEGRAPH_DESCRIPTION, managedCodeGraphServer,
  managedOptionalServers,
} = require('./tooling-state');

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
const MANAGED_CODEGRAPH_SERVER = 'lazytrae_codegraph';

class McpDeclarationError extends Error {
  constructor(message, cause) {
    super(message, { cause }); this.name = 'McpDeclarationError';
  }
}

function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function templateConfiguration(repoRoot, templatePath) {
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  return {
    ...template,
    mcpServers: {
      ...(template.mcpServers || {}),
      lazytrae: managedCoreServer(repoRoot),
    },
  };
}

function readDestination(repoRoot, destinationPath) {
  let file;
  try {
    file = readExistingFile(repoRoot, destinationPath, 'utf8');
  } catch (error) {
    let reason = error && ['EACCES', 'EPERM'].includes(error.code)
      ? ' because permissions deny access'
      : `: ${(error && error.message) || 'unknown read error'}`;
    if (error && error.code === 'ELOOP') reason = ' because the destination is a symlink';
    if (/non-regular file/i.test(reason)) reason = ' because the destination is hard-linked or non-regular';
    throw new McpDeclarationError(`Cannot read .trae/mcp.json${reason}; fix the destination and retry.`, error);
  }
  if (!file.exists) return { file, config: null };
  let config;
  try {
    config = JSON.parse(file.content);
  } catch (error) {
    throw new McpDeclarationError('Invalid .trae/mcp.json; repair the JSON or remove the file before retrying init/sync.', error);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new McpDeclarationError('Invalid .trae/mcp.json; the top level must be an object. Repair or remove it before retrying init/sync.');
  }
  if (config.mcpServers !== undefined && (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers))) {
    throw new McpDeclarationError('Invalid .trae/mcp.json; mcpServers must be an object. Repair or remove it before retrying init/sync.');
  }
  return { file, config };
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

function isManagedCodeGraphServer(name, server) {
  return name === MANAGED_CODEGRAPH_SERVER
    && isManagedLocalServer(server, 'codegraph')
    && server.description === MANAGED_CODEGRAPH_DESCRIPTION;
}

function isLegacyRemoteServer(name, server) {
  return Object.hasOwn(LEGACY_REMOTE_SERVERS, name) && sameJson(server, LEGACY_REMOTE_SERVERS[name]);
}

function isLegacyLocalServer(name, server) {
  return Object.hasOwn(LEGACY_LOCAL_SERVERS, name) && sameJson(server, LEGACY_LOCAL_SERVERS[name]);
}

function callerServers(repoRoot, existingServers, templateServers) {
  const legacyRemoteTemplate = sameJson(existingServers.context7_docs, LEGACY_REMOTE_SERVERS.context7_docs);
  return Object.fromEntries(Object.entries(existingServers).filter(([name, server]) => {
    if (name === 'lazytrae') return false;
    if (Object.hasOwn(templateServers, name)) {
      if (templateServers[name].disabled === true) {
        return !sameJson(server, templateServers[name])
          && !(legacyRemoteTemplate && isLegacyRemoteServer(name, server))
          && !isLegacyLocalServer(name, server);
      }
      return !isManagedOptionalServer(repoRoot, name, server)
        && !isManagedCodeGraphServer(name, server)
        && !isLegacyManagedCodeGraphServer(name, server);
    }
    if (isManagedCodeGraphServer(name, server) || isLegacyManagedCodeGraphServer(name, server)) return false;
    if (isManagedOptionalServer(repoRoot, name, server) || isLegacyRemoteServer(name, server)) return false;
    return !(name === 'codegraph' && sameJson(server, LEGACY_CODEGRAPH_PLACEHOLDER));
  }));
}

function plannedUpdate(repoRoot, templatePath, destinationPath) {
  const template = templateConfiguration(repoRoot, templatePath);
  const codeGraph = managedCodeGraphServer(repoRoot);
  if (codeGraph) template.mcpServers[MANAGED_CODEGRAPH_SERVER] = codeGraph;
  Object.assign(template.mcpServers, managedOptionalServers(repoRoot));
  const { file, config } = readDestination(repoRoot, destinationPath);
  if (!file.exists) return { file, content: `${JSON.stringify(template, null, 2)}\n`, coreState: 'absent' };
  const existingServers = config.mcpServers || {};
  const core = classifyCoreServer(existingServers.lazytrae, repoRoot);
  if (core.state === 'modified') {
    return {
      file,
      status: 'preserved_modified',
      detail: 'The same-name LazyTrae MCP entry is modified and was preserved; rename or remove it before retrying init/sync.',
    };
  }
  const merged = {
    ...template,
    ...config,
    mcpServers: {
      ...template.mcpServers,
      ...callerServers(repoRoot, existingServers, template.mcpServers),
    },
  };
  return { file, content: `${JSON.stringify(merged, null, 2)}\n`, coreState: core.state, previousLauncher: core.launcher };
}

function updateMcpDeclaration(repoRoot, templatePath, destinationPath) {
  const update = plannedUpdate(repoRoot, templatePath, destinationPath);
  if (update.status) return { status: update.status, detail: update.detail };
  if (update.content === update.file.content) return { status: 'unchanged' };
  try {
    writeRepoFile(repoRoot, destinationPath, update.content);
  } catch (error) {
    if (isAtomicRenamePermissionError(error)) {
      return { status: update.file.exists ? 'unavailable_existing' : 'unavailable_absent' };
    }
    throw new McpDeclarationError('Atomic update of .trae/mcp.json failed; the original is unchanged. Resolve the write error and retry.', error);
  }
  const result = { status: 'updated' };
  if (['missing', 'stale', 'stale_root'].includes(update.coreState)) result.refreshed = true;
  if (update.previousLauncher !== undefined) result.previousLauncher = update.previousLauncher;
  return result;
}

function mergeMcpTemplate(repoRoot, templatePath, destinationPath) {
  const result = updateMcpDeclaration(repoRoot, templatePath, destinationPath);
  if (result.status === 'updated') return true;
  if (result.status === 'unchanged') return false;
  throw new McpDeclarationError(result.detail || 'The managed .trae/mcp.json declaration is unavailable and was not changed.');
}

function removableManagedServer(repoRoot, name, server, templateServers) {
  if (name === 'lazytrae') return true;
  if (sameJson(server, templateServers[name])) return true;
  if (isManagedCodeGraphServer(name, server) || isLegacyManagedCodeGraphServer(name, server)) return true;
  if (isManagedOptionalServer(repoRoot, name, server)) return true;
  if (isLegacyRemoteServer(name, server) || isLegacyLocalServer(name, server)) return true;
  return name === 'codegraph' && sameJson(server, LEGACY_CODEGRAPH_PLACEHOLDER);
}

function removeManagedMcpDeclaration(repoRoot, templatePath, destinationPath) {
  const { file, config } = readDestination(repoRoot, destinationPath);
  if (!file.exists) return { status: 'absent' };
  const existingServers = config.mcpServers || {};
  const core = classifyCoreServer(existingServers.lazytrae, repoRoot);
  if (core.state === 'modified') return { status: 'preserved_modified' };
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const remainingServers = Object.fromEntries(Object.entries(existingServers)
    .filter(([name, server]) => !removableManagedServer(repoRoot, name, server, template.mcpServers || {})));
  const remaining = { ...config, mcpServers: remainingServers };
  if (sameJson(remaining.lazytrae, template.lazytrae)) delete remaining.lazytrae;
  if (Object.keys(remaining).length === 1 && Object.keys(remainingServers).length === 0) {
    assertSafeRepoWritePath(repoRoot, destinationPath);
    fs.unlinkSync(destinationPath);
    return { status: 'removed' };
  }
  try {
    writeRepoFile(repoRoot, destinationPath, `${JSON.stringify(remaining, null, 2)}\n`);
  } catch (error) {
    throw new McpDeclarationError('Atomic removal update for .trae/mcp.json failed; the original is unchanged. Resolve the write error and retry.', error);
  }
  return { status: 'updated' };
}

module.exports = {
  McpDeclarationError,
  mergeMcpTemplate,
  removeManagedMcpDeclaration,
  updateMcpDeclaration,
};
