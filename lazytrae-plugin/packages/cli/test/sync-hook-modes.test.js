const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT, runCli } = require('./test-helpers');

const EXECUTABLE_HOOKS = [
  'post-tool-use.sh',
  'pre-tool-use.sh',
  'recover-context.sh',
  'session-start.sh',
  'stop.sh',
  'user-prompt-submit.sh',
];

function modeOf(filePath) {
  return fs.statSync(filePath).mode & 0o777;
}

test('sync preserves every known executable hook mode when updating managed templates', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-sync-hook-modes-'));
  fs.mkdirSync(path.join(fixture, '.git'));

  try {
    // Given: a fresh project with managed hook files that need a template update.
    const init = runCli(['init'], { cwd: fixture });
    assert.equal(init.status, 0, init.stderr);
    const userHookPath = path.join(fixture, '.trae', 'hooks', 'user-hook.sh');
    fs.writeFileSync(userHookPath, '#!/usr/bin/env bash\n');
    fs.chmodSync(userHookPath, 0o644);
    for (const hook of EXECUTABLE_HOOKS) {
      fs.appendFileSync(path.join(fixture, '.trae', 'hooks', hook), '\n# stale hook content\n');
    }

    // When: sync replaces the changed hooks from their package templates.
    const sync = runCli(['sync'], { cwd: fixture });
    assert.equal(sync.status, 0, sync.stderr);

    // Then: each template-designated executable hook remains executable.
    for (const hook of EXECUTABLE_HOOKS) {
      const templatePath = path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'hooks', hook);
      const installedPath = path.join(fixture, '.trae', 'hooks', hook);
      assert.equal(modeOf(installedPath), modeOf(templatePath), `${hook} lost its template mode during sync`);
      assert.equal(modeOf(installedPath) & 0o111, 0o111, `${hook} must remain executable after sync`);
    }
    assert.equal(modeOf(userHookPath), 0o644, 'sync must not make an unmanaged user hook executable');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
