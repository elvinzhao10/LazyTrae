const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { safeFile } = require('./lifecycle/files');
const { validateReceipt } = require('./lifecycle/ownership');
const { productPaths } = require('./lifecycle/paths');
const { receiptFor } = require('./lifecycle/receipt');
const { LAUNCHER } = require('./lifecycle/state');

function releaseLauncherPath() {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'bin', 'lazytrae.js'),
    path.resolve(__dirname, '..', '..', '..', 'cli', 'bin', 'lazytrae.js'),
  ];
  const launcher = candidates.find(candidate => fs.existsSync(candidate));
  if (!launcher) throw new Error('Release-owned LazyTrae launcher is unavailable.');
  return fs.realpathSync(launcher);
}

function runtimeFingerprint(runtimePath) {
  return {
    path: runtimePath,
    fingerprint: {
      realpath: fs.realpathSync(runtimePath),
      version: process.version,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(runtimePath)).digest('hex'),
    },
  };
}

function durableContext(releaseLauncher) {
  let current = path.dirname(releaseLauncher);
  while (path.dirname(current) !== current) {
    if (path.basename(path.dirname(current)) === 'releases') {
      const releaseId = path.basename(current);
      const productRoot = path.dirname(path.dirname(current));
      const activePath = path.join(productRoot, 'active.json');
      const stableLauncher = path.join(productRoot, 'launcher.js');
      if (!fs.existsSync(activePath) || !fs.existsSync(stableLauncher)) return null;
      const launcherStat = fs.lstatSync(stableLauncher);
      if (!launcherStat.isFile() || launcherStat.isSymbolicLink() || launcherStat.nlink !== 1) {
        throw new Error('Durable LazyTrae launcher is unsafe.');
      }
      const active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
      const entry = path.resolve(current, active.entrypoint || '');
      if (active.active_release !== releaseId || entry !== releaseLauncher) return null;
      const paths = productPaths({ installRoot: path.dirname(productRoot), product: 'LazyTrae' });
      const { receipt } = receiptFor(paths, releaseId);
      validateReceipt(paths, receipt);
      const launcher = safeFile(stableLauncher);
      const launcherRecords = receipt.created_files.filter(item => item.path === receipt.layout.launcher);
      const launcherSha = crypto.createHash('sha256').update(launcher.bytes).digest('hex');
      if (launcherRecords.length !== 1 || launcherRecords[0].type !== 'file'
        || launcherRecords[0].mode !== '0755' || launcherRecords[0].sha256 !== launcherSha
        || !launcher.bytes.equals(Buffer.from(LAUNCHER))) {
        throw new Error('Durable LazyTrae launcher or receipt is stale.');
      }
      const runtime = runtimeFingerprint(process.execPath);
      if (!/^[0-9a-f]{40}$/.test(receipt.commit_sha)
        || receipt.release.id !== `${receipt.manifest.version}-${receipt.commit_sha.slice(0, 12)}`
        || receipt.runtime.path !== runtime.path
        || JSON.stringify(receipt.runtime.fingerprint) !== JSON.stringify(runtime.fingerprint)) {
        throw new Error('Durable LazyTrae runtime or receipt is stale.');
      }
      return { launcher: fs.realpathSync(stableLauncher), releaseSha: receipt.commit_sha, runtime };
    }
    current = path.dirname(current);
  }
  return null;
}

function localLauncherContext() {
  const releaseLauncher = releaseLauncherPath();
  return durableContext(releaseLauncher) || {
    launcher: releaseLauncher,
    releaseSha: null,
    runtime: runtimeFingerprint(process.execPath),
  };
}

function localLauncherPath() {
  return localLauncherContext().launcher;
}

function canonicalRepoRoot(repoRoot) {
  return fs.realpathSync(repoRoot);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function localCommand(repoRoot) {
  const context = localLauncherContext();
  const runtime = context.releaseSha === null ? 'node' : shellQuote(context.runtime.path);
  return `${runtime} ${shellQuote(context.launcher)} --root ${shellQuote(canonicalRepoRoot(repoRoot))}`;
}

module.exports = {
  canonicalRepoRoot,
  localCommand,
  localLauncherContext,
  localLauncherPath,
  runtimeFingerprint,
  shellQuote,
};
