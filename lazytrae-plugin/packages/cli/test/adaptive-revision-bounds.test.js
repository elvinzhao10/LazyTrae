'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REVISION_MODULE = require.resolve('../src/lib/adaptive-revision');
const SHA = /^sha256:[0-9a-f]{64}$/;

function loadRevision(spawnSync = null) {
  delete require.cache[REVISION_MODULE];
  if (!spawnSync) return require(REVISION_MODULE);
  const original = childProcess.spawnSync;
  childProcess.spawnSync = spawnSync;
  try {
    return require(REVISION_MODULE);
  } finally {
    childProcess.spawnSync = original;
  }
}

function runGit(root, args) {
  const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function makeGitFixture(prefix = 'lazytrae-revision-bounds-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  runGit(root, ['init', '-q']);
  runGit(root, ['config', 'user.email', 'adaptive@example.invalid']);
  runGit(root, ['config', 'user.name', 'Adaptive Test']);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'baseline\n');
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-qm', 'fixture']);
  return root;
}

function assertAvailableFingerprint(value) {
  assert.equal(value.status, 'available');
  assert.match(value.digest, SHA);
}

test('clean Git material produces a deterministic available revision fingerprint', (t) => {
  // Given: a clean committed repository.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-clean-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // When: the same revision is fingerprinted twice.
  const first = revision.computeRevisionFingerprint(root);
  const second = revision.computeRevisionFingerprint(root);

  // Then: both observations are available and byte-identical.
  assertAvailableFingerprint(first);
  assert.deepEqual(second, first);
});

test('staged Git material produces a deterministic available revision fingerprint', (t) => {
  // Given: a committed repository with a staged content change.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-staged-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = revision.computeRevisionFingerprint(root);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'staged\n');
  runGit(root, ['add', 'tracked.txt']);

  // When: the staged revision is fingerprinted twice.
  const first = revision.computeRevisionFingerprint(root);
  const second = revision.computeRevisionFingerprint(root);

  // Then: staged bytes contribute to one stable available digest.
  assertAvailableFingerprint(first);
  assert.deepEqual(second, first);
  assert.notEqual(first.digest, clean.digest);
});

test('tracked working material produces a deterministic available revision fingerprint', (t) => {
  // Given: a committed repository with an unstaged tracked change.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-working-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = revision.computeRevisionFingerprint(root);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'working\n');

  // When: the tracked-working revision is fingerprinted twice.
  const first = revision.computeRevisionFingerprint(root);
  const second = revision.computeRevisionFingerprint(root);

  // Then: tracked working bytes contribute to one stable available digest.
  assertAvailableFingerprint(first);
  assert.deepEqual(second, first);
  assert.notEqual(first.digest, clean.digest);
});

test('untracked Git material produces a deterministic available revision fingerprint', (t) => {
  // Given: a committed repository with one nonignored untracked file.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-untracked-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = revision.computeRevisionFingerprint(root);
  fs.writeFileSync(path.join(root, 'untracked.txt'), 'untracked\n');

  // When: the untracked revision is fingerprinted twice.
  const first = revision.computeRevisionFingerprint(root);
  const second = revision.computeRevisionFingerprint(root);

  // Then: the path and bytes contribute to one stable available digest.
  assertAvailableFingerprint(first);
  assert.deepEqual(second, first);
  assert.notEqual(first.digest, clean.digest);
});

test('safe untracked names beginning with two dots remain fingerprintable', (t) => {
  // Given: a valid in-repository name that resembles, but is not, a parent traversal.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-dot-prefix-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '..safe.txt'), 'safe\n');

  // When: the repository revision is fingerprinted.
  const result = revision.computeRevisionFingerprint(root);

  // Then: lexical containment accepts the safe name.
  assertAvailableFingerprint(result);
});

test('non-Git directories have an unavailable revision fingerprint', (t) => {
  // Given: a real directory that is not inside a Git repository.
  const revision = loadRevision();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-revision-non-git-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // When/Then: revision identity fails closed without manufacturing a digest.
  assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
});

test('timed-out git revision collection fails closed and passes a bounded timeout', (t) => {
  const calls = [];
  const revision = loadRevision((...args) => {
    calls.push(args);
    return {
      status: null,
      signal: 'SIGTERM',
      error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }),
      stdout: null,
    };
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-revision-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
  assert.equal(calls.length, 4);
  assert.equal(calls.every(call => call[0] === 'git'), true);
  assert.equal(calls.every(call => Number.isInteger(call[2].timeout)), true);
  assert.equal(calls.every(call => call[2].timeout > 0 && call[2].timeout <= 30_000), true);
});

test('oversized untracked files are rejected before their bytes are read', (t) => {
  const revision = loadRevision();
  const root = makeGitFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oversized = path.join(root, 'oversized.bin');
  fs.writeFileSync(oversized, Buffer.alloc(revision.MAX_UNTRACKED_FILE_BYTES + 1, 0x78));
  const oversizedReal = fs.realpathSync.native(oversized);

  const originalReadFileSync = fs.readFileSync;
  let attemptedRead = false;
  fs.readFileSync = function readFileSync(target, ...args) {
    if (path.resolve(target) === oversizedReal) attemptedRead = true;
    return originalReadFileSync.call(this, target, ...args);
  };
  try {
    assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
  assert.equal(attemptedRead, false);
});

test('untracked reads recheck stale metadata through a bounded nonblocking descriptor', (t) => {
  // Given: a small untracked file that grows past the bound immediately after lstat.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-growth-race-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'growing.bin');
  fs.writeFileSync(target, 'small\n');
  const resolvedTarget = fs.realpathSync.native(target);
  const originalLstatSync = fs.lstatSync;
  const originalOpenSync = fs.openSync;
  const originalReadFileSync = fs.readFileSync;
  let swapped = false;
  let unboundedRead = false;
  let openFlags = null;
  fs.lstatSync = function lstatSync(filePath, ...args) {
    const stat = originalLstatSync.call(this, filePath, ...args);
    if (!swapped && path.resolve(filePath) === resolvedTarget) {
      fs.writeFileSync(target, Buffer.alloc(revision.MAX_UNTRACKED_FILE_BYTES + 1, 0x72));
      swapped = true;
    }
    return stat;
  };
  fs.openSync = function openSync(filePath, flags, ...args) {
    if (path.resolve(filePath) === resolvedTarget) openFlags = flags;
    return originalOpenSync.call(this, filePath, flags, ...args);
  };
  fs.readFileSync = function readFileSync(filePath, ...args) {
    if (path.resolve(filePath) === resolvedTarget) unboundedRead = true;
    return originalReadFileSync.call(this, filePath, ...args);
  };

  // When: revision identity is collected across the metadata/content race.
  let result;
  try {
    result = revision.computeRevisionFingerprint(root);
  } finally {
    fs.lstatSync = originalLstatSync;
    fs.openSync = originalOpenSync;
    fs.readFileSync = originalReadFileSync;
  }

  // Then: it fails closed without a full path read or a potentially blocking open.
  assert.equal(swapped, true);
  assert.deepEqual(result, { status: 'unavailable', digest: null });
  assert.equal(unboundedRead, false);
  assert.notEqual(openFlags, null);
  assert.equal((openFlags & fs.constants.O_NONBLOCK) !== 0, true);
  assert.equal((openFlags & fs.constants.O_NOFOLLOW) !== 0, true);
});

test('unreadable untracked files fail closed', (t) => {
  // Given: an untracked file whose bytes cannot be read.
  const revision = loadRevision();
  const root = makeGitFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const unreadable = path.join(root, 'unreadable.txt');
  fs.writeFileSync(unreadable, 'blocked\n');
  const unreadableReal = fs.realpathSync.native(unreadable);
  const originalOpenSync = fs.openSync;
  fs.openSync = function openSync(target, ...args) {
    if (path.resolve(target) === unreadableReal) {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    }
    return originalOpenSync.call(this, target, ...args);
  };

  // When/Then: the read failure makes revision identity unavailable.
  try {
    assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
  } finally {
    fs.openSync = originalOpenSync;
  }
});

test('too many untracked files fail closed before file contents are read', () => {
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-count-bound-');
  const originalReadFileSync = fs.readFileSync;
  let attemptedRead = false;
  try {
    for (let index = 0; index <= revision.MAX_UNTRACKED_FILE_COUNT; index += 1) {
      fs.writeFileSync(path.join(root, `untracked-${index}.txt`), 'x');
    }
    fs.readFileSync = function readFileSync(target, ...args) {
      if (path.resolve(target).startsWith(`${path.resolve(root)}${path.sep}`)) attemptedRead = true;
      return originalReadFileSync.call(this, target, ...args);
    };

    assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
    assert.equal(attemptedRead, false);
  } finally {
    fs.readFileSync = originalReadFileSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('aggregate untracked byte bound fails closed after individually bounded files', () => {
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-total-bound-');
  const bytes = Buffer.alloc(revision.MAX_UNTRACKED_FILE_BYTES, 0x79);
  try {
    const fileCount = Math.floor(revision.MAX_UNTRACKED_TOTAL_BYTES / revision.MAX_UNTRACKED_FILE_BYTES) + 1;
    for (let index = 0; index < fileCount; index += 1) {
      fs.writeFileSync(path.join(root, `untracked-${index}.bin`), bytes);
    }

    assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('untracked material deadline exhaustion fails closed', () => {
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-deadline-bound-');
  const originalNow = Date.now;
  try {
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'untracked\n');
    let now = 0;
    Date.now = () => {
      now += revision.MAX_UNTRACKED_DEADLINE_MS + 1;
      return now;
    };

    assert.deepEqual(revision.computeRevisionFingerprint(root), { status: 'unavailable', digest: null });
  } finally {
    Date.now = originalNow;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('revision collection never executes configured textconv filters', (t) => {
  // Given: a real repository with a converter that creates an execution sentinel.
  const revision = loadRevision();
  const root = makeGitFixture('lazytrae-revision-textconv-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sentinel = path.join(root, 'textconv-executed');
  const filter = path.join(root, 'textconv-filter.js');
  fs.writeFileSync(filter, [
    "'use strict';",
    "const fs = require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(sentinel)}, 'executed\\n');`,
    "process.stdout.write(fs.readFileSync(process.argv[2]));",
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, '.gitattributes'), 'tracked.txt diff=sentinel\n');
  runGit(root, ['config', 'diff.sentinel.textconv', `${process.execPath} ${filter}`]);
  runGit(root, ['add', '.gitattributes', 'textconv-filter.js']);
  runGit(root, ['commit', '-qm', 'add textconv fixture']);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'dirty\n');

  // When: revision freshness is evaluated.
  revision.computeRevisionFingerprint(root);

  // Then: repository-controlled text conversion never executes.
  assert.equal(fs.existsSync(sentinel), false);
});
