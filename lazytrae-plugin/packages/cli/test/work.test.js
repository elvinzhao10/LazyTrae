const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

test('work install and status manage a global-style Trae Work skills directory', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-skills-'));
  try {
    const install = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, /17 installed, 0 updated, 0 already current/);
    assert.match(install.stdout, /Settings → MCP/);
    assert.equal(fs.existsSync(path.join(skillsDir, 'lazy-ulw-plan', 'SKILL.md')), true);

    const status = runCli(['work', 'status', '--skills-dir', skillsDir]);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /17\/17 current, 0 missing, 0 outdated/);

    fs.writeFileSync(path.join(skillsDir, 'lazy-ulw-plan', 'SKILL.md'), 'stale\n');
    const stale = runCli(['work', 'status', '--skills-dir', skillsDir]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /16\/17 current, 0 missing, 1 outdated/);

    const repair = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(repair.status, 0, repair.stderr);
    assert.match(repair.stdout, /0 installed, 1 updated, 16 already current/);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('work rejects incomplete and unknown commands', () => {
  const missingDir = runCli(['work', 'install', '--skills-dir']);
  assert.equal(missingDir.status, 1);
  assert.match(missingDir.stderr, /--skills-dir requires a path/);

  const unknown = runCli(['work', 'unknown']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown Trae Work command/);
});
