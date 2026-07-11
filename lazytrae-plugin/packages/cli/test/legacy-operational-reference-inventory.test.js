const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT, runCli } = require('./test-helpers');

const OPERATIONAL_SOURCES = [
  'packages/cli/package.json',
  'packages/cli/README.md',
  'packages/cli/src/index.js',
  'packages/cli/src/commands/loop.js',
  'packages/cli/src/lib/loop-quality.js',
  'packages/cli/src/mcp/handlers-context.js',
  'packages/mcp/src/handlers-context.js',
];

test('operational CLI and MCP sources use LazyTrae-native names', () => {
  const help = runCli(['--help']);
  const loopHelp = runCli(['loop', '--help']);

  assert.equal(help.status, 0);
  assert.match(help.stdout, /Trae-native workflows/);
  assert.doesNotMatch(help.stdout, /lazycodex|\bomo\b/i);
  assert.equal(loopHelp.status, 0);
  assert.match(loopHelp.stdout, /canonical steering mutation/);
  assert.doesNotMatch(loopHelp.stdout, /lazycodex|\bomo\b/i);

  for (const relativePath of OPERATIONAL_SOURCES) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /lazycodex|\bomo\b/i, relativePath);
  }
});
