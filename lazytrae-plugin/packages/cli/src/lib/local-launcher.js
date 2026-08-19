const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  canonicalRepoRoot, localCommand, localLauncherContext, localLauncherPath, shellQuote,
} = require('./local-command');
const { CURRENT_VERSION: RELEASE_VERSION } = require('./version');

const CORE_DESCRIPTION = 'LazyTrae state, evidence, handoff, and local context MCP server — exposes 15 tools including heuristic symbol/reference/docs/dependency helpers';
const MANAGED_KEY = '_lazytrae';
const MCP_JSON_BEGIN = 'LAZYTRAE_MCP_JSON_BEGIN';
const MCP_JSON_END = 'LAZYTRAE_MCP_JSON_END';

function fingerprint(server) {
  const payload = Object.fromEntries(Object.entries(server).filter(([key]) => key !== MANAGED_KEY));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function managedEntrySha256(server) {
  const metadata = { ...server[MANAGED_KEY] };
  delete metadata.managed_entry_sha256;
  return crypto.createHash('sha256')
    .update(JSON.stringify({ ...server, [MANAGED_KEY]: metadata }))
    .digest('hex');
}

function managedLocalServer({ repoRoot, args, description, kind, required }) {
  const context = localLauncherContext();
  const server = {
    command: context.releaseSha === null ? 'node' : context.runtime.path,
    args: [context.launcher, '--root', canonicalRepoRoot(repoRoot), ...args],
  };
  if (required !== undefined) server.required = required;
  server.description = description;
  if (context.releaseSha === null) {
    server[MANAGED_KEY] = { schema_version: 1, kind, fingerprint: fingerprint(server) };
  } else {
    server[MANAGED_KEY] = {
      schema_version: 2,
      kind,
      runtime: context.runtime,
      release_sha: context.releaseSha,
    };
    server[MANAGED_KEY].managed_entry_sha256 = managedEntrySha256(server);
  }
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

function hostMcpConfiguration(repoRoot) {
  const server = managedCoreServer(repoRoot);
  return {
    mcpServers: {
      lazytrae: { command: server.command, args: server.args },
    },
  };
}

function formatHostMcpConfiguration(repoRoot) {
  return JSON.stringify(hostMcpConfiguration(repoRoot), null, 2);
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function hasManagedInvocation(server, kind) {
  if (!server || typeof server.command !== 'string' || !Array.isArray(server.args)) return false;
  if (server.command !== 'node' && !path.isAbsolute(server.command)) return false;
  if (!path.isAbsolute(server.args[0] || '') || server.args[1] !== '--root' || !path.isAbsolute(server.args[2] || '')) return false;
  const releaseLauncher = path.basename(server.args[0]) === 'lazytrae.js'
    && path.basename(path.dirname(server.args[0])) === 'bin';
  const durableLauncher = path.basename(server.args[0]) === 'launcher.js'
    && path.basename(path.dirname(server.args[0])) === 'LazyTrae';
  if (!releaseLauncher && !durableLauncher) return false;
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
  if (!metadata || metadata.kind !== kind) return false;
  if (metadata.schema_version === 1) {
    if (!exactKeys(metadata, ['schema_version', 'kind', 'fingerprint'])
      || metadata.fingerprint !== fingerprint(server)) return false;
  } else if (metadata.schema_version === 2) {
    if (!exactKeys(metadata, [
      'schema_version', 'kind', 'runtime', 'release_sha', 'managed_entry_sha256',
    ])) return false;
    if (!exactKeys(metadata.runtime, ['path', 'fingerprint'])
      || !path.isAbsolute(metadata.runtime.path)
      || !exactKeys(metadata.runtime.fingerprint, ['realpath', 'version', 'sha256'])
      || !path.isAbsolute(metadata.runtime.fingerprint.realpath)
      || server.command !== metadata.runtime.path
      || !/^v\d+\.\d+\.\d+/.test(metadata.runtime.fingerprint.version)
      || !/^[a-f0-9]{64}$/.test(metadata.runtime.fingerprint.sha256)
      || !/^[a-f0-9]{40}$/.test(metadata.release_sha)
      || metadata.managed_entry_sha256 !== managedEntrySha256(server)) return false;
  } else {
    return false;
  }
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
  const context = localLauncherContext();
  if (server[MANAGED_KEY].schema_version === 2 && context.releaseSha === null) {
    return { state: 'modified' };
  }
  const launcher = server.args[0];
  const configuredRoot = server.args[2];
  const expectedCommand = context.releaseSha === null ? 'node' : context.runtime.path;
  if (server.command !== expectedCommand) {
    return { state: 'stale_runtime', launcher, configuredRoot };
  }
  if (server[MANAGED_KEY].schema_version === 2
    && JSON.stringify(server[MANAGED_KEY].runtime) !== JSON.stringify(context.runtime)) {
    return { state: 'stale_runtime', launcher, configuredRoot };
  }
  if (!fs.existsSync(launcher)) return { state: 'missing', launcher, configuredRoot };
  if (launcher !== context.launcher) return { state: 'stale', launcher, configuredRoot };
  if (configuredRoot !== canonicalRepoRoot(repoRoot)) return { state: 'stale_root', launcher, configuredRoot };
  return { state: 'current', launcher, configuredRoot };
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
  if (classification.state === 'stale' || classification.state === 'stale_root'
    || classification.state === 'stale_runtime') {
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

function materializeHook(content) {
  return content.replaceAll(
    '__LAZYTRAE_RELEASE_LAUNCHER__',
    shellQuote(localLauncherPath()),
  );
}

module.exports = {
  CORE_DESCRIPTION,
  MCP_JSON_BEGIN,
  MCP_JSON_END,
  RELEASE_VERSION,
  canonicalRepoRoot,
  classifyCoreServer,
  formatHostMcpConfiguration,
  inspectCoreDeclaration,
  hostMcpConfiguration,
  isExactLegacyCoreServer,
  isManagedLocalServer,
  localCommand,
  localLauncherContext,
  localLauncherPath,
  managedCoreServer,
  managedLocalServer,
  materializeGuidance,
  materializeHook,
  shellQuote,
};
