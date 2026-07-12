const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const expectedVersion = require('../package.json').version;
const packagedMcp = require('../src/mcp');
const sourceMcp = require('../../mcp/src');
const RELEASE_VERSION = '0.16.0-alpha.1';

function initializeVersion(server) {
  let output = '';
  const write = process.stdout.write;
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    server.handleRequest({ id: 1, method: 'initialize' }, process.cwd());
  } finally {
    process.stdout.write = write;
  }
  return JSON.parse(output).result.serverInfo.version;
}

test('all LazyTrae MCP runtime entry points report the package version', () => {
  assert.equal(initializeVersion(packagedMcp), expectedVersion);
  assert.equal(initializeVersion(sourceMcp), expectedVersion);
});

test('v0.16 tooling release manifests are pinned to alpha.1', () => {
  assert.equal(expectedVersion, RELEASE_VERSION);
  assert.equal(require('../../mcp/package.json').version, RELEASE_VERSION);

  const releasePaths = [
    '../package-lock.json',
    '../../mcp/package-lock.json',
    '../src/index.js',
    '../src/commands/init.js',
    '../src/commands/doctor.js',
    '../src/commands/sync.js',
    '../src/commands/uninstall.js',
    '../src/lib/trae-checks.js',
    '../src/mcp/index.js',
    '../../mcp/src/index.js',
    '../templates/hooks.json',
    '../templates/mcp.json',
    '../templates/AGENTS.md',
    '../../../.trae/hooks.json',
    '../../../.trae/mcp.json',
    '../../../../README.md',
    '../../../../AGENTS.md',
    '../../../../docs/README.md',
    '../../../../docs/handoff.md',
    '../../../../lazytrae-evaluation.md',
    '../../../README.md',
    '../README.md',
  ];

  for (const relativePath of releasePaths) {
    const contents = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    assert.doesNotMatch(contents, /0\.15\.0-alpha\.3/, `${relativePath} retained alpha.3`);
    assert.match(contents, /0\.16\.0-alpha\.1/, `${relativePath} omitted alpha.1`);
  }
});
