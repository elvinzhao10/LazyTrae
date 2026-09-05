const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('Given the installed dependency tree, when every fast-uri edge is listed, then direct and Ajv copies are patched', () => {
  const root = path.join(__dirname, '..');
  const tree = JSON.parse(execFileSync('npm', ['ls', 'fast-uri', '--all', '--json'], { cwd: root, encoding: 'utf8' }));
  const direct = tree.dependencies['fast-uri'].version;
  const nested = tree.dependencies.ajv.dependencies['fast-uri'].version;
  assert.equal(direct, '4.1.4');
  assert.equal(nested, '3.1.7');
});
