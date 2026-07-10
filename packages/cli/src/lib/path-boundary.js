const fs = require('fs');
const path = require('path');

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveRepoPath(repoRoot, relativePath, options = {}) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    return { ok: false, error: 'path must be a non-empty string' };
  }
  if (path.isAbsolute(relativePath)) {
    return { ok: false, error: 'path must be repo-relative' };
  }

  const root = fs.realpathSync.native(repoRoot);
  const absolute = path.resolve(root, relativePath);
  if (!isInside(root, absolute)) {
    return { ok: false, error: 'path must stay inside the repo root' };
  }
  if (!fs.existsSync(absolute)) {
    return options.mustExist
      ? { ok: false, error: `path does not exist: ${relativePath}` }
      : { ok: true, path: absolute, exists: false };
  }

  const real = fs.realpathSync.native(absolute);
  if (!isInside(root, real)) {
    return { ok: false, error: 'path resolves outside the repo root' };
  }
  return { ok: true, path: real, exists: true };
}

function requireRepoFile(repoRoot, relativePath) {
  const resolved = resolveRepoPath(repoRoot, relativePath, { mustExist: true });
  if (!resolved.ok) throw new Error(resolved.error);
  const stat = fs.statSync(resolved.path);
  if (!stat.isFile()) throw new Error(`path is not a file: ${relativePath}`);
  if (stat.size <= 0) throw new Error(`path is empty: ${relativePath}`);
  return resolved.path;
}

function assertSafeRepoWritePath(repoRoot, targetPath) {
  const lexicalRoot = path.resolve(repoRoot);
  const root = fs.realpathSync.native(lexicalRoot);
  const absolute = path.resolve(targetPath);
  if (!isInside(lexicalRoot, absolute)) throw new Error('write path must stay inside the repo root');
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error('write path has no existing ancestor');
    ancestor = parent;
  }
  if (!isInside(root, fs.realpathSync.native(ancestor))) {
    throw new Error('write path resolves outside the repo root');
  }
  return absolute;
}

module.exports = { assertSafeRepoWritePath, requireRepoFile, resolveRepoPath };
