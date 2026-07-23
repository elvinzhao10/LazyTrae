'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAX_GIT_OUTPUT = 64 * 1024 * 1024;
const GIT_TIMEOUT_MS = 5_000;
const MAX_UNTRACKED_FILE_BYTES = 1024 * 1024;
const MAX_UNTRACKED_FILE_COUNT = 4_096;
const MAX_UNTRACKED_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_UNTRACKED_DEADLINE_MS = 1_000;

function gitBytes(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: MAX_GIT_OUTPUT,
    timeout: GIT_TIMEOUT_MS,
  });
  if (result.status !== 0 || result.error || !Buffer.isBuffer(result.stdout)) return null;
  return result.stdout;
}

function addSection(hash, name, bytes) {
  const label = Buffer.from(name, 'utf8');
  hash.update(Buffer.from(`${label.length}:`, 'ascii'));
  hash.update(label);
  hash.update(Buffer.from(`:${bytes.length}:`, 'ascii'));
  hash.update(bytes);
}

function sameFileSnapshot(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function readBoundedRegularFile(filePath, deadline) {
  const { O_NOFOLLOW, O_NONBLOCK, O_RDONLY } = fs.constants;
  if (![O_NOFOLLOW, O_NONBLOCK, O_RDONLY].every(Number.isInteger)) return null;
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile()
      || before.size < 0n
      || before.size > BigInt(MAX_UNTRACKED_FILE_BYTES)
      || Date.now() >= deadline) {
      return null;
    }
    const buffer = Buffer.allocUnsafe(MAX_UNTRACKED_FILE_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      if (Date.now() >= deadline) return null;
      const count = fs.readSync(
        descriptor,
        buffer,
        offset,
        buffer.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (offset > MAX_UNTRACKED_FILE_BYTES
      || BigInt(offset) !== before.size
      || !sameFileSnapshot(before, after)) {
      return null;
    }
    return { bytes: buffer.subarray(0, offset), mode: Number(before.mode) };
  } catch (_) {
    return null;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function untrackedMaterial(repoRoot, listing) {
  const deadline = Date.now() + MAX_UNTRACKED_DEADLINE_MS;
  const names = listing.toString('utf8').split('\0').filter(Boolean);
  if (names.length > MAX_UNTRACKED_FILE_COUNT || Date.now() >= deadline) return null;
  names.sort();
  const hash = crypto.createHash('sha256');
  let totalBytes = 0;
  for (const name of names) {
    if (Date.now() >= deadline) return null;
    const absolute = path.resolve(repoRoot, name);
    const relative = path.relative(repoRoot, absolute);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch (_) {
      return null;
    }
    let bytes;
    let mode = stat.mode;
    if (stat.isSymbolicLink()) {
      bytes = Buffer.from(fs.readlinkSync(absolute), 'utf8');
      if (totalBytes > MAX_UNTRACKED_TOTAL_BYTES - bytes.length) return null;
    }
    else if (stat.isFile()) {
      if (!Number.isSafeInteger(stat.size) || stat.size > MAX_UNTRACKED_FILE_BYTES) return null;
      if (totalBytes > MAX_UNTRACKED_TOTAL_BYTES - stat.size) return null;
      const file = readBoundedRegularFile(absolute, deadline);
      if (!file) return null;
      ({ bytes, mode } = file);
      if (totalBytes > MAX_UNTRACKED_TOTAL_BYTES - bytes.length) return null;
    }
    else return null;
    if (Date.now() >= deadline) return null;
    totalBytes += bytes.length;
    addSection(hash, `path:${name}:mode:${mode}`, bytes);
  }
  return hash.digest();
}

function computeRevisionFingerprint(repoRoot) {
  try {
    const root = fs.realpathSync.native(repoRoot);
    const head = gitBytes(root, ['rev-parse', '--verify', 'HEAD']);
    const staged = gitBytes(root, ['diff', '--binary', '--no-ext-diff', '--no-textconv', '--no-color', '--cached', 'HEAD']);
    const working = gitBytes(root, ['diff', '--binary', '--no-ext-diff', '--no-textconv', '--no-color']);
    const listing = gitBytes(root, ['ls-files', '--others', '--exclude-standard', '-z']);
    if (!head || !staged || !working || !listing) {
      return { status: 'unavailable', digest: null };
    }
    const untracked = untrackedMaterial(root, listing);
    if (!untracked) return { status: 'unavailable', digest: null };
    const hash = crypto.createHash('sha256');
    addSection(hash, 'committed-base', head);
    addSection(hash, 'staged-content', staged);
    addSection(hash, 'tracked-working-content', working);
    addSection(hash, 'nonignored-untracked-content', untracked);
    return { status: 'available', digest: `sha256:${hash.digest('hex')}` };
  } catch (_) {
    return { status: 'unavailable', digest: null };
  }
}

module.exports = {
  computeRevisionFingerprint,
  GIT_TIMEOUT_MS,
  MAX_UNTRACKED_FILE_BYTES,
  MAX_UNTRACKED_FILE_COUNT,
  MAX_UNTRACKED_TOTAL_BYTES,
  MAX_UNTRACKED_DEADLINE_MS,
};
