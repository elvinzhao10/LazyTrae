const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CORE_DESCRIPTION = 'LazyTrae state, evidence, handoff, and local context MCP server — exposes 15 tools including heuristic symbol/reference/docs/dependency helpers';
const MANAGED_KEY = '_lazytrae';
const RELEASE_VERSION = '1.0.2';

function localLauncherPath() {
  return fs.realpathSync(path.resolve(__dirname, '..', '..', 'bin', 'lazytrae.js'));
}

function canonicalRepoRoot(repoRoot) {
  return fs.realpathSync(repoRoot);
}

function fingerprint(server) {
  const payload = Object.fromEntries(Object.entries(server).filter(([key]) => key !== MANAGED_KEY));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function managedLocalServer({ repoRoot, args, description, kind, required }) {
  const server = {
    command: 'node',
    args: [localLauncherPath(), '--root', canonicalRepoRoot(repoRoot), ...args],
  };
  if (required !== undefined) server.required = required;
  server.description = description;
  server[MANAGED_KEY] = { schema_version: 1, kind, fingerprint: fingerprint(server) };
  return server;
}

function managedCoreServer(repoRoot) {
  return managedLocalServer({
    repoRoot,
    args: ['mcp'],
    description: CORE_DESCRIPTION,
    kind: 'core',
  });
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function hasManagedInvocation(server, kind) {
  if (!server || server.command !== 'node' || !Array.isArray(server.args)) return false;
  if (!path.isAbsolute(server.args[0] || '') || server.args[1] !== '--root' || !path.isAbsolute(server.args[2] || '')) return false;
  if (path.basename(server.args[0]) !== 'lazytrae.js' || path.basename(path.dirname(server.args[0])) !== 'bin') return false;
  if (kind === 'core') return server.args.length === 4 && server.args[3] === 'mcp';
  if (kind === 'codegraph') {
    return server.args.length === 8
      && server.args[3] === 'codegraph'
      && server.args[4] === '--target'
      && path.isAbsolute(server.args[5] || '')
      && server.args[6] === '--tooling-root'
      && path.isAbsolute(server.args[7] || '');
  }
  return false;
}

function isManagedLocalServer(server, kind) {
  const expectedKeys = kind === 'core'
    ? ['command', 'args', 'description', MANAGED_KEY]
    : ['command', 'args', 'required', 'description', MANAGED_KEY];
  if (!exactKeys(server, expectedKeys) || !hasManagedInvocation(server, kind)) return false;
  const metadata = server[MANAGED_KEY];
  if (!exactKeys(metadata, ['schema_version', 'kind', 'fingerprint'])) return false;
  if (metadata.schema_version !== 1 || metadata.kind !== kind || metadata.fingerprint !== fingerprint(server)) return false;
  if (kind === 'core') return server.description === CORE_DESCRIPTION;
  return server.required === false;
}

function isExactLegacyCoreServer(server) {
  if (!server || server.command !== 'lazytrae' || JSON.stringify(server.args) !== JSON.stringify(['mcp'])) return false;
  const keys = Object.keys(server).sort();
  if (JSON.stringify(keys) === JSON.stringify(['args', 'command'])) return true;
  return JSON.stringify(keys) === JSON.stringify(['args', 'command', 'description'])
    && server.description === CORE_DESCRIPTION;
}

function classifyCoreServer(server, repoRoot) {
  if (server === undefined) return { state: 'absent' };
  if (isExactLegacyCoreServer(server)) return { state: 'legacy' };
  if (!isManagedLocalServer(server, 'core')) return { state: 'modified' };
  const launcher = server.args[0];
  const configuredRoot = server.args[2];
  if (!fs.existsSync(launcher)) return { state: 'missing', launcher, configuredRoot };
  if (launcher !== localLauncherPath()) return { state: 'stale', launcher, configuredRoot };
  if (configuredRoot !== canonicalRepoRoot(repoRoot)) return { state: 'stale_root', launcher, configuredRoot };
  return { state: 'current', launcher, configuredRoot };
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function localCommand(repoRoot) {
  return `node ${shellQuote(localLauncherPath())} --root ${shellQuote(canonicalRepoRoot(repoRoot))}`;
}

function remediation(repoRoot) {
  return `${localCommand(repoRoot)} sync`;
}

function inspectCoreDeclaration(repoRoot, config) {
  const servers = config && typeof config === 'object' && !Array.isArray(config) ? config.mcpServers : null;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    return { ready: false, detail: `.trae/mcp.json must contain an object mcpServers map; repair it, then run ${remediation(repoRoot)}` };
  }
  const classification = classifyCoreServer(servers.lazytrae, repoRoot);
  if (classification.state === 'current') {
    return { ready: true, detail: `node with absolute release-owned launcher ${JSON.stringify(classification.launcher)}` };
  }
  if (classification.state === 'legacy') {
    return { ready: false, detail: `legacy PATH-dependent LazyTrae declaration; run ${remediation(repoRoot)}` };
  }
  if (classification.state === 'missing') {
    return { ready: false, detail: `managed local launcher is missing at ${JSON.stringify(classification.launcher)}; restore that release or run ${remediation(repoRoot)}` };
  }
  if (classification.state === 'stale' || classification.state === 'stale_root') {
    return { ready: false, detail: `stale managed local launcher/root (${JSON.stringify(classification.launcher)}); run ${remediation(repoRoot)}` };
  }
  if (classification.state === 'modified') {
    return { ready: false, detail: `same-name LazyTrae MCP entry is modified and preserved; rename or remove it before running ${remediation(repoRoot)}` };
  }
  return { ready: false, detail: `LazyTrae MCP entry is missing; run ${remediation(repoRoot)}` };
}

function materializeGuidance(content, repoRoot) {
  return content.replaceAll('__LAZYTRAE_LOCAL_COMMAND__', localCommand(repoRoot));
}

module.exports = {
  CORE_DESCRIPTION,
  RELEASE_VERSION,
  canonicalRepoRoot,
  classifyCoreServer,
  inspectCoreDeclaration,
  isExactLegacyCoreServer,
  isManagedLocalServer,
  localCommand,
  localLauncherPath,
  managedCoreServer,
  managedLocalServer,
  materializeGuidance,
};
