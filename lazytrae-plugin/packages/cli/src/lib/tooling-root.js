const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RECEIPT_FILE = 'lazytrae-tooling-receipt.json';
const RECEIPT_OWNER = 'lazytrae-tooling';

function runtimePaths(root) {
  const runtime = path.join(root, 'runtime');
  return {
    runtime,
    home: path.join(runtime, 'home'),
    npmCache: path.join(runtime, 'npm-cache'),
    npmLogs: path.join(runtime, 'npm-logs'),
    cache: path.join(runtime, 'cache'),
    config: path.join(runtime, 'config'),
    data: path.join(runtime, 'data'),
    state: path.join(runtime, 'state'),
    pythonPycache: path.join(runtime, 'python-pycache'),
    pythonUserbase: path.join(runtime, 'python-userbase'),
    pipCache: path.join(runtime, 'pip-cache'),
  };
}

function prepareOwnedRuntime(root) {
  const paths = runtimePaths(root);
  for (const directory of Object.values(paths)) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return paths;
}

function ownedRuntimeEnvironment(root, environment = process.env) {
  const paths = runtimePaths(root);
  for (const directory of Object.values(paths)) {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('refusing unsafe tooling runtime directory');
  }
  return {
    ...environment,
    HOME: paths.home,
    XDG_CACHE_HOME: paths.cache,
    XDG_CONFIG_HOME: paths.config,
    XDG_DATA_HOME: paths.data,
    XDG_STATE_HOME: paths.state,
    npm_config_cache: paths.npmCache,
    npm_config_logs_dir: paths.npmLogs,
    npm_config_update_notifier: 'false',
    PYTHONPYCACHEPREFIX: paths.pythonPycache,
    PYTHONUSERBASE: paths.pythonUserbase,
    PIP_CACHE_DIR: paths.pipCache,
    PYTHONNOUSERSITE: '1',
    CODEGRAPH_TELEMETRY: '0',
  };
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isExpectedMutableRuntimeEntry(entry) {
  if (entry.type !== 'file') return false;
  const relativePath = entry.path.split(path.sep).join('/');
  return relativePath === 'runtime/home/.codegraph/update-check.json'
    || /^runtime\/home\/\.codegraph\/daemons\/[A-Za-z0-9._-]+\.json$/.test(relativePath)
    || /^runtime\/npm-logs\/\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2}_\d{3}Z-debug-\d+\.log$/.test(relativePath);
}

function readToolingRoot(args) {
  const index = args.indexOf('--tooling-root');
  if (index === -1 || !args[index + 1]) throw new Error('--tooling-root requires an absolute path.');
  const root = args[index + 1];
  if (!path.isAbsolute(root) || path.parse(root).root === root) {
    throw new Error('--tooling-root must be a non-root absolute path.');
  }
  return path.resolve(root);
}

function assertSafeAncestors(root) {
  const parsed = path.parse(root);
  let current = parsed.root;
  const parts = root.slice(parsed.root.length).split(path.sep).filter(Boolean);
  const systemTempRoots = [path.resolve(os.tmpdir()), path.resolve('/tmp')];
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw error;
    }
    const isSystemTempAlias = systemTempRoots.some(tempRoot =>
      tempRoot === current || tempRoot.startsWith(`${current}${path.sep}`),
    );
    if (stat.isSymbolicLink() && !isSystemTempAlias) {
      throw new Error('refusing symlinked tooling-root ancestor');
    }
    if (current !== root && !stat.isDirectory() && !(stat.isSymbolicLink() && isSystemTempAlias)) {
      throw new Error('tooling-root has a non-directory ancestor');
    }
  }
}

function assertSafeRoot(root, requireEmpty) {
  assertSafeAncestors(root);
  if (!fs.existsSync(root)) {
    if (!requireEmpty) return { exists: false };
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    assertSafeAncestors(root);
  }
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) throw new Error('refusing symlinked tooling-root');
  if (!stat.isDirectory()) throw new Error('--tooling-root must be a directory');
  if (requireEmpty && fs.readdirSync(root).length > 0) {
    throw new Error('--tooling-root must be empty before install');
  }
  return { exists: true };
}

function relativeRootPath(root, target) {
  const relative = path.relative(root, target);
  if (!relative || path.isAbsolute(relative) || relative.startsWith(`..${path.sep}`) || relative === '..') {
    throw new Error('receipt path must stay inside tooling-root');
  }
  return relative;
}

function listOwnedEntries(root, current = root) {
  const entries = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (current === root && entry.name === RECEIPT_FILE) continue;
    const candidate = path.join(current, entry.name);
    const relativePath = relativeRootPath(root, candidate);
    const stat = fs.lstatSync(candidate);
    if (stat.isDirectory()) {
      entries.push(...listOwnedEntries(root, candidate));
    } else if (stat.isFile()) {
      if (stat.nlink !== 1) throw new Error('refusing hard-linked tooling file');
      entries.push({ path: relativePath, type: 'file', sha256: sha256(candidate) });
    } else if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(candidate);
      const resolved = path.resolve(path.dirname(candidate), target);
      if (!isInside(root, resolved)) throw new Error('refusing tooling symlink outside tooling-root');
      entries.push({ path: relativePath, type: 'symlink', target });
    } else {
      throw new Error('refusing unsupported tooling entry');
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function receiptPath(root) {
  return path.join(root, RECEIPT_FILE);
}

function writeReceipt(root, entries, provisionedCapabilities = []) {
  const receipt = {
    schema_version: 1,
    owner: RECEIPT_OWNER,
    tooling_root: root,
    files: entries.filter(entry => !isExpectedMutableRuntimeEntry(entry)),
    provisioned_capabilities: provisionedCapabilities,
  };
  fs.writeFileSync(receiptPath(root), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
}

function readReceipt(root) {
  assertSafeRoot(root, false);
  const target = receiptPath(root);
  if (!fs.existsSync(target)) throw new Error('no LazyTrae tooling receipt exists for this root');
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('refusing unsafe tooling receipt');
  const receipt = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (receipt.schema_version !== 1 || receipt.owner !== RECEIPT_OWNER || receipt.tooling_root !== root || !Array.isArray(receipt.files)
    || (receipt.provisioned_capabilities !== undefined && !Array.isArray(receipt.provisioned_capabilities))) {
    throw new Error('tooling receipt is not owned by this LazyTrae installation');
  }
  return receipt;
}

function validateReceipt(root, receipt) {
  const expected = new Map(receipt.files.map(entry => [entry.path, entry]));
  if (expected.size !== receipt.files.length) throw new Error('tooling receipt contains duplicate paths');
  const actual = listOwnedEntries(root);
  const seen = new Set();
  for (const actualEntry of actual) {
    const receiptEntry = expected.get(actualEntry.path);
    if (!receiptEntry) {
      if (isExpectedMutableRuntimeEntry(actualEntry)) continue;
      throw new Error('tooling root contains unverified files');
    }
    seen.add(actualEntry.path);
    if (receiptEntry.type !== actualEntry.type) throw new Error('tooling root contains unverified files');
    if (!isExpectedMutableRuntimeEntry(actualEntry) && actualEntry.type === 'file' && receiptEntry.sha256 !== actualEntry.sha256) {
      throw new Error(`tooling file was edited: ${actualEntry.path}`);
    }
    if (!isExpectedMutableRuntimeEntry(actualEntry) && actualEntry.type === 'symlink' && receiptEntry.target !== actualEntry.target) {
      throw new Error(`tooling symlink was edited: ${actualEntry.path}`);
    }
  }
  for (const expectedEntry of receipt.files) {
    if (!seen.has(expectedEntry.path) && !isExpectedMutableRuntimeEntry(expectedEntry)) throw new Error('tooling root contains unverified files');
  }
}

function removeReceiptOwnedRoot(root) {
  const receipt = readReceipt(root);
  validateReceipt(root, receipt);
  const expected = new Set(receipt.files.map(entry => entry.path));
  for (const entry of listOwnedEntries(root)) {
    if (!expected.has(entry.path) && isExpectedMutableRuntimeEntry(entry)) fs.unlinkSync(path.join(root, entry.path));
  }
  for (const entry of receipt.files) {
    const target = path.join(root, entry.path);
    relativeRootPath(root, target);
    fs.unlinkSync(target);
  }
  fs.unlinkSync(receiptPath(root));
  const directories = [];
  function collectDirectories(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(current, entry.name);
      collectDirectories(directory);
      directories.push(directory);
    }
  }
  collectDirectories(root);
  for (const directory of directories) {
    if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
  }
  if (fs.readdirSync(root).length !== 0) throw new Error('tooling root contains unverified files');
  fs.rmdirSync(root);
}

module.exports = {
  RECEIPT_FILE,
  assertSafeAncestors,
  assertSafeRoot,
  listOwnedEntries,
  readReceipt,
  readToolingRoot,
  removeReceiptOwnedRoot,
  isExpectedMutableRuntimeEntry,
  ownedRuntimeEnvironment,
  prepareOwnedRuntime,
  validateReceipt,
  writeReceipt,
};
