const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const repositoryRoot = process.env.LAZYTRAE_DOCUMENTATION_ROOT || resolve(__dirname, '../../../..');
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

function readRepositoryFile(path) {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

test('v0.17 public documentation carries the shared safety taxonomy', () => {
  for (const path of ['lazytrae-evaluation.md', 'docs/handoff.md']) {
    const content = readRepositoryFile(path);
    for (const heading of requiredHeadings) {
      assert.match(content, new RegExp(`^## ${heading}$`, 'm'), `${path} is missing ${heading}`);
    }
  }
});

test('v0.17 onboarding preserves Trae-specific boundaries', () => {
  const onboarding = readRepositoryFile('AGENTS.md');
  const packageReadme = readRepositoryFile('lazytrae-plugin/README.md');
  const evaluation = readRepositoryFile('lazytrae-evaluation.md');

  assert.match(onboarding, /not host discovery, MCP connection, or a running session/);
  assert.match(onboarding, /manual \*\*Settings → MCP\*\* registration is required/);
  assert.match(packageReadme, /host discovery and MCP connection are reported separately/);
  assert.match(evaluation, /15 tools/);
  assert.match(evaluation, /\.trae\//);
  assert.match(evaluation, /trae-cli mcp add-json/);
  assert.match(evaluation, /ten MCP declarations/);
  assert.match(evaluation, /filesystem and Playwright templates/);
  assert.match(evaluation, /macOS only/);
});

test('v0.17 policy is read-only and normal CI is self-contained', () => {
  const evaluation = readRepositoryFile('lazytrae-evaluation.md');
  const handoff = readRepositoryFile('docs/handoff.md');

  for (const content of [evaluation, handoff]) {
    assert.match(content, /host-ready.*owned-ready.*missing.*incompatible.*disabled.*failed-optional.*not-initialized/s);
    assert.match(content, /Normal CI is self-contained/);
    assert.match(content, /release-only/);
    assert.match(content, /does not.*activate.*provider|without.*enabling|as enabling a provider/i);
    assert.match(content, /host registrations.*host|host registrations survive/i);
  }
});
