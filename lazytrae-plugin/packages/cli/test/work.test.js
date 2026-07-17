const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { run: init } = require('../src/commands/init');
const { install, listSkills, readSkillsDir, skillState } = require('../src/commands/work');
const { runCli } = require('./test-helpers');

const STAGING_PREFIX = '.lazytrae-work-install-';

function skillFile(skillsDir, name) {
  return path.join(skillsDir, name, 'SKILL.md');
}

function stagingEntries(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir).filter(name => name.startsWith(STAGING_PREFIX));
}

function withPatchedFs(method, replacement, action) {
  const original = fs[method];
  fs[method] = (...args) => replacement(original, ...args);
  try {
    return action();
  } finally {
    fs[method] = original;
  }
}

function withWorkingDirectory(directory, action) {
  const previous = process.cwd();
  process.chdir(directory);
  try {
    return action();
  } finally {
    process.chdir(previous);
  }
}

function captureConsole(action) {
  const original = console.log;
  const lines = [];
  console.log = (...values) => lines.push(values.join(' '));
  try {
    action();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

test('work resolves its documented macOS skills directory only on macOS', () => {
  if (process.platform === 'darwin') {
    assert.equal(readSkillsDir([]), path.join(os.homedir(), '.trae-cn', 'skills'));
    return;
  }
  assert.throws(() => readSkillsDir([]), /only known on macOS/);
});

test('work install and status manage a global-style Trae Work skills directory', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-skills-'));
  const skillCount = listSkills().length;
  try {
    const install = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, new RegExp(`${skillCount} installed, 0 updated, 0 already current`));
    assert.match(install.stdout, /Settings → MCP/);
    assert.equal(fs.existsSync(path.join(skillsDir, 'lazy-ulw-plan', 'SKILL.md')), true);
    const sessionsSkill = fs.readFileSync(path.join(skillsDir, 'lazy-coding-agent-sessions', 'SKILL.md'), 'utf8');
    assert.match(sessionsSkill, /Global Trae Work fallback/);
    assert.doesNotMatch(sessionsSkill, /lazycodex\/plugins/);
    const migrationSkill = fs.readFileSync(path.join(skillsDir, 'lazy-migration-planner', 'SKILL.md'), 'utf8');
    assert.doesNotMatch(migrationSkill, /lazycodex|\bomo\b/i);
    assert.match(migrationSkill, /Global Trae Work fallback/);
    assert.doesNotMatch(migrationSkill, /docs\/lazytrae-(architecture-plan|host-adaptation-map|parity-ledger)\.md/);

    const status = runCli(['work', 'status', '--skills-dir', skillsDir]);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, new RegExp(`${skillCount}\/${skillCount} current, 0 missing, 0 outdated`));

    fs.writeFileSync(path.join(skillsDir, 'lazy-ulw-plan', 'SKILL.md'), 'stale\n');
    const stale = runCli(['work', 'status', '--skills-dir', skillsDir]);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, new RegExp(`${skillCount - 1}\/${skillCount} current, 0 missing, 1 outdated`));

    const repair = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(repair.status, 0, repair.stderr);
    assert.match(repair.stdout, new RegExp(`0 installed, 1 updated, ${skillCount - 1} already current`));
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('work lifecycle help does not mutate its explicit skills directory', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-help-'));
  try {
    const installHelp = runCli(['work', 'install', '--help', '--skills-dir', skillsDir]);
    assert.equal(installHelp.status, 0, installHelp.stderr);
    assert.match(installHelp.stdout, /Usage: lazytrae work <command> \[options\]/);
    assert.deepEqual(fs.readdirSync(skillsDir), []);

    const install = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(install.status, 0, install.stderr);
    const skillsBeforeHelp = fs.readdirSync(skillsDir).sort();
    const contentBeforeHelp = skillsBeforeHelp.map(name => fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8'));

    const uninstallHelp = runCli(['work', 'uninstall', '--help', '--skills-dir', skillsDir]);
    assert.equal(uninstallHelp.status, 0, uninstallHelp.stderr);
    assert.match(uninstallHelp.stdout, /Usage: lazytrae work <command> \[options\]/);
    assert.deepEqual(fs.readdirSync(skillsDir).sort(), skillsBeforeHelp);
    assert.deepEqual(
      skillsBeforeHelp.map(name => fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8')),
      contentBeforeHelp,
    );

    const uninstall = runCli(['work', 'uninstall', '--skills-dir', skillsDir]);
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.deepEqual(fs.readdirSync(skillsDir), []);
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

test('init rejects a cwd without an ancestor Git root before project or Work mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-no-git-'));
  const project = path.join(root, 'no-git');
  const skillsDir = path.join(root, 'skills');
  fs.mkdirSync(project);

  try {
    // Given: an ordinary directory with no `.git` entry anywhere beneath the fixture root.
    // When: Work initialization is requested from that directory.
    const result = runCli(['init', '--host', 'work', '--skills-dir', skillsDir], { cwd: project });

    // Then: the command fails before either project or global Work assets are created.
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /Git project/i);
    assert.doesNotMatch(result.stdout, /(?:^|\n)Done\.(?:\n|$)/);
    for (const relative of ['.trae', '.lazytrae', 'AGENTS.md']) {
      assert.equal(fs.existsSync(path.join(project, relative)), false, `${relative} was unexpectedly created`);
    }
    assert.equal(fs.existsSync(skillsDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('child-directory init selects the nearest Git root and prints Done only after readiness', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-child-init-'));
  const project = path.join(root, 'project');
  const child = path.join(project, 'nested', 'child');
  const skillsDir = path.join(root, 'skills');
  const unrelated = path.join(project, 'unrelated.txt');
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  fs.mkdirSync(child, { recursive: true });
  fs.writeFileSync(unrelated, 'caller-owned\n');

  try {
    // Given: a dirty project and an invocation two directories below its nearest `.git` root.
    // When: Work initialization succeeds end to end.
    const result = runCli(['init', '--host', 'work', '--skills-dir', skillsDir], { cwd: child });

    // Then: project selection is stable, caller content survives, and terminal success is last.
    assert.equal(result.status, 0, result.stderr);
    const expectedRoot = fs.realpathSync(project);
    assert.match(result.stdout, new RegExp(`Repo root: ${expectedRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.equal(fs.readFileSync(unrelated, 'utf8'), 'caller-owned\n');
    assert.equal((result.stdout.match(/(?:^|\n)Done\.(?:\n|$)/g) || []).length, 1);
    const readinessIndex = result.stdout.indexOf('Package readiness passed.');
    assert.notEqual(readinessIndex, -1);
    assert.ok(readinessIndex < result.stdout.indexOf('Done.'));
    assert.deepEqual(stagingEntries(skillsDir), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Work staged-copy failure leaves every destination untouched and removes staging', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-stage-failure-'));
  let stagedCopies = 0;

  try {
    // Given: a clean skills root whose second transaction-owned staging copy fails.
    // When: the Work installer stages its changed skills.
    assert.throws(() => withPatchedFs('copyFileSync', (original, source, destination, ...args) => {
      if (destination.includes(`${path.sep}${STAGING_PREFIX}`)) {
        stagedCopies += 1;
        if (stagedCopies === 2) throw new Error('fixture staged-copy failure');
      }
      return original(source, destination, ...args);
    }, () => install(skillsDir)), /fixture staged-copy failure/);

    // Then: no destination was promoted and the failed staging root is gone.
    assert.equal(stagedCopies, 2);
    assert.equal(listSkills().some(name => fs.existsSync(skillFile(skillsDir, name))), false);
    assert.deepEqual(stagingEntries(skillsDir), []);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('Work promotion failure restores stale bytes and modes and permits a clean retry', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-promotion-failure-'));
  const [first, second] = listSkills();
  const firstPath = skillFile(skillsDir, first);
  const secondPath = skillFile(skillsDir, second);
  fs.mkdirSync(path.dirname(firstPath), { recursive: true });
  fs.mkdirSync(path.dirname(secondPath), { recursive: true });
  fs.writeFileSync(firstPath, 'first stale bytes\n', { mode: 0o640 });
  fs.writeFileSync(secondPath, 'second stale bytes\n', { mode: 0o600 });
  let injected = false;

  try {
    // Given: two stale destinations and a one-shot failure promoting the second skill.
    // When: promotion fails after the first stale skill was replaced.
    assert.throws(() => withPatchedFs('linkSync', (original, source, destination) => {
      if (!injected && destination === secondPath) {
        injected = true;
        throw new Error('fixture promotion failure');
      }
      return original(source, destination);
    }, () => install(skillsDir)), /fixture promotion failure/);

    // Then: rollback restores exact stale state and the same root can be retried successfully.
    assert.equal(fs.readFileSync(firstPath, 'utf8'), 'first stale bytes\n');
    assert.equal(fs.statSync(firstPath).mode & 0o777, 0o640);
    assert.equal(fs.readFileSync(secondPath, 'utf8'), 'second stale bytes\n');
    assert.equal(fs.statSync(secondPath).mode & 0o777, 0o600);
    assert.deepEqual(stagingEntries(skillsDir), []);

    install(skillsDir);
    assert.equal(listSkills().filter(name => skillState(skillsDir, name) === 'current').length, listSkills().length);
    assert.deepEqual(stagingEntries(skillsDir), []);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('Work rollback preserves a concurrent edit to a transaction-owned destination', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-concurrent-edit-'));
  const [first, second] = listSkills();
  const firstPath = skillFile(skillsDir, first);
  const secondPath = skillFile(skillsDir, second);
  let injected = false;

  try {
    // Given: a concurrent caller edit that lands after the first promotion and before a later failure.
    // When: the second promotion fails and rollback inspects the first destination.
    assert.throws(() => withPatchedFs('linkSync', (original, source, destination) => {
      if (!injected && destination === secondPath) {
        injected = true;
        fs.writeFileSync(firstPath, 'concurrent caller edit\n');
        throw new Error('fixture later promotion failure');
      }
      return original(source, destination);
    }, () => install(skillsDir)), /fixture later promotion failure/);

    // Then: rollback removes only matching transaction content and preserves the caller's bytes.
    assert.equal(fs.readFileSync(firstPath, 'utf8'), 'concurrent caller edit\n');
    assert.equal(fs.existsSync(secondPath), false);
    assert.deepEqual(stagingEntries(skillsDir), []);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('Work rollback preserves a replacement inode with identical promoted bytes and mode', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-replaced-inode-'));
  const [first, second] = listSkills();
  const firstPath = skillFile(skillsDir, first);
  const secondPath = skillFile(skillsDir, second);
  const displacedPath = path.join(skillsDir, '.fixture-promoted-inode');
  let expectedContent;
  let expectedMode;
  let failure;
  let promotedIdentity;
  let replacementIdentity;
  fs.mkdirSync(path.dirname(firstPath), { recursive: true });
  fs.mkdirSync(path.dirname(secondPath), { recursive: true });
  fs.writeFileSync(firstPath, 'first stale bytes\n', { mode: 0o640 });
  fs.writeFileSync(secondPath, 'second stale bytes\n', { mode: 0o600 });

  try {
    // Given: a caller replaces the first promoted destination with a distinct inode
    // containing the same bytes and mode before promotion of the second skill fails.
    try {
      withPatchedFs('linkSync', (original, source, destination) => {
        if (destination === secondPath) {
          const promoted = fs.lstatSync(firstPath);
          expectedContent = fs.readFileSync(firstPath);
          expectedMode = promoted.mode & 0o777;
          promotedIdentity = { dev: promoted.dev, ino: promoted.ino };
          original(firstPath, displacedPath);
          fs.unlinkSync(firstPath);
          fs.writeFileSync(firstPath, expectedContent, { mode: expectedMode });
          fs.chmodSync(firstPath, expectedMode);
          const replacement = fs.lstatSync(firstPath);
          replacementIdentity = { dev: replacement.dev, ino: replacement.ino };
          fs.unlinkSync(displacedPath);
          throw new Error('fixture later promotion failure after inode replacement');
        }
        return original(source, destination);
      }, () => install(skillsDir));
    } catch (error) {
      failure = error;
    }

    // When: rollback evaluates ownership and the installation is retried.
    assert.notDeepEqual(replacementIdentity, promotedIdentity);

    // Then: caller identity and content survive, cleanup completes, and retry reaches 17/17.
    const preserved = fs.lstatSync(firstPath);
    assert.deepEqual({ dev: preserved.dev, ino: preserved.ino }, replacementIdentity);
    assert.ok(failure);
    assert.match(failure.message, /fixture later promotion failure after inode replacement/);
    assert.match(failure.message, /preserved caller content/);
    assert.equal(fs.readFileSync(firstPath).equals(expectedContent), true);
    assert.equal(preserved.mode & 0o777, expectedMode);
    assert.deepEqual(stagingEntries(skillsDir), []);
    install(skillsDir);
    assert.equal(listSkills().filter(name => skillState(skillsDir, name) === 'current').length, listSkills().length);
    assert.deepEqual(stagingEntries(skillsDir), []);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('Work installation reports both promotion and staging-cleanup failures', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-cleanup-failure-'));
  const secondPath = skillFile(skillsDir, listSkills()[1]);
  const originalLink = fs.linkSync;
  const originalRemove = fs.rmSync;
  let injected = false;
  let failure;

  try {
    // Given: a promotion error followed by an inability to remove transaction staging.
    fs.linkSync = (source, destination) => {
      if (!injected && destination === secondPath) {
        injected = true;
        throw new Error('fixture primary promotion failure');
      }
      return originalLink(source, destination);
    };
    fs.rmSync = (target, options) => {
      if (path.basename(target).startsWith(STAGING_PREFIX)) {
        throw new Error('fixture staging cleanup failure');
      }
      return originalRemove(target, options);
    };

    // When: the transaction attempts failure cleanup.
    try {
      install(skillsDir);
    } catch (error) {
      failure = error;
    }
  } finally {
    fs.linkSync = originalLink;
    fs.rmSync = originalRemove;
  }

  try {
    // Then: neither error is hidden and the retained staging root makes incomplete cleanup observable.
    assert.ok(failure);
    assert.match(failure.message, /fixture primary promotion failure/);
    assert.match(failure.message, /fixture staging cleanup failure/);
    assert.equal(stagingEntries(skillsDir).length, 1);
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('init does not run Work installation or print Done after an earlier project-copy failure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-earlier-init-failure-'));
  const project = path.join(root, 'project');
  const skillsDir = path.join(root, 'skills');
  const modifiedCommand = path.join(project, '.trae', 'commands', 'lazy-start-work.md');
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  fs.mkdirSync(path.dirname(modifiedCommand), { recursive: true });
  fs.writeFileSync(modifiedCommand, 'caller-modified command\n');

  try {
    // Given: project copying records a nonzero status for a protected modified command.
    // When: Work init reaches that earlier failure.
    const result = runCli(['init', '--host', 'work', '--skills-dir', skillsDir], { cwd: project });

    // Then: the modified file survives and no later global mutation or terminal success is emitted.
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(modifiedCommand, 'utf8'), 'caller-modified command\n');
    assert.equal(fs.existsSync(skillsDir), false);
    assert.doesNotMatch(result.stdout, /(?:^|\n)Done\.(?:\n|$)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('init preserves valid project and Work assets but omits Done when load-check fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-load-failure-'));
  const project = path.join(root, 'project');
  const skillsDir = path.join(root, 'skills');
  const loadCheck = require('../src/commands/load-check');
  const originalLoadCheck = loadCheck.run;
  const previousExitCode = process.exitCode;
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });

  try {
    // Given: project copying and Work installation succeed but the required load-check returns nonzero.
    loadCheck.run = () => {
      console.log('fixture load-check failure');
      return 23;
    };

    // When: init completes the required steps in order.
    const output = withWorkingDirectory(project, () => captureConsole(() =>
      init(['--host', 'work', '--skills-dir', skillsDir])));

    // Then: valid assets remain available for repair, while terminal success is withheld.
    assert.match(output, /fixture load-check failure/);
    assert.doesNotMatch(output, /(?:^|\n)Done\.(?:\n|$)/);
    assert.equal(fs.existsSync(path.join(project, '.trae', 'skills', 'lazy-ulw-plan', 'SKILL.md')), true);
    assert.equal(listSkills().filter(name => skillState(skillsDir, name) === 'current').length, listSkills().length);
    assert.equal(process.exitCode, 23);
  } finally {
    loadCheck.run = originalLoadCheck;
    process.exitCode = previousExitCode;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
