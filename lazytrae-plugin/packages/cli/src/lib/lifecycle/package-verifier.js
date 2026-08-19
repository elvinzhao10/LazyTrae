'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { LifecycleError } = require('./errors');
const { safeFile } = require('./files');
const { CURRENT_VERSION: VERSION } = require('../version');

const CONTRACT_DIGESTS = Object.freeze({
  'lazy-harness-active.v2.schema.json': '7ad41dbd2179791438e95690cdf234034e488dc93b724cf1dad261531cfcfd30',
  'lazy-harness-lifecycle.v1.example.json': '6b10b60074fd9dac366b9b92d22daf06de73e76f8530cc376b58fcae20b05445',
  'lazy-harness-lifecycle.v1.schema.json': 'd43ed27597e97f93d1be408472d2640171eee9d73b0e49d3c7332993bbc04388',
  'lazy-harness-lifecycle.v2.schema.json': '7e815d14f0b311a1f680443939d192b04360552339d10bac9dec34aae494f806',
});
const PRODUCTS = Object.freeze({
  LazyBuddy: {
    entrypoint: 'lazybuddy-plugin/scripts/lifecycle.js',
    manifest: 'lazybuddy-plugin/.codebuddy-plugin/plugin.json',
    manifests: [
      ['lazybuddy-plugin/.codebuddy-plugin/plugin.json', 'lazybuddy'],
      ['lazybuddy-plugin/.workbuddy-plugin/plugin.json', 'lazybuddy'],
    ],
    selfTest: 'lazybuddy-plugin/scripts/lifecycle-self-test.js',
    contracts: 'lazybuddy-plugin/contracts',
  },
  LazyTrae: {
    entrypoint: 'lazytrae-plugin/packages/cli/bin/lazytrae.js',
    manifest: 'lazytrae-plugin/packages/cli/package.json',
    manifests: [['lazytrae-plugin/packages/cli/package.json', 'lazytrae-ai']],
    selfTest: 'lazytrae-plugin/packages/cli/scripts/lifecycle-self-test.js',
    contracts: 'lazytrae-plugin/packages/cli/contracts',
  },
});

function verifyStagedPackage(root, product) {
  const spec = PRODUCTS[product];
  if (!spec) throw new LifecycleError('INVALID_MANIFEST', 'unknown product');
  for (const [relativePath, packageName] of spec.manifests) {
    let manifest;
    try {
      manifest = JSON.parse(safeFile(path.join(root, relativePath), 'INVALID_MANIFEST').bytes.toString('utf8'));
    } catch (error) {
      if (error instanceof LifecycleError) throw error;
      throw new LifecycleError('INVALID_MANIFEST', `package manifest is not valid JSON: ${relativePath}`, error);
    }
    if (manifest.name !== packageName || manifest.version !== VERSION) {
      throw new LifecycleError('INVALID_MANIFEST', `expected ${packageName} v${VERSION}: ${relativePath}`);
    }
  }
  for (const [name, expected] of Object.entries(CONTRACT_DIGESTS)) {
    const contract = safeFile(path.join(root, spec.contracts, name), 'CHECKSUM_MISMATCH').bytes;
    const checksum = safeFile(path.join(root, spec.contracts, `${name}.sha256`), 'CHECKSUM_MISMATCH').bytes.toString('utf8');
    const actual = crypto.createHash('sha256').update(contract).digest('hex');
    if (actual !== expected || checksum !== `${expected}  ${name}\n`) {
      throw new LifecycleError('CHECKSUM_MISMATCH', `contract integrity failed: ${name}`);
    }
  }
  safeFile(path.join(root, spec.entrypoint), 'INVALID_ENTRYPOINT');
  safeFile(path.join(root, spec.selfTest), 'SELF_TEST_FAILED');
  return { entrypoint: spec.entrypoint, manifest: spec.manifest, selfTest: spec.selfTest, version: VERSION };
}

module.exports = { CONTRACT_DIGESTS, PRODUCTS, VERSION, verifyStagedPackage };
