const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const expectedVersion = require('../package.json').version;
const packagedMcp = require('../src/mcp');
const sourceMcp = require('../../mcp/src');

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
