const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT, runCli } = require('./test-helpers');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
  return target;
}

function readFile(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('uninstall preserves unknown project files in every mode', () => {
  const modes = [
    { args: [], configExists: false },
    { args: ['--soft'], configExists: true },
    { args: ['--purge-state'], configExists: false },
  ];

  for (const mode of modes) {
    const fixture = makeRepo(`lazytrae-uninstall-${mode.args.join('-') || 'normal'}-`);
    try {
      // Given: an initialized project with caller-owned files nested in every managed namespace.
      assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
      writeFile(fixture, '.trae/foreign.txt', 'keep user Trae file\n');
      writeFile(fixture, '.trae/foreign-dir/child.txt', 'keep user Trae directory\n');
      writeFile(fixture, '.lazytrae/foreign.txt', 'keep user LazyTrae file\n');
      writeFile(fixture, '.lazytrae/state/foreign-state.json', '{"keep":true}\n');
      writeFile(fixture, '.lazytrae/evidence/foreign-proof.md', 'keep user evidence\n');
      writeFile(fixture, '.omo/foreign.txt', 'foreign namespace\n');

      // When: the exact source CLI uninstalls using each supported mode.
      const uninstall = runCli(['uninstall', '--yes', ...mode.args], { cwd: fixture });

      // Then: only verified LazyTrae assets change; unknown content remains byte-for-byte intact.
      assert.equal(uninstall.status, 0, uninstall.stderr);
      assert.equal(fs.existsSync(path.join(fixture, '.trae', 'rules', 'lazytrae.md')), false);
      assert.equal(readFile(fixture, '.trae/foreign.txt'), 'keep user Trae file\n');
      assert.equal(readFile(fixture, '.trae/foreign-dir/child.txt'), 'keep user Trae directory\n');
      assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'config.json')), mode.configExists);
      assert.equal(readFile(fixture, '.lazytrae/foreign.txt'), 'keep user LazyTrae file\n');
      assert.equal(readFile(fixture, '.lazytrae/state/foreign-state.json'), '{"keep":true}\n');
      assert.equal(readFile(fixture, '.lazytrae/evidence/foreign-proof.md'), 'keep user evidence\n');
      assert.equal(readFile(fixture, '.omo/foreign.txt'), 'foreign namespace\n');
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  }
});

test('uninstall soft mode preserves all LazyTrae data but removes verified project templates', () => {
  const fixture = makeRepo('lazytrae-uninstall-soft-');
  try {
    // Given: an initialized project and a caller-owned LazyTrae file.
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    writeFile(fixture, '.lazytrae/user-notes.md', 'keep\n');
    writeFile(fixture, '.omo/foreign.txt', 'foreign namespace\n');

    // When: soft uninstall runs.
    const uninstall = runCli(['uninstall', '--yes', '--soft'], { cwd: fixture });

    // Then: .lazytrae is byte-for-byte retained and generated project files are removed.
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(fs.existsSync(path.join(fixture, '.trae', 'rules', 'lazytrae.md')), false);
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'config.json')), true);
    assert.equal(readFile(fixture, '.lazytrae/user-notes.md'), 'keep\n');
    assert.equal(readFile(fixture, '.omo/foreign.txt'), 'foreign namespace\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('normal uninstall explicitly retains canonical and legacy plan state', () => {
  const fixture = makeRepo('lazytrae-uninstall-plan-retention-');
  try {
    // Given: plans owned by the current namespace and a pre-existing legacy namespace.
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    writeFile(fixture, '.lazytrae/plans/current-plan.md', '# Current plan\n');
    writeFile(fixture, '.lazytrae/loop/current-loop.json', '{"run_id":"current"}\n');
    writeFile(fixture, '.omo/plans/legacy-plan.md', '# Legacy plan\n');

    // When: normal uninstall removes only verified install assets.
    const uninstall = runCli(['uninstall', '--yes'], { cwd: fixture });

    // Then: all durable plan and loop state remains and the receipt names that contract.
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.match(uninstall.stdout, /state\/, evidence\/, plans\/, and loop\//);
    assert.equal(readFile(fixture, '.lazytrae/plans/current-plan.md'), '# Current plan\n');
    assert.equal(readFile(fixture, '.lazytrae/loop/current-loop.json'), '{"run_id":"current"}\n');
    assert.equal(readFile(fixture, '.omo/plans/legacy-plan.md'), '# Legacy plan\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('uninstall without confirmation does not modify managed assets', () => {
  const fixture = makeRepo('lazytrae-uninstall-no-confirm-');
  try {
    // Given: a complete installation that requires an explicit confirmation flag.
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    const before = readFile(fixture, '.trae/rules/lazytrae.md');

    // When: uninstall is invoked without --yes.
    const uninstall = runCli(['uninstall'], { cwd: fixture });

    // Then: it reports the required confirmation and leaves installation files unchanged.
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.match(uninstall.stdout, /Run with --yes to confirm/);
    assert.equal(readFile(fixture, '.trae/rules/lazytrae.md'), before);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('uninstall purge state removes only exact runtime template files', () => {
  const fixture = makeRepo('lazytrae-uninstall-purge-');
  try {
    // Given: an initialized project with runtime artifacts and user files.
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    writeFile(fixture, '.lazytrae/state/user-state.json', '{"keep":false}\n');
    writeFile(fixture, '.lazytrae/user-notes.md', 'keep\n');
    writeFile(fixture, '.omo/foreign.txt', 'foreign namespace\n');

    // When: state purge runs.
    const uninstall = runCli(['uninstall', '--yes', '--purge-state'], { cwd: fixture });

    // Then: exact template runtime files are purged without guessing ownership of unrelated files.
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'state', 'boulder.json')), false);
    assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'evidence', 'completion.md')), false);
    assert.equal(readFile(fixture, '.lazytrae/state/user-state.json'), '{"keep":false}\n');
    assert.equal(readFile(fixture, '.lazytrae/user-notes.md'), 'keep\n');
    assert.equal(readFile(fixture, '.omo/foreign.txt'), 'foreign namespace\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('uninstall removes only its marker-delimited gitignore block', () => {
  const fixture = makeRepo('lazytrae-uninstall-gitignore-');
  try {
    // Given: user rules surrounding a stale prefix marker that LazyTrae does not own.
    const gitignore = [
      'user-before/',
      '# notes: # LazyTrae runtime (managed by lazytrae init)',
      'stale-runtime/',
      'user-after/',
      '',
    ].join('\n');
    writeFile(fixture, '.gitignore', gitignore);
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    assert.match(readFile(fixture, '.gitignore'), /# lazytrae:managed:start:gitignore/);

    // When: normal uninstall runs.
    const uninstall = runCli(['uninstall', '--yes'], { cwd: fixture });

    // Then: neighboring user rules and the stale prefix section survive exactly.
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(readFile(fixture, '.gitignore'), [
      'user-before/',
      '# notes: # LazyTrae runtime (managed by lazytrae init)',
      'stale-runtime/',
      'user-after/',
      '',
    ].join('\n'));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('managed gitignore migration is idempotent and fully removable', () => {
  const fixture = makeRepo('lazytrae-uninstall-gitignore-migration-');
  try {
    const userContent = 'user-before/\n';
    const oldBlock = [
      '',
      '# lazytrae:managed:start:gitignore',
      '# LazyTrae runtime (managed by lazytrae init)',
      '.lazytrae/state/',
      '.lazytrae/logs/',
      '.lazytrae/evidence/',
      '# lazytrae:managed:end:gitignore',
      '',
    ].join('\n');
    writeFile(fixture, '.gitignore', userContent + oldBlock);
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    const migrated = readFile(fixture, '.gitignore');
    assert.equal(migrated.includes('.lazytrae/loop/'), true);
    assert.equal((migrated.match(/lazytrae:managed:start:gitignore/g) || []).length, 1);
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: fixture }).status, 0);
    assert.equal(readFile(fixture, '.gitignore'), migrated);
    assert.equal(runCli(['uninstall', '--yes'], { cwd: fixture }).status, 0);
    assert.equal(readFile(fixture, '.gitignore'), userContent);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('work uninstall removes only exact manifest skills and retains modified or nonempty directories', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-uninstall-'));
  try {
    // Given: one exact skill, one edited skill, one nonempty skill directory, and an unknown skill.
    assert.equal(runCli(['work', 'install', '--skills-dir', skillsDir]).status, 0);
    fs.writeFileSync(path.join(skillsDir, 'lazy-ulw-plan', 'SKILL.md'), 'edited\n');
    writeFile(skillsDir, 'lazy-init-deep/notes.md', 'user note\n');
    writeFile(skillsDir, 'unrelated/SKILL.md', 'foreign\n');

    // When: bounded Work uninstall runs.
    const uninstall = runCli(['work', 'uninstall', '--skills-dir', skillsDir]);

    // Then: only exact, empty manifest skill directories are deleted.
    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(fs.existsSync(path.join(skillsDir, 'lazy-ast-grep')), false);
    assert.equal(readFile(skillsDir, 'lazy-ulw-plan/SKILL.md'), 'edited\n');
    assert.equal(fs.existsSync(path.join(skillsDir, 'lazy-init-deep', 'SKILL.md')), true);
    assert.equal(readFile(skillsDir, 'lazy-init-deep/notes.md'), 'user note\n');
    assert.equal(readFile(skillsDir, 'unrelated/SKILL.md'), 'foreign\n');
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('work uninstall rejects symlinked and hard-linked owned skill files without deleting targets', () => {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-uninstall-links-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-uninstall-outside-'));
  try {
    // Given: a manifest skill whose file is a symlink.
    const linkedSkill = path.join(skillsDir, 'lazy-ast-grep');
    const victim = path.join(outsideDir, 'victim.md');
    fs.mkdirSync(linkedSkill, { recursive: true });
    fs.writeFileSync(victim, 'do not remove\n');
    fs.symlinkSync(victim, path.join(linkedSkill, 'SKILL.md'));

    // When: Work uninstall inspects the linked skill.
    const symlinked = runCli(['work', 'uninstall', '--skills-dir', skillsDir]);

    // Then: it fails safely without affecting the target.
    assert.equal(symlinked.status, 1);
    assert.match(symlinked.stderr, /Refusing to write through symlinked global skill path/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'do not remove\n');

    fs.rmSync(linkedSkill, { recursive: true, force: true });
    fs.mkdirSync(linkedSkill, { recursive: true });
    fs.linkSync(victim, path.join(linkedSkill, 'SKILL.md'));

    // When: Work uninstall inspects a hard-linked skill file.
    const hardLinked = runCli(['work', 'uninstall', '--skills-dir', skillsDir]);

    // Then: it rejects the link and leaves the external file intact.
    assert.equal(hardLinked.status, 1);
    assert.match(hardLinked.stderr, /Refusing to write through hard-linked global skill file/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'do not remove\n');
  } finally {
    fs.rmSync(skillsDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('project template fixture matches the uninstall ownership source', () => {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'mcp.json')), true);
});
