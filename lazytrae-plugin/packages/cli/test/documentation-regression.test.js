const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../../..');

function assertInitDeepSafety(content, initDeepPath) {
  assert.doesNotMatch(content, /corrupted or unparseable:\s*treat as --create-new/i, `${initDeepPath} must reject the unsafe malformed-file fallback`);
  assert.doesNotMatch(content, /delete all existing AGENTS\.md files and regenerate from scratch/i, `${initDeepPath} must not present deletion as an automatic mode`);
  assert.doesNotMatch(content, /update existing AGENTS\.md/i, `${initDeepPath} must not ambiguously update a user-owned AGENTS.md`);
  assert.doesNotMatch(content, /copy (its )?existing content/i, `${initDeepPath} must not describe a non-byte-exact backup`);
  assert.doesNotMatch(content, /(?:each |the )?existing user-owned AGENTS\.md body|AGENTS\.md body is user-owned/i, `${initDeepPath} must not claim blanket ownership of the whole AGENTS.md body`);
  assert.match(content, /outside.*delimited.*managed.*block.*user-owned|user-owned.*outside.*delimited.*managed.*block/is, `${initDeepPath} must identify content outside managed blocks as user-owned`);
  assert.match(content, /delimited.*managed.*block.*package-owned|package-owned.*delimited.*managed.*block/is, `${initDeepPath} must identify the managed block as package-owned`);
  assert.match(content, /byte-for-byte/i, `${initDeepPath} must preserve and back up content byte-for-byte`);
  assert.match(content, /separate(?:ly)? confirm/i, `${initDeepPath} must require a separately confirmed destructive request`);
  assert.match(content, /exact AGENTS\.md files/i, `${initDeepPath} must list the exact replacement targets`);
  assert.match(content, /backup.*confirmed original|confirmed original.*backup/is, `${initDeepPath} must back up every confirmed original`);
  assert.match(content, /release-owned local command.*init.*(?:updates?|replaces?).*complete.*delimited.*managed.*block.*appends?.*new.*delimited.*managed.*block/is, `${initDeepPath} must accurately describe managed-block update and append behavior`);
  assert.match(content, /preserv(?:e|ing).*all\s+existing\s+surrounding\s+bytes|all\s+existing\s+surrounding\s+bytes.*preserv/is, `${initDeepPath} must preserve all bytes outside the managed block`);
  assert.doesNotMatch(content, /(?:if|when).*delimited block is absent.*leave the file unchanged/i, `${initDeepPath} must not claim an absent managed block leaves AGENTS.md unchanged`);
}

function assertManagedAstGrepGuidance(content, skillPath) {
  assert.doesNotMatch(content, /npm\s+install\s+-g\s+@ast-grep\/cli/i, `${skillPath} must not recommend an unpinned global ast-grep install`);
  assert.match(content, /lazytrae tooling status --tooling-root \/absolute\/lazytrae-tools/, `${skillPath} must direct ast-grep setup through receipt-owned tooling status`);
  assert.match(content, /lazytrae tooling install --tooling-root \/absolute\/lazytrae-tools/, `${skillPath} must direct ast-grep setup through the managed tooling lifecycle`);
}

function assertDurableLifecycleGuidance(content, documentationPath) {
  assert.doesNotMatch(content, /\/private\/tmp/, `${documentationPath} must not publish a temporary installation path`);
  assert.doesNotMatch(content, /\bv1\.0\.4\b/, `${documentationPath} must keep deferred work described as v1.0.3 gaps`);
  assert.doesNotMatch(content, /release folder as the source of truth/i, `${documentationPath} must not make a removable source checkout authoritative`);
  assert.match(content, /Node\.js LTS 20/i, `${documentationPath} must state the Node.js prerequisite`);
  assert.match(content, /\bGit\b/, `${documentationPath} must state the Git prerequisite`);
  assert.match(content, /https:\/\/github\.com\/elvinzhao10\/LazyTrae(?:\.git)?/, `${documentationPath} must name the verified official origin`);
  assert.match(content, /launcher\.js/, `${documentationPath} must use the stable durable launcher`);
  assert.match(content, /lifecycle (?:onboard|update|status|offboard)/, `${documentationPath} must document lifecycle commands`);
  assert.match(content, /HOST READINESS:\s*PENDING/i, `${documentationPath} must keep unobserved host readiness pending`);
}

test('Given installed LazyTrae guidance, when its package boundary is checked, then readiness and offboarding remain explicit', () => {
  const packageReadme = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'README.md'), 'utf8');
  const installedGuide = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'AGENTS.md'), 'utf8');
  const cliReadme = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'README.md'), 'utf8');
  assert.match(packageReadme, /init --host work` invokes the bounded Work skill installation/, 'package README must describe the Work init lifecycle accurately');
  assert.match(packageReadme, /self-contained CLI tarball/i, 'package README must describe the self-contained CLI artifact');
  assert.match(packageReadme, /cold offline/i, 'package README must describe the cold-offline artifact check');
  assertDurableLifecycleGuidance(installedGuide, 'installed AGENTS.md');
  assert.match(installedGuide, /## `offboard` protocol/, 'installed setup guide must provide safe offboarding');
  assert.match(cliReadme, /self-contained CLI tarball/i, 'CLI README must describe the self-contained CLI artifact');
});

test('Given public lifecycle documentation, when its installation contract is checked, then it uses the durable launcher and v1.0.3 evidence boundaries', () => {
  const paths = [
    'README.md',
    'AGENTS.md',
    'docs/03-install-and-host-verification.md',
    'docs/10-host-capability-matrix.md',
    'docs/reference/host-routes.md',
    'docs/v1.0.3-migration-guide.md',
    'RELEASE_NOTES-v1.0.3.md',
    'CHANGELOG.md',
    'lazytrae-plugin/README.md',
    'lazytrae-plugin/packages/cli/templates/AGENTS.md',
  ];

  for (const relativePath of paths) {
    assertDurableLifecycleGuidance(
      fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'),
      relativePath,
    );
  }
});

test('Given maintainer documentation, when contributor verification guidance is checked, then it describes the current suite without unsupported source-tree readiness commands', () => {
  const packageAgents = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'AGENTS.md'), 'utf8');

  assert.match(packageAgents, /1\.0\.3/, 'CLI maintainer guidance must name the packaged baseline');
  assert.match(packageAgents, /broad Node test suite/i, 'CLI maintainer guidance must describe the current suite');
  assert.doesNotMatch(packageAgents, /v0\.13|250 LOC|Currently thin/i, 'CLI maintainer guidance must not retain stale constraints');
  assert.match(packageAgents, /node --test test\/documentation-regression\.test\.js/, 'CLI maintainer guidance must name a focused documentation check');
  assert.match(packageAgents, /package-readiness/i, 'CLI maintainer guidance must retain the installed-package readiness boundary');
});

test('Given InitDeep guidance, when AGENTS.md is malformed or a replacement is requested, then it preserves content until separately confirmed destructive recovery', () => {
  const initDeepPaths = [
    path.join(repositoryRoot, 'lazytrae-plugin', '.trae', 'skills', 'lazy-init-deep', 'SKILL.md'),
    path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'skills', 'lazy-init-deep', 'SKILL.md'),
    path.join(repositoryRoot, 'lazytrae-plugin', '.trae', 'commands', 'lazy-init-deep.md'),
    path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'commands', 'lazy-init-deep.md'),
  ];

  for (const initDeepPath of initDeepPaths) {
    assertInitDeepSafety(fs.readFileSync(initDeepPath, 'utf8'), initDeepPath);
  }
});

test('Given shipped ast-grep guidance, when sg is unavailable, then it directs users to the managed receipt-owned tooling lifecycle', () => {
  const astGrepSkillPaths = [
    path.join(repositoryRoot, 'lazytrae-plugin', '.trae', 'skills', 'lazy-ast-grep', 'SKILL.md'),
    path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'skills', 'lazy-ast-grep', 'SKILL.md'),
  ];

  for (const astGrepSkillPath of astGrepSkillPaths) {
    assertManagedAstGrepGuidance(fs.readFileSync(astGrepSkillPath, 'utf8'), astGrepSkillPath);
  }
});

test('Given a copied InitDeep instruction, when it is changed to the old malformed-file fallback, then the safety contract rejects it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-initdeep-safety-'));
  const copiedSkill = path.join(temporaryDirectory, 'SKILL.md');

  try {
    fs.copyFileSync(
      path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'skills', 'lazy-init-deep', 'SKILL.md'),
      copiedSkill,
    );
    const oldFallback = fs.readFileSync(copiedSkill, 'utf8').replace(
      /If existing AGENTS\.md is corrupted or unparseable:.*$/m,
      'If existing AGENTS.md is corrupted or unparseable: treat as --create-new.',
    );
    fs.writeFileSync(copiedSkill, oldFallback, 'utf8');
    assert.throws(() => assertInitDeepSafety(fs.readFileSync(copiedSkill, 'utf8'), copiedSkill), /unsafe malformed-file fallback/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('Given a copied InitDeep instruction, when legacy update or non-byte-exact backup wording is restored, then the safety contract rejects it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-initdeep-ownership-'));
  const copiedCommand = path.join(temporaryDirectory, 'lazy-init-deep.md');

  try {
    fs.copyFileSync(
      path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'commands', 'lazy-init-deep.md'),
      copiedCommand,
    );
    const legacyAmbiguity = fs.readFileSync(copiedCommand, 'utf8')
      .replace('Otherwise, create only missing AGENTS.md\n  files.', 'If omitted, update existing AGENTS.md.')
      .replace(/create and report a byte-for-byte backup of every confirmed original/, 'copy its existing content');
    fs.writeFileSync(copiedCommand, legacyAmbiguity, 'utf8');
    assert.throws(() => assertInitDeepSafety(fs.readFileSync(copiedCommand, 'utf8'), copiedCommand), /ambiguously update/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('Given a copied InitDeep instruction, when whole-body ownership or absent-block no-op wording is restored, then the safety contract rejects it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-initdeep-managed-block-'));
  const copiedCommand = path.join(temporaryDirectory, 'lazy-init-deep.md');

  try {
    fs.copyFileSync(
      path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'commands', 'lazy-init-deep.md'),
      copiedCommand,
    );
    const legacyOwnership = fs.readFileSync(copiedCommand, 'utf8')
      .replace(
        /Content outside every delimited[\s\S]*?complete delimited managed block itself is package-owned\./,
        'Each existing AGENTS.md body is user-owned content.',
      )
      .replace(
        /`lazytrae init` updates[\s\S]*?existing surrounding bytes\./,
        '`lazytrae init` may update only a delimited package-owned block. If the delimited block is absent, leave the file unchanged.',
      );
    fs.writeFileSync(copiedCommand, legacyOwnership, 'utf8');
    assert.throws(() => assertInitDeepSafety(fs.readFileSync(copiedCommand, 'utf8'), copiedCommand), /blanket ownership/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
