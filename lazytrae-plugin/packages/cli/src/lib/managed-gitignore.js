const MANAGED_GITIGNORE_BLOCK = [
  '',
  '# lazytrae:managed:start:gitignore',
  '# LazyTrae runtime (managed by lazytrae init)',
  '.lazytrae/state/',
  '.lazytrae/logs/',
  '.lazytrae/evidence/',
  '# lazytrae:managed:end:gitignore',
  '',
].join('\n');

function appendManagedGitignoreBlock(content) {
  if (content.includes(MANAGED_GITIGNORE_BLOCK)) return content;
  return content + MANAGED_GITIGNORE_BLOCK;
}

function removeManagedGitignoreBlock(content) {
  return content.replace(MANAGED_GITIGNORE_BLOCK, '');
}

module.exports = { appendManagedGitignoreBlock, removeManagedGitignoreBlock };
