const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const requiredPages = [
  'README.md',
  'lazytrae-evaluation.md',
  'docs/README.md',
  'docs/00-learning-path.md',
  'docs/01-mental-model.md',
  'docs/02-first-task.md',
  'docs/03-install-and-host-verification.md',
  'docs/04-workflow-playbooks.md',
  'docs/05-evidence-and-completion.md',
  'docs/06-capabilities-and-approvals.md',
  'docs/06a-security-and-authority.md',
  'docs/06b-receipts-and-owned-tooling.md',
  'docs/07-package-map.md',
  'docs/07a-state-and-validation.md',
  'docs/07b-mcp-lifecycle.md',
  'docs/08-safe-removal.md',
  'docs/09-test-and-release-verification.md',
  'docs/10-host-capability-matrix.md',
  'docs/reference/host-routes.md',
  'docs/reference/mcp-inventory.md',
  'docs/reference/state-artifact-reference.md',
  'docs/reference/verification-contract.md',
  'docs/reference/terminology.md',
];

function assertLocalLinks(documentationPath, root = repositoryRoot) {
  const content = fs.readFileSync(documentationPath, 'utf8');
  let canonicalRoot;
  try {
    canonicalRoot = fs.realpathSync.native(root);
  } catch (error) {
    assert.fail(`unable to resolve repository root ${root}: ${error.code || error.message}`);
  }
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    assert.notEqual(target, '', `${documentationPath} links to an empty local target`);
    if (target.startsWith('#') || /^(?:https?:|mailto:)/i.test(target)) continue;

    const resolved = path.resolve(path.dirname(documentationPath), target.split('#', 1)[0]);
    const relative = path.relative(root, resolved).split(path.sep).join('/');
    assert.equal(relative === '..' || relative.startsWith('../') || path.isAbsolute(relative), false,
      `${documentationPath} links outside repository root: ${target}`);
    assert.notEqual(relative, 'docs/handoff.md', `${documentationPath} must not link to docs/handoff.md`);
    try {
      fs.lstatSync(resolved);
    } catch (error) {
      if (error.code === 'ENOENT') {
        assert.fail(`${documentationPath} links to missing local target ${target}`);
      }
      assert.fail(`${documentationPath} is unable to resolve local target ${target}: ${error.code || error.message}`);
    }

    let canonicalResolved;
    try {
      canonicalResolved = fs.realpathSync.native(resolved);
    } catch (error) {
      assert.fail(`${documentationPath} is unable to resolve local target ${target}: ${error.code || error.message}`);
    }
    const canonicalRelative = path.relative(canonicalRoot, canonicalResolved).split(path.sep).join('/');
    assert.equal(canonicalRelative === '..' || canonicalRelative.startsWith('../')
      || path.isAbsolute(canonicalRelative), false,
      `${documentationPath} links outside repository root: ${target}`);
  }
}

function assertReleaseBoundarySemantics(content) {
  const oppositeBoundary = /(?:package|core)[^.]{0,80}(?:checks?|health|verification|readiness)[^.]{0,100}\b(?:require|requires|depend|depends|rely|relies)\b[^.]{0,100}\b(?:publication|learner|repository-root|root documentation|root docs)\b/i;
  const intendedBoundary = /(?:normal ci|(?:package|core)[^.]{0,80}(?:checks?|health|verification|readiness))[^.]{0,160}\b(?:self-contained|does not require|independent)\b[\s\S]{0,300}\b(?:documentation|learner docs|learner documentation)\b[^.]{0,160}\b(?:release-only|publication)\b/i;

  assert.doesNotMatch(content, oppositeBoundary,
    'package/core health must not claim a runtime dependency on publication learner docs');
  assert.match(content, intendedBoundary,
    'documentation must distinguish self-contained package/core health from publication learner-doc checks');
  assert.match(content, /macOS/i);
  assert.match(content, /host (?:registration|connection|verification|integration)/i);
}

test('public learner pages exist and their local link graph resolves', () => {
  for (const relativePath of requiredPages) {
    const documentationPath = path.join(repositoryRoot, relativePath);
    assert.equal(fs.existsSync(documentationPath), true, `required publication page is missing: ${relativePath}`);
    assertLocalLinks(documentationPath);
  }
});

test('public documentation expresses the release boundary semantically', () => {
  const evaluation = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-evaluation.md'), 'utf8');
  const releaseGuide = fs.readFileSync(path.join(repositoryRoot, 'docs/09-test-and-release-verification.md'), 'utf8');
  const combined = `${evaluation}\n${releaseGuide}`;
  assertReleaseBoundarySemantics(combined);
});

test('public documentation rejects the opposite package and publication boundary', () => {
  assert.throws(() => assertReleaseBoundarySemantics(
    'Package checks require publication learner docs at runtime. '
      + 'Publication is required on macOS. Host connection verification is separate.',
  ));
});

test('publication link validation rejects malformed targets and accepts directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-publication-links-'));
  const docs = path.join(root, 'docs');
  const page = path.join(docs, 'README.md');
  try {
    fs.mkdirSync(path.join(docs, 'reference'), { recursive: true });
    fs.writeFileSync(page, '[reference](reference/)\n', 'utf8');
    assertLocalLinks(page, root);
    fs.writeFileSync(page, '[missing](missing.md)\n', 'utf8');
    assert.throws(() => assertLocalLinks(page, root), /missing local target/);
    fs.writeFileSync(page, '[empty]()\n', 'utf8');
    assert.throws(() => assertLocalLinks(page, root), /empty local target/);
    fs.writeFileSync(page, '[escape](../../outside.md)\n', 'utf8');
    assert.throws(() => assertLocalLinks(page, root), /outside repository root/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Given an external file symlink, When validating a local link, Then it rejects the escape', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-publication-links-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-publication-external-'));
  const page = path.join(root, 'README.md');
  try {
    fs.writeFileSync(path.join(external, 'outside.md'), 'external content', 'utf8');
    fs.symlinkSync(path.join(external, 'outside.md'), path.join(root, 'linked.md'));
    fs.writeFileSync(page, '[linked](linked.md)\n', 'utf8');
    assert.throws(() => assertLocalLinks(page, root), /outside repository root/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test('Given an external directory symlink, When validating a local link, Then it rejects the escape', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-publication-links-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-publication-external-'));
  const page = path.join(root, 'README.md');
  try {
    fs.symlinkSync(external, path.join(root, 'linked-directory'));
    fs.writeFileSync(page, '[linked](linked-directory/)\n', 'utf8');
    assert.throws(() => assertLocalLinks(page, root), /outside repository root/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test('Given a dangling symlink, When validating a local link, Then it fails closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-publication-links-'));
  const page = path.join(root, 'README.md');
  try {
    fs.symlinkSync(path.join(root, 'missing.md'), path.join(root, 'dangling.md'));
    fs.writeFileSync(page, '[linked](dangling.md)\n', 'utf8');
    assert.throws(() => assertLocalLinks(page, root), /unable to resolve local target/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
