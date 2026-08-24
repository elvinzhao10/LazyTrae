const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { runCli } = require('./test-helpers');

function writeExecutable(root, invocationLog) {
  const target = path.join(root, 'TraeWork');
  fs.writeFileSync(target, [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> "${invocationLog}"`,
    "printf 'Trae Work 5.0.0 region=global edition=enterprise\\n'",
    '',
  ].join('\n'), { mode: 0o755 });
  return target;
}

function digest(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

function initializeLinkedWorktree(root) {
  const repository = path.join(root, 'repository');
  const worktree = path.join(root, 'linked-worktree');
  fs.mkdirSync(repository);
  execFileSync('git', ['init', '-q', repository]);
  execFileSync('git', ['-C', repository, 'config', 'user.name', 'LazyTrae Test']);
  execFileSync('git', ['-C', repository, 'config', 'user.email', 'test@lazytrae.invalid']);
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'tracked\n');
  execFileSync('git', ['-C', repository, 'add', 'tracked.txt']);
  execFileSync('git', ['-C', repository, 'commit', '-qm', 'fixture']);
  execFileSync('git', ['-C', repository, 'worktree', 'add', '-q', '-b', 'fixture-linked', worktree]);
  return worktree;
}

test('work profile rejects a forged probe report and fake Git metadata', () => {
  // Given: a non-repository with a fake .git directory and caller-authored matching report.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-forged-probe-'));
  const skills = path.join(root, 'skills');
  const worktree = path.join(root, 'not-a-repo');
  const probe = path.join(root, 'forged.json');
  fs.mkdirSync(skills);
  fs.mkdirSync(path.join(worktree, '.git'), { recursive: true });
  fs.writeFileSync(probe, '{"schema_version":1,"product":"trae","host":"work","status":"accessible","capabilities":[{"name":"local-worktree","status":"accessible"}]}\n');
  try {
    // When: the forged report is supplied through the real Work CLI.
    const result = runCli([
      'work', 'profile', '--client', 'desktop', '--execution', 'local',
      '--skills-dir', skills, '--worktree', worktree, '--probe', probe,
    ]);

    // Then: no verified descriptor is emitted for a path Git itself rejects.
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unsupported Work profile option '--probe'|real Git worktree/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work profile verifies a real linked Git worktree with the bounded Work probe', () => {
  // Given: a real linked Git worktree and an absolute fingerprint-pinned Work executable.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-real-probe-'));
  const skills = path.join(root, 'skills');
  const invocations = path.join(root, 'invocations.txt');
  fs.mkdirSync(skills);
  const worktree = initializeLinkedWorktree(root);
  const executable = writeExecutable(root, invocations);
  try {
    // When: the local profile probes Git and Work in the same CLI invocation.
    const result = runCli([
      'work', 'profile', '--client', 'desktop', '--execution', 'local',
      '--skills-dir', skills, '--worktree', worktree, '--executable', executable,
      '--expected-sha256', digest(executable),
    ]);

    // Then: the descriptor contains immutable Git/host fingerprints and only allowlisted probe argv ran.
    assert.equal(result.status, 0, result.stderr);
    const descriptor = JSON.parse(result.stdout);
    assert.equal(descriptor.worktree.mode, 'local-probe-verified');
    assert.equal(descriptor.worktree.path, fs.realpathSync(worktree));
    assert.match(descriptor.worktree.head_sha, /^[0-9a-f]{40}$/);
    assert.equal(descriptor.probe.binary_sha256, digest(executable));
    assert.deepEqual(descriptor.probe.observed_argv, [['--version'], ['--help']]);
    assert.deepEqual(fs.readFileSync(invocations, 'utf8').trim().split('\n'), ['--version', '--help']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work profile rejects fake Git metadata before running the bounded Work probe', () => {
  // Given: a non-repository with a fake .git directory and a valid pinned Work executable.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-fake-git-'));
  const skills = path.join(root, 'skills');
  const worktree = path.join(root, 'not-a-repo');
  const invocations = path.join(root, 'invocations.txt');
  fs.mkdirSync(skills);
  fs.mkdirSync(path.join(worktree, '.git'), { recursive: true });
  const executable = writeExecutable(root, invocations);
  try {
    // When: the profile validates the selected path before host introspection.
    const result = runCli([
      'work', 'profile', '--client', 'desktop', '--execution', 'local',
      '--skills-dir', skills, '--worktree', worktree, '--executable', executable,
      '--expected-sha256', digest(executable),
    ]);

    // Then: Git rejection is fatal and the Work executable is never invoked.
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /real Git worktree/);
    assert.equal(fs.existsSync(invocations), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work profile refuses a changed Work binary fingerprint', () => {
  // Given: a real linked worktree and a Work executable with the wrong expected fingerprint.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-changed-probe-'));
  const skills = path.join(root, 'skills');
  const invocations = path.join(root, 'invocations.txt');
  fs.mkdirSync(skills);
  const worktree = initializeLinkedWorktree(root);
  const executable = writeExecutable(root, invocations);
  try {
    // When: the profile receives a mismatched immutable executable fingerprint.
    const result = runCli([
      'work', 'profile', '--client', 'desktop', '--execution', 'local',
      '--skills-dir', skills, '--worktree', worktree, '--executable', executable,
      '--expected-sha256', '0'.repeat(64),
    ]);

    // Then: it refuses before executing Work and emits no descriptor.
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(fs.existsSync(invocations), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
