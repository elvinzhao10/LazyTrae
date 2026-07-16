const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const requiredHeadings = [
  'Public capability status contract',
  'Optional capability policy',
  'Receipt and safe removal',
  'Package readiness versus host verification',
  'JSON-RPC resilience',
  'Host-specific exclusions',
  'Known unverified host behavior',
  'macOS verification scope',
];

const documentationPaths = [
  path.join(repositoryRoot, 'lazytrae-evaluation.md'),
];
const requiredRootDocumentationPaths = [
  'docs/README.md',
  'docs/00-learning-path.md',
  'docs/01-mental-model.md',
  'docs/02-first-task.md',
  'docs/03-install-and-host-verification.md',
  'docs/04-workflow-playbooks.md',
  'docs/05-evidence-and-completion.md',
  'docs/06-capabilities-and-approvals.md',
  'docs/07-package-map.md',
  'docs/08-safe-removal.md',
  'docs/reference/host-routes.md',
  'docs/reference/verification-contract.md',
  'docs/reference/terminology.md',
];

function assertRootDocumentationLinks(documentationPath, documentationRoot = repositoryRoot) {
  const content = fs.readFileSync(documentationPath, 'utf8');
  const markdownLinks = /\[[^\]]*\]\(([^)]*)\)/g;

  for (const match of content.matchAll(markdownLinks)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    assert.notEqual(target, '', `${documentationPath} links to an empty local target`);
    if (target.startsWith('#') || /^(?:https?:|mailto:)/i.test(target)) {
      continue;
    }

    const localTarget = target.split('#', 1)[0];
    const resolvedTarget = path.resolve(path.dirname(documentationPath), localTarget);
    const relativeTarget = path.relative(documentationRoot, resolvedTarget).split(path.sep).join('/');
    assert.notEqual(relativeTarget, 'docs/handoff.md', `${documentationPath} must not link to docs/handoff.md`);
    assert.equal(fs.existsSync(resolvedTarget), true, `${documentationPath} links to missing local target ${target}`);
  }
}

function assertRootDocumentationContract() {
  for (const relativePath of requiredRootDocumentationPaths) {
    const documentationPath = path.join(repositoryRoot, relativePath);
    assert.equal(fs.existsSync(documentationPath), true, `required root documentation is missing: ${relativePath}`);
    assertRootDocumentationLinks(documentationPath);
  }
}

function assertDocumentationContract(documentationPath) {
  const content = fs.readFileSync(documentationPath, 'utf8');

  for (const heading of requiredHeadings) {
    assert.match(content, new RegExp(`^## ${heading}$`, 'm'), `${documentationPath} is missing ${heading}`);
  }

  assert.match(content, /macOS only/, `${documentationPath} must retain macOS-only scope`);
  assert.match(content, /Host integration/, `${documentationPath} must name host-integration differences`);
  assert.match(content, /State\/path/, `${documentationPath} must name state/path differences`);
  assert.match(content, /Inventory/, `${documentationPath} must name inventory differences`);
  assert.match(content, /normal CI.*does not require.*sibling/i, `${documentationPath} must keep normal CI self-contained`);
  assert.match(content, /release-only paired parity/i, `${documentationPath} must limit paired parity to release evidence`);
}

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
  assert.match(content, /lazytrae init.*(?:updates?|replaces?).*complete.*delimited.*managed.*block.*appends?.*new.*delimited.*managed.*block/is, `${initDeepPath} must accurately describe managed-block update and append behavior`);
  assert.match(content, /preserv(?:e|ing).*all\s+existing\s+surrounding\s+bytes|all\s+existing\s+surrounding\s+bytes.*preserv/is, `${initDeepPath} must preserve all bytes outside the managed block`);
  assert.doesNotMatch(content, /(?:if|when).*delimited block is absent.*leave the file unchanged/i, `${initDeepPath} must not claim an absent managed block leaves AGENTS.md unchanged`);
}

function assertManagedAstGrepGuidance(content, skillPath) {
  assert.doesNotMatch(content, /npm\s+install\s+-g\s+@ast-grep\/cli/i, `${skillPath} must not recommend an unpinned global ast-grep install`);
  assert.match(content, /lazytrae tooling status --tooling-root \/absolute\/lazytrae-tools/, `${skillPath} must direct ast-grep setup through receipt-owned tooling status`);
  assert.match(content, /lazytrae tooling install --tooling-root \/absolute\/lazytrae-tools/, `${skillPath} must direct ast-grep setup through the managed tooling lifecycle`);
}

test('Given current LazyTrae documentation, when its v0.17 contract is checked, then every shared heading and policy is present', () => {
  for (const documentationPath of documentationPaths) {
    assertDocumentationContract(documentationPath);
  }

  const packageReadme = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'README.md'), 'utf8');
  const onboardingGuide = fs.readFileSync(path.join(repositoryRoot, 'AGENTS.md'), 'utf8');
  const installedGuide = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'AGENTS.md'), 'utf8');
  const rootReadme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');
  const cliReadme = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'README.md'), 'utf8');
  assert.match(packageReadme, /init --host work` invokes the bounded Work skill installation/, 'package README must describe the Work init lifecycle accurately');
  assert.match(packageReadme, /self-contained CLI tarball/i, 'package README must describe the self-contained CLI artifact');
  assert.match(packageReadme, /cold offline/i, 'package README must describe the cold-offline artifact check');
  assert.match(onboardingGuide, /package readiness/, 'onboarding guide must describe package-only readiness');
  assert.match(onboardingGuide, /invokes the bounded Work skill installation/, 'onboarding guide must describe the Work init lifecycle accurately');
  assert.match(onboardingGuide, /does not require a source\s+checkout\s+after installation/i, 'onboarding guide must distinguish an installed package from the repo-only fallback');
  assert.match(installedGuide, /does not require a source\s+checkout\s+after installation/i, 'installed onboarding guidance must distinguish an installed package from the repo-only fallback');
  assert.match(rootReadme, /self-contained CLI tarball/i, 'root README must describe the self-contained CLI artifact');
  assert.match(cliReadme, /self-contained CLI tarball/i, 'CLI README must describe the self-contained CLI artifact');
  assert.match(fs.readFileSync(path.join(repositoryRoot, 'lazytrae-evaluation.md'), 'utf8'), /cold offline/i, 'evaluation must record the cold-offline artifact evidence');
  assert.match(fs.readFileSync(path.join(repositoryRoot, 'lazytrae-evaluation.md'), 'utf8'), /macOS CI[\s\S]*does not publish/i, 'evaluation must keep the macOS CI boundary explicit');
});

test('Given root learner documentation, when its public contract is checked, then every required page and local link is present', () => {
  assertRootDocumentationContract();
});

test('Given public LazyTrae documentation, when its release-facing contract is checked, then it presents the banner and safe onboarding and offboarding paths', () => {
  const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');
  const onboardingGuide = fs.readFileSync(path.join(repositoryRoot, 'AGENTS.md'), 'utf8');
  const installedGuide = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'templates', 'AGENTS.md'), 'utf8');

  assert.match(readme, /^!\[LazyTrae.*\]\(lazytrae-banner\.jpg\)$/m, 'README must embed the public LazyTrae banner');
  assert.doesNotMatch(readme, /practice project|no longer maintained|alignment candidate/i, 'README must not use legacy release framing');
  assert.match(onboardingGuide, /## `offboard` protocol/, 'root setup guide must provide safe offboarding');
  assert.match(installedGuide, /## `offboard` protocol/, 'installed setup guide must provide safe offboarding');
});

test('Given maintainer documentation, when contributor verification guidance is checked, then it describes the current suite without unsupported source-tree readiness commands', () => {
  const packageAgents = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'packages', 'cli', 'AGENTS.md'), 'utf8');

  assert.match(packageAgents, /0\.17\.0/, 'CLI maintainer guidance must name the packaged baseline');
  assert.match(packageAgents, /broad Node test suite/i, 'CLI maintainer guidance must describe the current suite');
  assert.doesNotMatch(packageAgents, /v0\.13|250 LOC|Currently thin/i, 'CLI maintainer guidance must not retain stale constraints');
  assert.match(packageAgents, /node --test test\/documentation-regression\.test\.js/, 'CLI maintainer guidance must name a focused documentation check');
  assert.match(packageAgents, /package-readiness/i, 'CLI maintainer guidance must retain the installed-package readiness boundary');
});

test('Given copied LazyTrae documentation, when a required heading or invalid root-doc link is introduced, then the documentation contract rejects it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-documentation-regression-'));
  const copiedDocumentation = path.join(temporaryDirectory, 'lazytrae-evaluation.md');

  try {
    fs.copyFileSync(path.join(repositoryRoot, 'lazytrae-evaluation.md'), copiedDocumentation);
    fs.writeFileSync(copiedDocumentation, fs.readFileSync(copiedDocumentation, 'utf8').replace('## JSON-RPC resilience\n', ''), 'utf8');
    assert.throws(() => assertDocumentationContract(copiedDocumentation), /JSON-RPC resilience/);
    const copiedRootDocumentation = path.join(temporaryDirectory, 'docs', 'README.md');
    fs.mkdirSync(path.dirname(copiedRootDocumentation), { recursive: true });
    fs.writeFileSync(copiedRootDocumentation, '[missing](missing.md)\n', 'utf8');
    assert.throws(() => assertRootDocumentationLinks(copiedRootDocumentation, temporaryDirectory), /missing local target/);
    fs.writeFileSync(copiedRootDocumentation, '[empty]()\n', 'utf8');
    assert.throws(() => assertRootDocumentationLinks(copiedRootDocumentation, temporaryDirectory), /empty local target/);
    fs.writeFileSync(copiedRootDocumentation, '[stale handoff](handoff.md)\n', 'utf8');
    assert.throws(() => assertRootDocumentationLinks(copiedRootDocumentation, temporaryDirectory), /docs\/handoff\.md/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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
