const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const RELEASE_VERSION = '1.1.0';
const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');

const JSON_VERSION_PATHS = [
  ['lazytrae-plugin/packages/cli/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/mcp/package.json', ['version']],
  ['lazytrae-plugin/packages/mcp/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/mcp/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/codegraph/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/codegraph/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/codegraph/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/python/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/python/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/python/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/typescript/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/typescript/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/typescript/package-lock.json', ['packages', '', 'version']],
];

const RELEASE_TEXT_PATHS = [
  'AGENTS.md',
  'README.md',
  'CHANGELOG.md',
  'lazytrae-plugin/packages/cli/AGENTS.md',
  'lazytrae-plugin/packages/cli/src/index.js',
  'lazytrae-plugin/packages/cli/src/commands/doctor.js',
  'lazytrae-plugin/packages/cli/src/commands/init.js',
  'lazytrae-plugin/packages/cli/src/commands/load-check.js',
  'lazytrae-plugin/packages/cli/src/commands/lsp.js',
  'lazytrae-plugin/packages/cli/src/commands/sync.js',
  'lazytrae-plugin/packages/cli/src/commands/uninstall.js',
  'lazytrae-plugin/packages/cli/src/lib/trae-checks.js',
  'lazytrae-plugin/packages/cli/src/mcp/index.js',
  'lazytrae-plugin/packages/mcp/src/index.js',
  'lazytrae-plugin/packages/cli/templates/AGENTS.md',
  'lazytrae-plugin/packages/cli/templates/hooks.json',
  'lazytrae-plugin/packages/cli/templates/mcp.json',
  'lazytrae-plugin/packages/cli/templates/hooks/dynamic-rules.sh',
  'lazytrae-plugin/packages/cli/templates/hooks/post-tool-use.sh',
  'lazytrae-plugin/packages/cli/templates/hooks/pre-tool-use.sh',
  'lazytrae-plugin/packages/cli/templates/hooks/session-start.sh',
  'lazytrae-plugin/packages/cli/templates/hooks/stop.sh',
  'lazytrae-plugin/packages/cli/templates/hooks/user-prompt-submit.sh',
  'lazytrae-plugin/.trae/hooks.json',
  'lazytrae-plugin/.trae/mcp.json',
  'lazytrae-plugin/.trae/hooks/dynamic-rules.sh',
  'lazytrae-plugin/.trae/hooks/post-tool-use.sh',
  'lazytrae-plugin/.trae/hooks/pre-tool-use.sh',
  'lazytrae-plugin/.trae/hooks/session-start.sh',
  'lazytrae-plugin/.trae/hooks/stop.sh',
  'lazytrae-plugin/.trae/hooks/user-prompt-submit.sh',
];

function readJson(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`version metadata at ${relativePath} is not valid JSON: ${error.message}`);
  }
}

function pathLabel(relativePath, keyPath) {
  return `${relativePath}${keyPath.length ? `#${keyPath.join('.')}` : ''}`;
}

function assertJsonReleaseVersions(root) {
  for (const [relativePath, keyPath] of JSON_VERSION_PATHS) {
    let value = readJson(root, relativePath);
    for (const key of keyPath) value = value?.[key];
    if (value !== RELEASE_VERSION) {
      throw new Error(
        `LazyTrae version mismatch at ${pathLabel(relativePath, keyPath)}: `
        + `expected ${RELEASE_VERSION}, got ${JSON.stringify(value)}`,
      );
    }
  }
}

function assertTextReleaseVersions(root) {
  for (const relativePath of RELEASE_TEXT_PATHS) {
    const contents = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.match(
      contents,
      new RegExp(`(?:v)?${RELEASE_VERSION.replaceAll('.', '\\.')}`),
      `LazyTrae release identity missing at ${relativePath}`,
    );
  }

  const hooks = readJson(root, 'lazytrae-plugin/.trae/hooks.json');
  assert.equal(hooks.lazytrae?.version, `v${RELEASE_VERSION}`, 'active hooks metadata is stale');

  const mcp = readJson(root, 'lazytrae-plugin/.trae/mcp.json');
  assert.match(mcp.lazytrae?.description || '', new RegExp(`v${RELEASE_VERSION.replaceAll('.', '\\.')}`));

  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const sectionPattern = new RegExp(`## \\[${RELEASE_VERSION.replaceAll('.', '\\.')}\\][\\s\\S]*?(?=\n## \\[|$)`);
  const currentSection = changelog.match(sectionPattern)?.[0] || '';
  assert.match(currentSection, /local-first onboarding/i, `${RELEASE_VERSION} release notes omit local-first onboarding`);
  assert.match(currentSection, /host readiness/i, `${RELEASE_VERSION} release notes omit honest host readiness`);
}

function copyFixture(root) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lazytrae v${RELEASE_VERSION} version fixture `));
  const relativePaths = new Set([
    ...JSON_VERSION_PATHS.map(([relativePath]) => relativePath),
    ...RELEASE_TEXT_PATHS,
  ]);
  try {
    for (const relativePath of relativePaths) {
      const source = path.join(root, relativePath);
      const destination = path.join(fixtureRoot, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  } catch (error) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    throw error;
  }
  return fixtureRoot;
}

test(`v${RELEASE_VERSION} product-owned LazyTrae metadata and active identities agree`, () => {
  assertJsonReleaseVersions(REPOSITORY_ROOT);
  assertTextReleaseVersions(REPOSITORY_ROOT);
});

test('a copied product manifest mismatch is rejected with its exact path and source stays unchanged', () => {
  const sourcePath = path.join(REPOSITORY_ROOT, 'lazytrae-plugin/packages/mcp/package.json');
  const sourceBefore = fs.readFileSync(sourcePath);
  const fixtureRoot = copyFixture(REPOSITORY_ROOT);
  try {
    const fixturePath = path.join(fixtureRoot, 'lazytrae-plugin/packages/mcp/package.json');
    const fixtureManifest = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    fixtureManifest.version = '1.0.1';
    fs.writeFileSync(fixturePath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);

    assert.throws(
      () => assertJsonReleaseVersions(fixtureRoot),
      (error) => {
        assert.match(error.message, /lazytrae-plugin\/packages\/mcp\/package\.json#version/);
        assert.match(error.message, new RegExp(`expected ${RELEASE_VERSION.replaceAll('.', '\\.')}, got "1\\.0\\.1"`));
        return true;
      },
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  assert.deepEqual(fs.readFileSync(sourcePath), sourceBefore, 'mutation probe changed the source manifest');
});

test('a copied template mismatch is rejected from a path with spaces and its source stays unchanged', () => {
  const relativePath = 'lazytrae-plugin/packages/cli/templates/AGENTS.md';
  const sourcePath = path.join(REPOSITORY_ROOT, relativePath);
  const sourceBefore = fs.readFileSync(sourcePath);
  const fixtureRoot = copyFixture(REPOSITORY_ROOT);
  try {
    assertJsonReleaseVersions(fixtureRoot);
    assertTextReleaseVersions(fixtureRoot);
    assert.match(fixtureRoot, / /, 'the portable fixture must exercise a path containing spaces');

    const fixturePath = path.join(fixtureRoot, relativePath);
    const fixtureBefore = fs.readFileSync(fixturePath, 'utf8');
    const downgradePattern = new RegExp(`v?${RELEASE_VERSION.replaceAll('.', '\\.')}`, 'g');
    const fixtureAfter = fixtureBefore.replace(downgradePattern, 'v1.0.1');
    assert.notEqual(fixtureAfter, fixtureBefore, 'template mutation fixture did not change its release identity');
    fs.writeFileSync(fixturePath, fixtureAfter);

    assert.throws(
      () => assertTextReleaseVersions(fixtureRoot),
      (error) => {
        assert.match(error.message, /LazyTrae release identity missing/);
        assert.match(error.message, /lazytrae-plugin\/packages\/cli\/templates\/AGENTS\.md/);
        return true;
      },
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  assert.deepEqual(fs.readFileSync(sourcePath), sourceBefore, 'template mutation probe changed the source file');
});
