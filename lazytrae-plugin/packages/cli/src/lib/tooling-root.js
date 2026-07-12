const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RECEIPT_FILE = 'lazytrae-tooling-receipt.json';
const RECEIPT_OWNER = 'lazytrae-tooling';

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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

function assertSafeRoot(root, requireEmpty) {
  if (!fs.existsSync(root)) {
    if (!requireEmpty) return { exists: false };
    const parent = path.dirname(root);
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) {
      throw new Error('refusing symlinked tooling-root parent');
    }
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
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

function writeReceipt(root, entries) {
  const receipt = {
    schema_version: 1,
    owner: RECEIPT_OWNER,
    tooling_root: root,
    files: entries,
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
  if (receipt.schema_version !== 1 || receipt.owner !== RECEIPT_OWNER || receipt.tooling_root !== root || !Array.isArray(receipt.files)) {
    throw new Error('tooling receipt is not owned by this LazyTrae installation');
  }
  return receipt;
}

function validateReceipt(root, receipt) {
  const expected = new Map(receipt.files.map(entry => [entry.path, entry]));
  if (expected.size !== receipt.files.length) throw new Error('tooling receipt contains duplicate paths');
  const actual = listOwnedEntries(root);
  if (actual.length !== receipt.files.length) throw new Error('tooling root contains unverified files');
  for (const actualEntry of actual) {
    const receiptEntry = expected.get(actualEntry.path);
    if (!receiptEntry || receiptEntry.type !== actualEntry.type) throw new Error('tooling root contains unverified files');
    if (actualEntry.type === 'file' && receiptEntry.sha256 !== actualEntry.sha256) {
      throw new Error(`tooling file was edited: ${actualEntry.path}`);
    }
    if (actualEntry.type === 'symlink' && receiptEntry.target !== actualEntry.target) {
      throw new Error(`tooling symlink was edited: ${actualEntry.path}`);
    }
  }
}

function removeReceiptOwnedRoot(root) {
  const receipt = readReceipt(root);
  validateReceipt(root, receipt);
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
  assertSafeRoot,
  listOwnedEntries,
  readReceipt,
  readToolingRoot,
  removeReceiptOwnedRoot,
  validateReceipt,
  writeReceipt,
};
