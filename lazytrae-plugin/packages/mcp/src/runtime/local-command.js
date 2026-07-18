const fs = require('fs');
const path = require('path');

function localLauncherPath() {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'bin', 'lazytrae.js'),
    path.resolve(__dirname, '..', '..', '..', 'cli', 'bin', 'lazytrae.js'),
  ];
  const launcher = candidates.find(candidate => fs.existsSync(candidate));
  if (!launcher) throw new Error('Release-owned LazyTrae launcher is unavailable.');
  return fs.realpathSync(launcher);
}

function canonicalRepoRoot(repoRoot) {
  return fs.realpathSync(repoRoot);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function localCommand(repoRoot) {
  return `node ${shellQuote(localLauncherPath())} --root ${shellQuote(canonicalRepoRoot(repoRoot))}`;
}

module.exports = {
  canonicalRepoRoot,
  localCommand,
  localLauncherPath,
};
