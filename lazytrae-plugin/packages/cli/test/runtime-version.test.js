const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const expectedVersion = require('../package.json').version;
const packagedMcp = require('../src/mcp');
const sourceMcp = require('../../mcp/src');
const RELEASE_VERSION = '1.0.1';

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

test('all LazyTrae MCP runtime entry points report the v1.0.1 package version', () => {
  assert.equal(initializeVersion(packagedMcp), expectedVersion);
  assert.equal(initializeVersion(sourceMcp), expectedVersion);
});

test('v1.0.1 package release identities are consistent', () => {
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
    '../src/commands/lsp.js',
    '../src/lib/trae-checks.js',
    '../src/mcp/index.js',
    '../../mcp/src/index.js',
    '../templates/hooks.json',
    '../templates/mcp.json',
    '../templates/AGENTS.md',
    '../../../.trae/hooks.json',
    '../../../.trae/mcp.json',
    '../package.json',
    '../../mcp/package.json',
    '../tooling/package.json',
    '../tooling/codegraph/package.json',
    '../tooling/lsp/python/package.json',
    '../tooling/lsp/typescript/package.json',
    '../tooling/package-lock.json',
    '../tooling/codegraph/package-lock.json',
    '../tooling/lsp/python/package-lock.json',
    '../tooling/lsp/typescript/package-lock.json',
  ];

  for (const relativePath of releasePaths) {
    const contents = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    assert.doesNotMatch(contents, /0\.16\.0-alpha\.1/, `${relativePath} retained the prior release identity`);
    assert.match(contents, /1\.0\.1/, `${relativePath} omitted v1.0.1`);
  }

  const notice = fs.readFileSync(path.join(__dirname, '../../../../NOTICE'), 'utf8');
  assert.match(notice, /LazyCodex: https:\/\/github\.com\/code-yeongyu\/lazycodex — MIT\./);
  assert.match(notice, /## Optional tooling dependencies/);
});

test('active package Trae configuration declares the current release version', () => {
  const packageRoot = path.join(__dirname, '../../..');
  const mcpConfiguration = JSON.parse(fs.readFileSync(path.join(packageRoot, '.trae/mcp.json'), 'utf8'));
  const hooksConfiguration = JSON.parse(fs.readFileSync(path.join(packageRoot, '.trae/hooks.json'), 'utf8'));

  assert.match(mcpConfiguration.lazytrae.description, new RegExp(`v${RELEASE_VERSION.replaceAll('.', '\\.')}`));
  assert.equal(hooksConfiguration.lazytrae.version, `v${RELEASE_VERSION}`);
});

test('active shipped runtime and template files contain no v0.7 release labels', () => {
  const activePaths = [
    '../src/lib/trae-checks.js',
    '../templates/hooks/dynamic-rules.sh',
    '../templates/hooks/post-tool-use.sh',
    '../templates/hooks/pre-tool-use.sh',
    '../templates/hooks/session-start.sh',
    '../templates/hooks/stop.sh',
    '../templates/hooks/user-prompt-submit.sh',
    '../../../.trae/hooks/dynamic-rules.sh',
    '../../../.trae/hooks/post-tool-use.sh',
    '../../../.trae/hooks/pre-tool-use.sh',
    '../../../.trae/hooks/session-start.sh',
    '../../../.trae/hooks/stop.sh',
    '../../../.trae/hooks/user-prompt-submit.sh',
  ];

  for (const relativePath of activePaths) {
    const contents = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    assert.doesNotMatch(contents, /v0\.7\b/, `${relativePath} retained a superseded runtime release label`);
    assert.match(contents, /v1\.0\.1\b/, `${relativePath} omitted the current runtime release label`);
  }
});

test('MCP entry points reject malformed input without misreporting their release version', () => {
  for (const entryPoint of ['../src/mcp/index.js', '../../mcp/src/index.js']) {
    const result = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, entryPoint)], {
      input: '{not json}\n',
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /LazyTrae MCP server v1\.0\.1 started/);
    assert.match(result.stdout, /"code":-32700/);
    assert.doesNotMatch(result.stdout, /0\.16\.0-alpha\.1/);
  }
});
