const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  assertSafeRoot,
  listOwnedEntries,
  ownedRuntimeEnvironment,
  prepareOwnedRuntime,
  readReceipt,
  removeReceiptOwnedRoot,
  validateReceipt,
  writeReceipt,
} = require('./tooling-root');
const { assertTarget } = require('./lsp-provider');
const { setCodeGraphCapability } = require('./tooling-state');

const SOURCE_ROOT = path.resolve(__dirname, '..', '..', 'tooling', 'codegraph');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const SUPPORTED_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cxx', '.go', '.java', '.js', '.jsx', '.kt', '.kts', '.mjs', '.py', '.rb', '.rs', '.swift', '.ts', '.tsx']);

function parseCodeGraphArgs(args) {
  const targetIndex = args.indexOf('--target');
  const rootIndex = args.indexOf('--tooling-root');
  if (targetIndex === -1 || !args[targetIndex + 1]) throw new Error('--target requires an absolute path.');
  if (rootIndex === -1 || !args[rootIndex + 1]) throw new Error('--tooling-root requires an absolute path.');
  if (args.length !== 4 || targetIndex % 2 !== 0 || rootIndex % 2 !== 0) throw new Error('CodeGraph commands accept only --target and --tooling-root.');
  const toolingRoot = path.resolve(args[rootIndex + 1]);
  if (!path.isAbsolute(args[rootIndex + 1]) || path.parse(toolingRoot).root === toolingRoot) {
    throw new Error('--tooling-root must be a non-root absolute path.');
  }
  return { target: assertTarget(args[targetIndex + 1]), toolingRoot };
}

function inside(root, candidate) {
  const relative = path.relative(fs.realpathSync(root), candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function ownedExecutable(root) {
  try {
    const receipt = readReceipt(root);
    validateReceipt(root, receipt);
    if (!receipt.provisioned_capabilities.includes('codegraph')) return null;
    const executable = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'codegraph.cmd' : 'codegraph');
    const resolved = fs.realpathSync(executable);
    const stat = fs.statSync(resolved);
    return inside(root, resolved) && stat.isFile() && (stat.mode & 0o111) !== 0 ? resolved : null;
  } catch (_) {
    return null;
  }
}

function indexState(target) {
  const directory = path.join(target, '.codegraph');
  if (!fs.existsSync(directory)) return 'not-initialized';
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return 'incompatible';
  const database = path.join(directory, 'codegraph.db');
  if (!fs.existsSync(database)) return 'not-initialized';
  const databaseStat = fs.lstatSync(database);
  if (!databaseStat.isFile() || databaseStat.isSymbolicLink()) return 'incompatible';
  const descriptor = fs.openSync(database, 'r');
  try {
    const header = Buffer.alloc(16);
    fs.readSync(descriptor, header, 0, header.length, 0);
    return header.toString('utf8') === 'SQLite format 3\0' ? 'ready' : 'not-initialized';
  } finally {
    fs.closeSync(descriptor);
  }
}

function validatedIndex(target, executable, toolingRoot) {
  const directoryState = indexState(target);
  if (directoryState !== 'ready') return directoryState;
  const result = spawnSync(executable, ['status', target], {
    cwd: target,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...ownedRuntimeEnvironment(toolingRoot), CODEGRAPH_NO_DOWNLOAD: '1' },
  });
  return !result.error && result.status === 0 ? 'ready' : 'not-initialized';
}

function projectSize(target, budget = { files: 0, lines: 0, remaining: 20000 }) {
  if (budget.files >= 500 || budget.lines >= 100000 || budget.remaining <= 0) return budget;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === '.codegraph' || entry.name === '.git' || entry.name === '.lazytrae' || entry.name === 'node_modules') continue;
    const candidate = path.join(target, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) projectSize(candidate, budget);
    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      budget.files += 1;
      budget.remaining -= 1;
      if (budget.lines < 100000) {
        const content = fs.readFileSync(candidate, 'utf8');
        budget.lines += content.split('\n').length;
      }
    }
    if (budget.files >= 500 || budget.lines >= 100000 || budget.remaining <= 0) break;
  }
  return budget;
}

function status(target, toolingRoot) {
  const executable = ownedExecutable(toolingRoot);
  const size = projectSize(target);
  const recommendation = size.files >= 500 || size.lines >= 100000 ? 'recommended' : 'not recommended';
  if (!executable) {
    const state = fs.existsSync(toolingRoot) ? 'incompatible' : 'missing';
    const reason = state === 'missing'
      ? 'no receipt-owned CodeGraph binary is available in the explicit tooling root'
      : 'the explicit tooling root is not an unmodified receipt-owned CodeGraph installation';
    return { state, reason, recommendation, size };
  }
  const index = validatedIndex(target, executable, toolingRoot);
  if (index !== 'ready') return { state: index, reason: index === 'not-initialized' ? 'run lazytrae tooling codegraph-init before enabling this optional MCP' : 'the project .codegraph path must be a non-symlink directory', recommendation, size };
  return { state: 'ready', command: executable, recommendation, size };
}

function formatStatus(value) {
  const lines = [
    `STATE: ${value.state}`,
    `RECOMMENDATION: ${value.recommendation}`,
    `SUPPORTED_SOURCE_FILES: ${value.size.files}`,
    `SUPPORTED_SOURCE_LINES: ${value.size.lines}`,
  ];
  if (value.command) lines.push(`PROVIDER: owned ${value.command}`);
  if (value.reason) lines.push(`REASON: ${value.reason}`);
  return lines.join('\n');
}

function install(target, toolingRoot) {
  assertSafeRoot(toolingRoot, true);
  fs.cpSync(SOURCE_ROOT, toolingRoot, { recursive: true, dereference: false });
  prepareOwnedRuntime(toolingRoot);
  const result = spawnSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: toolingRoot,
    encoding: 'utf8',
    timeout: 120000,
    env: ownedRuntimeEnvironment(toolingRoot),
  });
  if (result.error || result.status !== 0) {
    fs.rmSync(toolingRoot, { recursive: true, force: true });
    throw new Error(`CodeGraph install failed: ${(result.error && result.error.message) || result.stderr || result.stdout}`.trim());
  }
  writeReceipt(toolingRoot, listOwnedEntries(toolingRoot), ['codegraph']);
  return status(target, toolingRoot);
}

function initialize(target, toolingRoot) {
  const executable = ownedExecutable(toolingRoot);
  if (!executable) throw new Error('CodeGraph cannot initialize without an unmodified receipt-owned binary.');
  const result = spawnSync(executable, ['init', '.'], {
    cwd: target,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...ownedRuntimeEnvironment(toolingRoot), CODEGRAPH_NO_DOWNLOAD: '1' },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`CodeGraph initialization failed: ${(result.error && result.error.message) || result.stderr || result.stdout}`.trim());
  }
  const initialized = status(target, toolingRoot);
  if (initialized.state !== 'ready') throw new Error(`CodeGraph initialization did not produce a valid index: ${initialized.reason}`);
  return initialized;
}

function enable(target, toolingRoot) {
  const current = status(target, toolingRoot);
  if (current.state !== 'ready') throw new Error(`CodeGraph cannot be enabled: ${current.reason}`);
  setCodeGraphCapability(target, {
    enabled: true,
    state: 'ready',
    tooling_root: toolingRoot,
    index_ownership: 'preexisting',
  });
  return current;
}

function disable(target) {
  setCodeGraphCapability(target, { enabled: false, state: 'disabled' });
}

function uninstall(target, toolingRoot) {
  const executable = ownedExecutable(toolingRoot);
  if (!executable) throw new Error('refusing CodeGraph uninstall: root is not an unmodified receipt-owned CodeGraph installation.');
  removeReceiptOwnedRoot(toolingRoot);
  disable(target);
}

module.exports = { disable, enable, formatStatus, indexState, initialize, install, ownedExecutable, parseCodeGraphArgs, status, uninstall };
