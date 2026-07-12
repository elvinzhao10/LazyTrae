const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CAPABILITIES = {
  ripgrep: {
    label: 'ripgrep',
    hostCommand: 'rg',
    ownedPath: null,
  },
  'ast-grep': {
    label: 'ast-grep',
    hostCommand: 'sg',
    ownedPath: ['node_modules', '.bin', 'sg'],
  },
};

function commandWorks(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  return !result.error && result.status === 0;
}

function ownedCommand(root, capability) {
  const candidate = capability.ownedPath
    ? path.join(root, ...capability.ownedPath)
    : ownedRipgrepPath(root);
  return fs.existsSync(candidate) && commandWorks(candidate) ? candidate : null;
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
  const owned = ownedCommand(root, capability);
  if (owned) return { name, label: capability.label, state: 'ready', source: 'owned', command: owned };
  if (commandWorks(capability.hostCommand)) {
    return { name, label: capability.label, state: 'ready', source: 'host', command: capability.hostCommand };
  }
  return { name, label: capability.label, state: 'missing', source: null, command: null };
}

function detectCapabilities(root) {
  return Object.keys(CAPABILITIES).map(name => detectCapability(root, name));
}

function formatCapabilities(capabilities) {
  return capabilities.map(capability => {
    const source = capability.source || 'unavailable';
    return `${capability.label}: ${source} (${capability.state})`;
  }).join('\n');
}

module.exports = { detectCapabilities, formatCapabilities };
