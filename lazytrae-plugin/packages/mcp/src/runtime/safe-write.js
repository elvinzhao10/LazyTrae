const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('./path-boundary');

const MAX_TEMP_ATTEMPTS = 10;
const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;

class AtomicRenamePermissionError extends Error {
  constructor(cause) {
    super(cause.message, { cause });
    this.name = 'AtomicRenamePermissionError';
    this.code = cause.code;
  }
}

function ensureSafeParent(repoRoot, filePath) {
  const parent = path.dirname(filePath);
  assertSafeRepoWritePath(repoRoot, parent);
  fs.mkdirSync(parent, { recursive: true });
  assertSafeRepoWritePath(repoRoot, parent);
}

function createTemporaryFile(repoRoot, filePath) {
  ensureSafeParent(repoRoot, filePath);
  for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${attempt}.tmp`;
    assertSafeRepoWritePath(repoRoot, tempPath);
    try {
      const descriptor = fs.openSync(
        tempPath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW,
        0o600,
      );
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || stat.nlink !== 1) {
        fs.closeSync(descriptor);
        fs.rmSync(tempPath, { force: true });
        throw new Error('refusing to write a non-regular temporary file');
      }
      return { descriptor, tempPath };
    } catch (error) {
      if (error && error.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new Error('could not create a unique temporary file');
}

function atomicWriteFile(repoRoot, filePath, content, encoding = 'utf-8', mode) {
  assertSafeRepoWritePath(repoRoot, filePath);
  let tempPath;
  let descriptor;
  try {
    ({ descriptor, tempPath } = createTemporaryFile(repoRoot, filePath));
    fs.writeFileSync(descriptor, content, encoding);
    if (mode !== undefined) fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    try {
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      if (error && error.code === 'EPERM') throw new AtomicRenamePermissionError(error);
      throw error;
    }
    tempPath = undefined;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (tempPath !== undefined) fs.rmSync(tempPath, { force: true });
  }
}

function readExistingFile(repoRoot, filePath, encoding) {
  assertSafeRepoWritePath(repoRoot, filePath);
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | NOFOLLOW);
  } catch (error) {
    if (error && error.code === 'ENOENT') return { exists: false, content: '' };
    throw error;
  }
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.nlink !== 1) throw new Error('refusing to append through a non-regular file');
    return { exists: true, content: fs.readFileSync(descriptor, encoding), mode: stat.mode & 0o777 };
  } finally {
    fs.closeSync(descriptor);
  }
}

function atomicAppendFile(repoRoot, filePath, content, encoding = 'utf-8') {
  const existing = readExistingFile(repoRoot, filePath, encoding);
  atomicWriteFile(repoRoot, filePath, existing.content + content, encoding);
}

function isAtomicRenamePermissionError(error) {
  return error instanceof AtomicRenamePermissionError;
}

module.exports = { atomicAppendFile, atomicWriteFile, isAtomicRenamePermissionError, readExistingFile };
