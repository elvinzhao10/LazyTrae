const assert = require('node:assert/strict');
const test = require('node:test');
const { packageDependencies } = require('../src/lib/tooling-capabilities');
const manifest = require('../tooling/package.json');
const lock = require('../tooling/package-lock.json');

test('owned search provider provisioning uses the published package pins', () => {
  const dependencies = packageDependencies(['ripgrep', 'ast-grep']);

  assert.deepEqual(dependencies, manifest.optionalDependencies);
  assert.deepEqual(dependencies, lock.packages[''].optionalDependencies);
  for (const [name, version] of Object.entries(dependencies)) {
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
});
