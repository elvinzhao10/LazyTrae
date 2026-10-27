'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertSafeRepoWritePath } = require('./path-boundary');

class DashboardError extends Error {
  constructor(code, status = 422) { super(code); this.code = code; this.status = status; }
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const protectedPath = name => /^(?:\.lazytrae\/(?:dashboard|state\/transactions)|\.git)(?:\/|$)/i.test(name);
function safeRead(root, relative, limit = 8 * 1024 * 1024) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(x => !x || x === '.' || x === '..')) throw new DashboardError('UNSAFE_REFERENCE');
  const target = assertSafeRepoWritePath(root, path.join(root, relative));
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1 || before.size > limit) throw new DashboardError('UNSAFE_REFERENCE');
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(assertSafeRepoWritePath(root, target));
    if (before.ino !== current.ino || before.dev !== current.dev || after.size !== before.size || after.mtimeMs !== before.mtimeMs || bytes.length > limit) throw new DashboardError('REFERENCE_CHANGED');
    return bytes;
  } finally { fs.closeSync(fd); }
}
function readJSON(root, name, fallback) {
  try { return JSON.parse(safeRead(root, name)); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
function privateDirectory(root, relative) {
  const target = assertSafeRepoWritePath(root, path.join(root, relative));
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.mode & 0o077 || (process.getuid && stat.uid !== process.getuid())) throw new DashboardError('PRIVATE_DIRECTORY_REQUIRED');
  return target;
}
function privateRead(root, name) {
  const bytes = safeRead(root, name, 65536);
  const stat = fs.lstatSync(path.join(root, name));
  if (stat.mode & 0o077 || (process.getuid && stat.uid !== process.getuid())) throw new DashboardError('PRIVATE_FILE_REQUIRED');
  return bytes;
}
module.exports = { DashboardError, hash, json, protectedPath, safeRead, readJSON, privateDirectory, privateRead };
