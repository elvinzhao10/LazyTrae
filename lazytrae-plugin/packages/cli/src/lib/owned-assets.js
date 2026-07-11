const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('./path-boundary');

function removeVerifiedFile(repoRoot, sourcePath, destinationPath) {
  if (!fs.existsSync(destinationPath)) return false;
  assertSafeRepoWritePath(repoRoot, destinationPath);
  const destination = fs.lstatSync(destinationPath);
  if (!destination.isFile()) return false;
  if (fs.readFileSync(sourcePath, 'utf8') !== fs.readFileSync(destinationPath, 'utf8')) return false;
  fs.unlinkSync(destinationPath);
  return true;
}

function removeVerifiedTree(repoRoot, sourceDir, destinationDir) {
  if (!fs.existsSync(destinationDir)) return 0;
  assertSafeRepoWritePath(repoRoot, destinationDir);
  let removed = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      removed += removeVerifiedTree(repoRoot, sourcePath, destinationPath);
      removeEmptyDir(repoRoot, destinationPath);
    } else if (entry.isFile() && removeVerifiedFile(repoRoot, sourcePath, destinationPath)) {
      removed++;
    }
  }
  return removed;
}

function removeEmptyDir(repoRoot, directory) {
  if (!fs.existsSync(directory)) return false;
  assertSafeRepoWritePath(repoRoot, directory);
  if (!fs.lstatSync(directory).isDirectory() || fs.readdirSync(directory).length !== 0) return false;
  fs.rmdirSync(directory);
  return true;
}

module.exports = { removeEmptyDir, removeVerifiedFile, removeVerifiedTree };
