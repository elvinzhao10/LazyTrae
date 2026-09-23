'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { acquire, release, renew } = require('../src/lib/execution-isolation');

const MINUTE = 60_000;

function fixture(root, taskId, session, now, overrides = {}) {
  return acquire(root, {
    taskId,
    session,
    ownerPid: overrides.ownerPid ?? process.pid,
    workspace: root,
    direct: overrides.direct ?? true,
    mutationRequiresWorktree: overrides.mutationRequiresWorktree ?? false,
  }, {
    now: () => now,
    isPidAlive: overrides.isPidAlive ?? (() => true),
    isWorkspaceClean: overrides.isWorkspaceClean ?? (() => true),
  });
}

function git(workspace, args) {
  const result = spawnSync('git', ['-C', workspace, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function gitWorkspace(root) {
  const workspace = path.join(root, 'workspace');
  const isolation = path.join(root, 'isolation');
  fs.mkdirSync(workspace);
  fs.mkdirSync(isolation);
  git(workspace, ['init', '--quiet']);
  git(workspace, ['config', 'user.email', 'lazytrae@example.invalid']);
  git(workspace, ['config', 'user.name', 'LazyTrae Test']);
  fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'tracked\n');
  git(workspace, ['add', 'tracked.txt']);
  git(workspace, ['commit', '--quiet', '-m', 'fixture']);
  return { isolation, workspace };
}

function recreateWorktreeAfterEmptyCheck(action) {
  const originalRmdir = fs.rmdirSync;
  let injected = false;
  fs.rmdirSync = (target, ...args) => {
    const result = originalRmdir(target, ...args);
    if (!injected && path.basename(target) === 'worktree') {
      injected = true;
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'arrived-after-empty-check.txt'), 'preserve me');
    }
    return result;
  };
  try {
    action();
  } finally {
    fs.rmdirSync = originalRmdir;
  }
  assert.equal(injected, true, 'the regression seam must recreate the worktree after rmdir');
}

test('task isolation assigns distinct task-owned paths and ports', () => {
  // Given: two independent direct tasks sharing one isolation root.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-distinct-'));
  try {
    // When: both tasks acquire leases.
    const first = fixture(root, 'task-a', 'session-a', 1_700_000_000_000);
    const second = fixture(root, 'task-b', 'session-b', 1_700_000_000_000);

    // Then: every mutable surface is task-owned and the ports differ.
    for (const key of ['evidence', 'build', 'cache', 'state', 'worktree']) {
      assert.notEqual(first.namespace.paths[key], second.namespace.paths[key]);
      assert.equal(first.namespace.paths[key].startsWith(first.namespace.root), true);
      assert.equal(second.namespace.paths[key].startsWith(second.namespace.root), true);
    }
    assert.notEqual(first.namespace.port, second.namespace.port);
    assert.equal(first.execution.actors, 1);
    assert.equal(first.execution.worktree_provisioned, false);
    assert.equal(fs.existsSync(first.namespace.paths.worktree), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task isolation renews a fifteen minute lease inside its five minute renewal window', () => {
  // Given: a lease with four minutes remaining.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-renew-'));
  const acquiredAt = 1_700_000_000_000;
  try {
    const lease = fixture(root, 'task-renew', 'session-renew', acquiredAt);

    // When: its owner renews it.
    const renewed = renew(root, 'task-renew', {
      session: 'session-renew', ownerPid: process.pid,
    }, { now: () => acquiredAt + (11 * MINUTE), isPidAlive: () => true });

    // Then: acquisition stays fixed and expiry advances by exactly fifteen minutes.
    assert.equal(renewed.acquired_at, lease.acquired_at);
    assert.equal(renewed.renewed_at, new Date(acquiredAt + (11 * MINUTE)).toISOString());
    assert.equal(renewed.expires_at, new Date(acquiredAt + (26 * MINUTE)).toISOString());
    assert.equal(renewed.renewal_due_at, new Date(acquiredAt + (21 * MINUTE)).toISOString());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task isolation blocks live, expired-live, and expired-dirty collisions', () => {
  // Given: one acquired namespace whose lease later appears expired.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-block-'));
  const acquiredAt = 1_700_000_000_000;
  try {
    fixture(root, 'task-shared', 'owner-session', acquiredAt, { ownerPid: 4242 });

    // When/Then: a live owner blocks before and after expiration.
    assert.throws(() => fixture(root, 'task-shared', 'contender-a', acquiredAt + MINUTE, {
      ownerPid: 5252, isPidAlive: () => true,
    }), error => error.code === 'LEASE_COLLISION');
    assert.throws(() => fixture(root, 'task-shared', 'contender-b', acquiredAt + (16 * MINUTE), {
      ownerPid: 5252, isPidAlive: () => true,
    }), error => error.code === 'LEASE_EXPIRED_OWNER_LIVE');

    // When/Then: a dead owner still blocks recovery from a dirty workspace.
    assert.throws(() => fixture(root, 'task-shared', 'contender-c', acquiredAt + (16 * MINUTE), {
      ownerPid: 5252, isPidAlive: () => false, isWorkspaceClean: () => false,
    }), error => error.code === 'LEASE_EXPIRED_WORKSPACE_DIRTY');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task isolation recovers only an expired dead clean lease and cleans its namespace', () => {
  // Given: an expired lease owned by a dead process in a clean workspace.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-recover-'));
  const acquiredAt = 1_700_000_000_000;
  try {
    const stale = fixture(root, 'task-recover', 'old-session', acquiredAt, { ownerPid: 4242 });
    fs.writeFileSync(path.join(stale.namespace.paths.build, 'stale.txt'), 'stale');

    // When: a contender acquires after expiry.
    const recovered = fixture(root, 'task-recover', 'new-session', acquiredAt + (16 * MINUTE), {
      ownerPid: 5252, isPidAlive: () => false, isWorkspaceClean: () => true,
    });

    // Then: stale content is gone and the new owner can release every task/port artifact.
    assert.equal(recovered.owner.session, 'new-session');
    assert.equal(fs.existsSync(path.join(recovered.namespace.paths.build, 'stale.txt')), false);
    release(root, 'task-recover', { session: 'new-session', ownerPid: 5252 });
    assert.equal(fs.existsSync(recovered.namespace.root), false);
    assert.equal(fs.existsSync(path.join(root, 'lazytrae', 'ports', `${recovered.namespace.port}.json`)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task isolation rejects malformed identifiers before filesystem mutation', () => {
  // Given: an empty isolation root and traversal-shaped identifiers.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-id-'));
  try {
    // When/Then: neither task nor session traversal reaches the filesystem.
    assert.throws(() => fixture(root, '../escape', 'session', 1_700_000_000_000), /taskId/);
    assert.throws(() => fixture(root, 'task', '..', 1_700_000_000_000), /session/);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('task isolation refuses dirty inheritance when a mutation needs a worktree namespace', () => {
  // Given: a mutation request whose caller workspace is dirty.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-dirty-inheritance-'));
  try {
    // When/Then: acquisition blocks before creating task or port state.
    assert.throws(() => fixture(root, 'task-dirty', 'session-dirty', 1_700_000_000_000, {
      mutationRequiresWorktree: true,
      isWorkspaceClean: () => false,
    }), error => error.code === 'WORKSPACE_DIRTY');
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a requested worktree allocates an empty task-owned directory without claiming Git worktree isolation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-worktree-allocation-'));
  try {
    const lease = fixture(root, 'task-worktree', 'session-worktree', 1_700_000_000_000, {
      mutationRequiresWorktree: true,
    });
    assert.deepEqual(lease.execution.worktree, {
      requested: true,
      directory_allocated: true,
      created: false,
      verified: false,
      provisioned: false,
      path: lease.namespace.paths.worktree,
      git_directory: null,
      head: null,
      base: null,
      ownership: {
        task_id: 'task-worktree',
        session: 'session-worktree',
        path: lease.namespace.paths.worktree,
      },
    });
    assert.equal(lease.execution.worktree_provisioned, false);
    assert.equal(fs.statSync(lease.namespace.paths.worktree).isDirectory(), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an untracked caller file blocks mutation allocation and is preserved', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-untracked-root-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-untracked-workspace-'));
  const callerFile = path.join(workspace, 'caller-untracked.txt');
  try {
    assert.equal(spawnSync('git', ['init', '--quiet', workspace]).status, 0);
    fs.writeFileSync(callerFile, 'preserve me');
    assert.throws(() => acquire(root, {
      taskId: 'task-untracked',
      session: 'session-untracked',
      ownerPid: process.pid,
      workspace,
      direct: true,
      mutationRequiresWorktree: true,
    }), error => error.code === 'WORKSPACE_DIRTY');
    assert.equal(fs.readFileSync(callerFile, 'utf8'), 'preserve me');
    assert.equal(fs.existsSync(path.join(root, 'lazytrae')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('release preserves a non-empty worktree allocation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-worktree-preservation-'));
  try {
    const lease = fixture(root, 'task-preserve', 'session-preserve', 1_700_000_000_000, {
      ownerPid: 4242,
      mutationRequiresWorktree: true,
    });
    const preserved = path.join(lease.namespace.paths.worktree, 'untracked.txt');
    fs.writeFileSync(preserved, 'preserve me');
    assert.throws(() => release(root, 'task-preserve', { session: 'session-preserve', ownerPid: 4242 }),
      error => error.code === 'WORKTREE_NOT_EMPTY');
    assert.equal(fs.readFileSync(preserved, 'utf8'), 'preserve me');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('expired-lease recovery preserves a non-empty worktree allocation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-worktree-recovery-'));
  const acquiredAt = 1_700_000_000_000;
  try {
    const lease = fixture(root, 'task-recover-preserve', 'session-preserve', acquiredAt, {
      ownerPid: 4242,
      mutationRequiresWorktree: true,
    });
    const preserved = path.join(lease.namespace.paths.worktree, 'untracked.txt');
    fs.writeFileSync(preserved, 'preserve me');
    assert.throws(() => fixture(root, 'task-recover-preserve', 'session-new', acquiredAt + (16 * MINUTE), {
      ownerPid: 5252,
      isPidAlive: () => false,
      isWorkspaceClean: () => true,
    }), error => error.code === 'LEASE_EXPIRED_WORKTREE_NOT_EMPTY');
    assert.equal(fs.readFileSync(preserved, 'utf8'), 'preserve me');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release preserves a real Git worktree that this allocator did not create or verify', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-real-worktree-'));
  let workspace;
  let worktree;
  try {
    const setup = gitWorkspace(root);
    workspace = setup.workspace;
    const lease = acquire(setup.isolation, {
      taskId: 'task-real-worktree',
      session: 'session-real-worktree',
      ownerPid: process.pid,
      workspace,
      direct: true,
      mutationRequiresWorktree: true,
    });
    worktree = lease.namespace.paths.worktree;
    fs.rmdirSync(worktree);
    git(workspace, ['worktree', 'add', '--quiet', '--detach', worktree, 'HEAD']);
    assert.throws(() => release(setup.isolation, 'task-real-worktree', {
      session: 'session-real-worktree', ownerPid: process.pid,
    }), error => error.code === 'WORKTREE_NOT_EMPTY');
    assert.equal(git(worktree, ['rev-parse', '--is-inside-work-tree']), 'true');
  } finally {
    if (workspace && worktree && fs.existsSync(worktree)) {
      spawnSync('git', ['-C', workspace, 'worktree', 'remove', '--force', worktree], { encoding: 'utf8' });
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release preserves a symlink substituted for the task-owned allocation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-symlink-'));
  try {
    const lease = fixture(root, 'task-symlink', 'session-symlink', 1_700_000_000_000, {
      mutationRequiresWorktree: true,
    });
    const callerDirectory = path.join(root, 'caller-owned');
    const sentinel = path.join(callerDirectory, 'sentinel.txt');
    fs.mkdirSync(callerDirectory);
    fs.writeFileSync(sentinel, 'preserve me\n');
    fs.rmdirSync(lease.namespace.paths.worktree);
    fs.symlinkSync(callerDirectory, lease.namespace.paths.worktree);
    assert.throws(() => release(root, 'task-symlink', { session: 'session-symlink', ownerPid: process.pid }),
      error => error.code === 'WORKTREE_OWNERSHIP_MISMATCH');
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me\n');
    assert.equal(fs.lstatSync(lease.namespace.paths.worktree).isSymbolicLink(), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a malformed worktree ownership lease fails closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-malformed-owner-'));
  try {
    const lease = fixture(root, 'task-malformed-owner', 'session-malformed-owner', 1_700_000_000_000, {
      mutationRequiresWorktree: true,
    });
    const leasePath = path.join(lease.namespace.root, 'lease.json');
    const malformed = JSON.parse(fs.readFileSync(leasePath, 'utf8'));
    malformed.execution.worktree.ownership.path = path.join(root, 'caller-owned');
    fs.writeFileSync(leasePath, `${JSON.stringify(malformed)}\n`);
    assert.throws(() => release(root, 'task-malformed-owner', {
      session: 'session-malformed-owner', ownerPid: process.pid,
    }), error => error.code === 'LEASE_INVALID');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release preserves a worktree recreated after its empty check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-release-recreate-'));
  try {
    const lease = fixture(root, 'task-release-recreate', 'session-release-recreate', 1_700_000_000_000, {
      mutationRequiresWorktree: true,
    });
    const lateFile = path.join(lease.namespace.paths.worktree, 'arrived-after-empty-check.txt');
    recreateWorktreeAfterEmptyCheck(() => assert.throws(() => release(root, 'task-release-recreate', {
      session: 'session-release-recreate', ownerPid: process.pid,
    }), error => error.code === 'WORKTREE_NOT_EMPTY'));
    assert.equal(fs.readFileSync(lateFile, 'utf8'), 'preserve me');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('expired recovery preserves a worktree recreated after its empty check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-isolation-recovery-recreate-'));
  const acquiredAt = 1_700_000_000_000;
  try {
    const lease = fixture(root, 'task-recovery-recreate', 'session-stale', acquiredAt, {
      ownerPid: 4242,
      mutationRequiresWorktree: true,
    });
    const lateFile = path.join(lease.namespace.paths.worktree, 'arrived-after-empty-check.txt');
    recreateWorktreeAfterEmptyCheck(() => assert.throws(() => fixture(root, 'task-recovery-recreate', 'session-new', acquiredAt + (16 * MINUTE), {
      ownerPid: 5252,
      isPidAlive: () => false,
      isWorkspaceClean: () => true,
    }), error => error.code === 'LEASE_EXPIRED_WORKTREE_NOT_EMPTY'));
    assert.equal(fs.readFileSync(lateFile, 'utf8'), 'preserve me');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
