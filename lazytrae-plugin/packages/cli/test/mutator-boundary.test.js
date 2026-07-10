const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

function fixture(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

test('persistent mutators reject symlink escapes and member traversal', () => {
  const root = fixture('lazytrae-mutator-boundary-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mutator-outside-'));
  const escaped = path.join(path.dirname(root), `${path.basename(root)}-escaped`);
  try {
    fs.mkdirSync(path.join(outside, 'team'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'team', 'team.json'), JSON.stringify({ teamName: 'team', status: 'archived', members: [] }));
    fs.writeFileSync(path.join(outside, 'team', 'sentinel'), 'outside team sentinel\n');
    fs.symlinkSync(outside, path.join(root, '.lazytraework'));

    const deleted = runCli(['team', 'delete', 'ignored', '--force'], { cwd: root });
    assert.equal(deleted.status, 1, deleted.stdout + deleted.stderr);
    assert.match(deleted.stderr, /outside the repo root/);
    assert.equal(fs.existsSync(path.join(outside, 'team', 'sentinel')), true);

    const uninstalled = runCli(['uninstall', '--yes', '--purge-state'], { cwd: root });
    assert.equal(uninstalled.status, 1, uninstalled.stdout + uninstalled.stderr);
    assert.match(uninstalled.stderr, /outside the repo root/);
    assert.equal(fs.existsSync(path.join(outside, 'team', 'sentinel')), true);

    fs.unlinkSync(path.join(root, '.lazytraework'));
    assert.equal(runCli(['team', 'create', '--name', 'team'], { cwd: root }).status, 0);
    const traversal = runCli(['team', 'spawn', 'ignored', '--id', `../../../../${path.basename(escaped)}`, '--focus', 'escape', '--lens', 'area'], { cwd: root });
    assert.equal(traversal.status, 1, traversal.stdout + traversal.stderr);
    assert.equal(fs.existsSync(escaped), false);
    assert.equal(runCli(['team', 'spawn', 'ignored', '--id', 'member-1', '--focus', 'safe', '--lens', 'area'], { cwd: root }).status, 0);
    assert.equal(fs.existsSync(path.join(root, '.lazytraework', 'team', 'members', 'member-1')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(escaped, { recursive: true, force: true });
  }
});
