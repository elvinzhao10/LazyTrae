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
    const sessionsSkill = fs.readFileSync(path.join(skillsDir, 'lazy-coding-agent-sessions', 'SKILL.md'), 'utf8');
    assert.match(sessionsSkill, /Global Trae Work fallback/);
    assert.doesNotMatch(sessionsSkill, /lazycodex\/plugins/);
    const migrationSkill = fs.readFileSync(path.join(skillsDir, 'lazy-migration-planner', 'SKILL.md'), 'utf8');
    assert.match(migrationSkill, /optional user-provided LazyCodex checkout/);
    assert.match(migrationSkill, /Global Trae Work fallback/);
    assert.doesNotMatch(migrationSkill, /docs\/lazytrae-(architecture-plan|host-adaptation-map|parity-ledger)\.md/);

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

test('work install rejects unsafe destination SKILL.md links without touching targets', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-symlink-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-outside-'));
  const victim = path.join(skillsDir, 'victim.txt');
  const skillDir = path.join(skillsDir, 'lazy-ast-grep');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(victim, 'do not overwrite\n');
  fs.symlinkSync(victim, path.join(skillDir, 'SKILL.md'));

  try {
    const regularLink = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(regularLink.status, 1);
    assert.match(regularLink.stderr, /Refusing to write through symlinked global skill path/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'do not overwrite\n');
    assert.equal(fs.existsSync(path.join(skillsDir, 'lazy-coding-agent-sessions', 'SKILL.md')), false);

    fs.rmSync(skillDir, { recursive: true, force: true });
    fs.mkdirSync(skillDir, { recursive: true });
    fs.symlinkSync(path.join(skillsDir, 'missing-target'), path.join(skillDir, 'SKILL.md'));
    const danglingLink = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(danglingLink.status, 1);
    assert.match(danglingLink.stderr, /Refusing to write through symlinked global skill path/);
    assert.equal(fs.existsSync(path.join(skillsDir, 'missing-target')), false);

    fs.rmSync(skillDir, { recursive: true, force: true });
    fs.mkdirSync(skillDir, { recursive: true });
    const outsideVictim = path.join(outsideDir, 'victim.txt');
    fs.writeFileSync(outsideVictim, 'do not overwrite hard links\n');
    fs.linkSync(outsideVictim, path.join(skillDir, 'SKILL.md'));
    const hardLink = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(hardLink.status, 1);
    assert.match(hardLink.stderr, /Refusing to write through hard-linked global skill file/);
    assert.equal(fs.readFileSync(outsideVictim, 'utf8'), 'do not overwrite hard links\n');
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('init validates host before mutation and uses a custom Trae Work skills directory for its load check', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-init-'));
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-init-skills-'));
  fs.mkdirSync(path.join(fixture, '.git'));

  try {
    const invalidHost = runCli(['init', '--host', 'unsupported'], { cwd: fixture });
    assert.equal(invalidHost.status, 1);
    assert.match(invalidHost.stderr, /--host must be ide, work, or cli/);
    assert.equal(fs.existsSync(path.join(fixture, '.trae')), false);

    const initialized = runCli(['init', '--host', 'work', '--skills-dir', skillsDir], { cwd: fixture });
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.match(initialized.stdout, /17 installed, 0 updated, 0 already current/);
    assert.match(initialized.stdout, /PASS global Trae Work skills: 17\/17 current/);
    assert.equal(fs.existsSync(path.join(skillsDir, 'lazy-coding-agent-sessions', 'SKILL.md')), true);

    const directCheck = runCli(['load-check', '--host', 'work', '--skills-dir', skillsDir], { cwd: fixture });
    assert.equal(directCheck.status, 0, directCheck.stderr);
    assert.match(directCheck.stdout, /PASS global Trae Work skills: 17\/17 current/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});
