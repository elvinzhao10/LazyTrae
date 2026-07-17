const fs = require('fs');
const path = require('path');
const { assertSafeAncestors, assertSafeRoot } = require('./tooling-root');

function assertEmptyProvisioningDestination(root) {
  assertSafeAncestors(root);
  if (!fs.existsSync(root)) return;
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) throw new Error('refusing symlinked tooling-root');
  if (!stat.isDirectory()) throw new Error('--tooling-root must be a directory');
  if (fs.readdirSync(root).length > 0) throw new Error('--tooling-root must be empty before install');
}

function createStagingRoot(root) {
  assertEmptyProvisioningDestination(root);
  const parent = path.dirname(root);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  assertSafeAncestors(root);
  return fs.mkdtempSync(path.join(parent, `.${path.basename(root)}.lazytrae-staging-`), { encoding: 'utf8' });
}

function discardStagingRoot(staging) {
  try {
    const stat = fs.lstatSync(staging);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('staging root was replaced; preserved for inspection');
    fs.rmSync(staging, { recursive: true, force: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }
}

function promoteStagingRoot(staging, root) {
  assertSafeRoot(staging, false);
  assertEmptyProvisioningDestination(root);
  if (fs.existsSync(root)) fs.rmdirSync(root);
  try {
    fs.renameSync(staging, root);
  } catch (error) {
    throw new Error(`tooling root changed during provisioning; preserved caller-owned state: ${error.message}`);
  }
}

module.exports = { createStagingRoot, discardStagingRoot, promoteStagingRoot };
