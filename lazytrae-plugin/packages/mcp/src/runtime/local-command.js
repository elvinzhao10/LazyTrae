const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
      const receipts = fs.readdirSync(path.join(productRoot, 'receipts'))
        .filter(name => name.endsWith(`-${releaseId.slice(-12)}.json`));
      if (receipts.length !== 1) throw new Error('Durable LazyTrae receipt is unavailable.');
      const receipt = JSON.parse(fs.readFileSync(path.join(productRoot, 'receipts', receipts[0]), 'utf8'));
      const runtime = runtimeFingerprint(process.execPath);
      if (receipt.commit_sha === undefined || receipt.runtime.path !== runtime.path
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
