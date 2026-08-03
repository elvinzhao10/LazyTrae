'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  checkAssets, installAssets, uninstallAssets,
} = require('./asset-ownership');
const { materializeHook } = require('./local-launcher');

const SOURCE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(SOURCE_ROOT, 'asset-source-manifest.v1.json');
const RECEIPT_PATH = '.lazytrae/asset-receipt.v1.json';

function hasProjectAssetReceipt(repoRoot) {
  return fs.existsSync(path.join(repoRoot, RECEIPT_PATH));
}

function optionsFor(repoRoot) {
  return {
    sourceRoot: SOURCE_ROOT,
    manifestPath: MANIFEST_PATH,
    destinationRoot: repoRoot,
    receiptPath: path.join(repoRoot, RECEIPT_PATH),
    transform(entry) {
      return entry.path === '.trae/hooks/user-prompt-submit.sh'
        ? Buffer.from(materializeHook(entry.bytes.toString('utf8')))
        : entry.bytes;
    },
  };
}

function checkProjectAssets(repoRoot) {
  return checkAssets(optionsFor(repoRoot));
}

function installProjectAssets(repoRoot) {
  return installAssets(optionsFor(repoRoot));
}

function uninstallProjectAssets(repoRoot) {
  return uninstallAssets(optionsFor(repoRoot));
}

module.exports = {
  RECEIPT_PATH, checkProjectAssets, hasProjectAssetReceipt, installProjectAssets, uninstallProjectAssets,
};
