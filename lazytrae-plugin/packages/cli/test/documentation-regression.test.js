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
  path.join(repositoryRoot, 'docs', 'handoff.md'),
];

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

test('Given current LazyTrae documentation, when its v0.17 contract is checked, then every shared heading and policy is present', () => {
  for (const documentationPath of documentationPaths) {
    assertDocumentationContract(documentationPath);
  }

  const packageReadme = fs.readFileSync(path.join(repositoryRoot, 'lazytrae-plugin', 'README.md'), 'utf8');
  const onboardingGuide = fs.readFileSync(path.join(repositoryRoot, 'AGENTS.md'), 'utf8');
  assert.match(packageReadme, /init --host work` invokes the bounded Work skill installation/, 'package README must describe the Work init lifecycle accurately');
  assert.match(onboardingGuide, /package readiness/, 'onboarding guide must describe package-only readiness');
  assert.match(onboardingGuide, /invokes the bounded Work skill installation/, 'onboarding guide must describe the Work init lifecycle accurately');
});

test('Given a copied LazyTrae handoff, when a required heading is removed, then the documentation contract rejects it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-documentation-regression-'));
  const copiedHandoff = path.join(temporaryDirectory, 'handoff.md');

  try {
    fs.copyFileSync(path.join(repositoryRoot, 'docs', 'handoff.md'), copiedHandoff);
    fs.writeFileSync(copiedHandoff, fs.readFileSync(copiedHandoff, 'utf8').replace('## JSON-RPC resilience\n', ''), 'utf8');
    assert.throws(() => assertDocumentationContract(copiedHandoff), /JSON-RPC resilience/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
