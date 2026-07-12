const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CAPABILITIES = {
  ripgrep: {
    label: 'ripgrep',
    hostCommand: 'rg',
    packageName: '@vscode/ripgrep',
    packageVersion: '1.18.0',
    minimumVersion: [14, 0, 0],
    ownedPath: null,
  },
  'ast-grep': {
    label: 'ast-grep',
    hostCommand: 'sg',
    packageName: '@ast-grep/cli',
    packageVersion: '0.44.1',
    minimumVersion: [0, 44, 0],
    ownedPath: ['node_modules', '.bin', 'sg'],
  },
};

function parseVersion(output) {
  const match = output.match(/(?:ripgrep|ast-grep)\s+(\d+)\.(\d+)\.(\d+)/i);
  return match ? match.slice(1).map(Number) : null;
}

function isCompatible(version, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] > minimum[index]) return true;
    if (version[index] < minimum[index]) return false;
  }
  return true;
}

function probeCommand(command, capability) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return null;
  const version = parseVersion(`${result.stdout || ''}\n${result.stderr || ''}`);
  return version && isCompatible(version, capability.minimumVersion) ? version : null;
}

function ownedCommand(root, capability) {
  const candidate = capability.ownedPath
    ? path.join(root, ...capability.ownedPath)
    : ownedRipgrepPath(root);
  return fs.existsSync(candidate) && probeCommand(candidate, capability) ? candidate : null;
}

function ownedRipgrepPath(root) {
  const platform = process.platform === 'win32' ? 'win32' : process.platform;
  const architecture = process.arch === 'arm' ? 'arm' : process.arch;
  const packageName = `@vscode/ripgrep-${platform}-${architecture}`;
  const executable = process.platform === 'win32' ? 'rg.exe' : 'rg';
  return path.join(root, 'node_modules', packageName, 'bin', executable);
}

function detectCapability(root, name) {
  const capability = CAPABILITIES[name];
  const host = probeCommand(capability.hostCommand, capability);
  if (host) {
    return { name, label: capability.label, state: 'ready', source: 'host', command: capability.hostCommand };
  }
  const owned = ownedCommand(root, capability);
  if (owned) return { name, label: capability.label, state: 'ready', source: 'owned', command: owned };
  return { name, label: capability.label, state: 'missing', source: null, command: null };
}

function detectCapabilities(root) {
  return Object.keys(CAPABILITIES).map(name => detectCapability(root, name));
}

function missingCapabilities(root) {
  return detectCapabilities(root).filter(capability => capability.state !== 'ready').map(capability => capability.name);
}

function packageDependencies(names) {
  return Object.fromEntries(names.map(name => {
    const capability = CAPABILITIES[name];
    return [capability.packageName, capability.packageVersion];
  }));
}

function formatCapabilities(capabilities) {
  return capabilities.map(capability => {
    const source = capability.source || 'unavailable';
    return `${capability.label}: ${source} (${capability.state})`;
  }).join('\n');
}

module.exports = { detectCapabilities, formatCapabilities, missingCapabilities, packageDependencies };
