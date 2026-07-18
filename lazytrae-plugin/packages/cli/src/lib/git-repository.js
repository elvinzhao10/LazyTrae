const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

function inspectGitMetadata(repoRoot) {
  const gitPath = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitPath)) {
    return { status: 'WARN', detail: 'Git metadata is absent; onboarding continues, but Git-backed workflows remain unavailable.' };
  }

  try {
    const stats = fs.lstatSync(gitPath);
    if (stats.isFile()) {
      const pointer = fs.readFileSync(gitPath, 'utf8').trim();
      const match = /^gitdir:\s*(.+)$/i.exec(pointer);
      if (!match) {
        return { status: 'WARN', detail: 'Git metadata pointer is invalid; onboarding continues, but Git-backed workflows remain unavailable.' };
      }
      const target = path.resolve(repoRoot, match[1]);
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        return { status: 'WARN', detail: 'Git metadata pointer target is missing; onboarding continues, but Git-backed workflows remain unavailable.' };
      }
    } else if (!stats.isDirectory()) {
      return { status: 'WARN', detail: 'Git metadata entry is not a directory or pointer; onboarding continues, but Git-backed workflows remain unavailable.' };
    }
  } catch (error) {
    return { status: 'WARN', detail: `Git metadata could not be inspected (${error.message}); onboarding continues.` };
  }

  const result = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (result.status === 0 && result.stdout.trim() === 'true') {
    return { status: 'PASS', detail: 'Git metadata is valid.' };
  }
  return { status: 'WARN', detail: 'Git metadata is present but Git could not validate this project; onboarding continues, but Git-backed workflows remain unavailable.' };
}

module.exports = { inspectGitMetadata };
