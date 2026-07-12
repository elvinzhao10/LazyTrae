const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROVIDERS = {
  typescript: {
    command: 'typescript-language-server',
    packageDirectory: 'typescript',
    minimumNodeMajor: 20,
    probe: 'version',
  },
  python: {
    command: 'basedpyright-langserver',
    packageDirectory: 'python',
    minimumNodeMajor: 18,
    probe: 'executable',
  },
};

function isWithin(root, candidate) {
  const relative = path.relative(fs.realpathSync(root), candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertTarget(target) {
  if (!path.isAbsolute(target)) throw new Error('--target must be an absolute path.');
  const requested = path.resolve(target);
  const stat = fs.lstatSync(requested);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('--target must be a non-symlink directory.');
  return fs.realpathSync(requested);
}

function inspectTree(root, extensions, remaining = { value: 1200 }) {
  if (remaining.value <= 0) return false;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.lazytrae') continue;
    const candidate = path.join(root, entry.name);
    if (entry.isFile()) {
      remaining.value -= 1;
      if (extensions.some(extension => entry.name.endsWith(extension))) return true;
    } else if (entry.isDirectory() && !entry.isSymbolicLink() && inspectTree(candidate, extensions, remaining)) {
      return true;
    }
  }
  return false;
}

function detectLanguage(target) {
  const typescriptConfigs = ['tsconfig.json', 'jsconfig.json'];
  if (typescriptConfigs.some(name => fs.existsSync(path.join(target, name)))
    || inspectTree(target, ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])) return 'typescript';
  const pythonConfigs = ['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'];
  if (pythonConfigs.some(name => fs.existsSync(path.join(target, name))) || inspectTree(target, ['.py'])) return 'python';
  return null;
}

function nodeReadiness(provider) {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (!Number.isInteger(major) || major < provider.minimumNodeMajor) {
    return { state: 'incompatible', reason: `${provider.command} requires Node >=${provider.minimumNodeMajor}; current Node is ${process.versions.node}` };
  }
  return null;
}

function runnable(command, provider) {
  if (provider.probe === 'executable') return fs.existsSync(command) && fs.statSync(command).isFile();
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000 });
  return !result.error && result.status === 0;
}

function executable(root, candidate, provider) {
  try {
    const resolved = fs.realpathSync(candidate);
    return isWithin(root, resolved) && fs.statSync(resolved).isFile() && runnable(resolved, provider) ? resolved : null;
  } catch (_) {
    return null;
  }
}

function hostCommand(provider) {
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [provider.command], { encoding: 'utf8', timeout: 5000 });
  if (result.error || result.status !== 0) return null;
  const candidate = (result.stdout || '').split(/\r?\n/).find(Boolean);
  return candidate && runnable(candidate, provider) ? candidate : null;
}

function providerFor(target, toolingRoot, ownsRoot) {
  const language = detectLanguage(target);
  if (!language) return { state: 'unsupported', reason: 'no supported JavaScript/TypeScript or Python source/configuration detected' };
  const provider = PROVIDERS[language];
  const readiness = nodeReadiness(provider);
  if (readiness) return { ...readiness, language };
  const project = executable(target, path.join(target, 'node_modules', '.bin', provider.command), provider);
  if (project) return { state: 'ready', language, source: 'project', command: project };
  const host = hostCommand(provider);
  if (host) return { state: 'ready', language, source: 'host', command: host };
  if (ownsRoot(toolingRoot, language)) {
    const owned = executable(toolingRoot, path.join(toolingRoot, 'lsp', provider.packageDirectory, 'node_modules', '.bin', provider.command), provider);
    if (owned) return { state: 'ready', language, source: 'owned', command: owned };
  }
  return { state: 'missing', language, reason: 'no compatible project, host, or receipt-owned LSP provider is available' };
}

function lspInvocation(provider) {
  return [provider.command, '--stdio'];
}

module.exports = { PROVIDERS, assertTarget, detectLanguage, lspInvocation, providerFor };
