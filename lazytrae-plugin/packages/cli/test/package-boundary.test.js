const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { MONOREPO_ROOT, REPO_ROOT, makeFixture, runCli } = require('./test-helpers');

const OPERATIONAL_FILES = [
  'packages/cli/src/commands/run.js',
  'packages/cli/src/lib/parity-check.js',
  'packages/cli/src/mcp/parity.js',
  'packages/cli/src/mcp/tool-defs.js',
  'packages/mcp/src/parity.js',
  'packages/mcp/src/tool-defs.js',
  'packages/cli/templates/hooks.json',
  '.trae/hooks.json',
  'packages/cli/templates/skills/lazy-librarian/SKILL.md',
  '.trae/skills/lazy-librarian/SKILL.md',
];

function assertNoPrivateOmoMembers(members) {
  const offenders = members.filter(member => /(?:^|\/)\.omo(?:\/|$)/.test(member));
  assert.deepEqual(
    offenders,
    [],
    `distributable artifacts must exclude private .omo evidence: ${offenders.join(', ')}`,
  );
}

test('installed LazyTrae operations do not require repository docs or dev directories', () => {
  // Given: a consumer repository created exclusively from packaged templates.
  const fixture = makeFixture('lazytrae-no-parent-docs-');

  try {
    // When: the operational lifecycle runs without consumer docs or dev directories.
    fs.rmSync(path.join(fixture, 'docs'), { recursive: true, force: true });
    fs.rmSync(path.join(fixture, 'dev'), { recursive: true, force: true });
    const doctor = runCli(['doctor'], { cwd: fixture });
    const verify = runCli(['verify'], { cwd: fixture });
    const sync = runCli(['sync'], { cwd: fixture });

    // Then: every command succeeds without a parent documentation dependency.
    assert.equal(doctor.status, 0, doctor.stdout);
    assert.equal(verify.status, 0, verify.stdout);
    assert.equal(sync.status, 0, sync.stdout);

    for (const relativePath of OPERATIONAL_FILES) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      assert.doesNotMatch(source, /docs\/lazytrae-|\.\.\/docs|\.\.\/dev/, relativePath);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('default package health excludes the explicit publication entry point', () => {
  const packageManifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packages/cli/package.json'), 'utf8'));

  assert.equal(packageManifest.scripts.test, 'node ./tools/test-fixture-runner.js');
  assert.equal(packageManifest.scripts['test:publication'],
    'node ./tools/test-fixture-runner.js publication/documentation-publication.js');
  assert.equal(path.basename('publication/documentation-publication.js').endsWith('.test.js'), false);
});

test('the permanent release tree excludes the private .omo namespace', () => {
  const privateNamespace = path.join(MONOREPO_ROOT, '.omo');
  if (!fs.existsSync(path.join(MONOREPO_ROOT, '.git'))) {
    assert.equal(
      fs.existsSync(privateNamespace),
      false,
      'an isolated package fixture must not carry a private .omo directory',
    );
    return;
  }

  const tracked = childProcess.spawnSync('git', ['ls-files', '--', '.omo'], {
    cwd: MONOREPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(tracked.error, undefined, tracked.error?.message);
  assert.equal(tracked.status, 0, tracked.stderr || tracked.stdout);
  assert.equal(tracked.stdout.trim(), '', 'private .omo files must not be tracked in a release handoff');
  const ignored = childProcess.spawnSync('git', ['check-ignore', '--quiet', '.omo'], {
    cwd: MONOREPO_ROOT,
  });
  assert.equal(ignored.status, 0, 'private local .omo evidence must remain ignored by release packaging');
});

test('a controlled private .omo artifact is rejected without mutating its source fixture', () => {
  const controlledMembers = ['package/README.md', 'package/.omo/evidence/internal.md'];
  const before = controlledMembers.slice();

  assert.throws(
    () => assertNoPrivateOmoMembers(controlledMembers),
    /private \.omo evidence/,
  );
  assert.deepEqual(controlledMembers, before, 'artifact rejection must not delete or rewrite its source fixture');
});

test('package health passes but publication fails without repository learner docs', {
  skip: process.env.LAZYTRAE_ISOLATED_ROOT_DOCS === '1',
}, () => {
  const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-root-doc-boundary-'));
  const isolatedCli = path.join(isolatedRoot, 'lazytrae-plugin', 'packages', 'cli');
  const focusedTests = [
    'test/package-boundary.test.js',
    'test/ci-workflow-regression.test.js',
    'test/legacy-operational-reference-inventory.test.js',
  ];

  try {
    fs.cpSync(MONOREPO_ROOT, isolatedRoot, {
      recursive: true,
      filter(source) {
        const relative = path.relative(MONOREPO_ROOT, source);
        if (relative === '') return true;
        if (relative === '.git' || relative.startsWith(`.git${path.sep}`)
          || relative === '.omo' || relative.startsWith(`.omo${path.sep}`)) return false;
        if (relative.split(path.sep).includes('node_modules')) return false;
        return relative !== 'README.md'
          && relative !== 'lazytrae-evaluation.md'
          && relative !== 'docs'
          && !relative.startsWith(`docs${path.sep}`);
      },
    });
    fs.symlinkSync(path.join(REPO_ROOT, 'packages', 'cli', 'node_modules'), path.join(isolatedCli, 'node_modules'));
    fs.writeFileSync(path.join(isolatedRoot, 'lazytrae-evaluation.md'),
      'POISON: package checks require publication learner docs at runtime.\n');
    fs.mkdirSync(path.join(isolatedRoot, 'docs'));
    fs.writeFileSync(path.join(isolatedRoot, 'docs', 'README.md'),
      '[missing learner route](missing.md)\n');
    const childEnvironment = { ...process.env, LAZYTRAE_ISOLATED_ROOT_DOCS: '1' };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const publicationEnvironment = { ...process.env };
    delete publicationEnvironment.NODE_TEST_CONTEXT;

    const packageHealth = childProcess.spawnSync(process.execPath, [
      '--test',
      ...focusedTests,
    ], {
      cwd: isolatedCli,
      encoding: 'utf8',
      env: childEnvironment,
      timeout: 120000,
    });
    const publicationHealth = childProcess.spawnSync(process.execPath, [
      './tools/test-fixture-runner.js',
      'publication/documentation-publication.js',
    ], {
      cwd: isolatedCli,
      encoding: 'utf8',
      env: publicationEnvironment,
      timeout: 120000,
    });

    assert.equal(packageHealth.error, undefined, packageHealth.error?.message);
    assert.equal(packageHealth.status, 0, `${packageHealth.stdout}\n${packageHealth.stderr}`);
    assert.match(`${packageHealth.stdout}\n${packageHealth.stderr}`, /fail 0/);
    assert.match(packageHealth.stdout, /installed LazyTrae operations do not require repository docs/);
    assert.match(packageHealth.stdout, /publication-readiness workflow is macOS-only/);
    assert.match(packageHealth.stdout, /operational CLI and MCP sources use LazyTrae-native names/);
    assert.equal(publicationHealth.error, undefined, publicationHealth.error?.message);
    assert.notEqual(publicationHealth.status, 0, 'publication health unexpectedly accepted poisoned learner docs');
    assert.match(`${publicationHealth.stdout}\n${publicationHealth.stderr}`,
      /required publication page is missing: README\.md/);
  } finally {
    fs.rmSync(isolatedRoot, { recursive: true, force: true });
  }
});
