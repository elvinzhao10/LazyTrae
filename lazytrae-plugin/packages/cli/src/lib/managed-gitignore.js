const MANAGED_START = '# lazytrae:managed:start:gitignore';
const MANAGED_END = '# lazytrae:managed:end:gitignore';
const MANAGED_BODY = [
  MANAGED_START,
  '# LazyTrae runtime (managed by lazytrae init)',
  '.lazytrae/state/',
  '.lazytrae/logs/',
  '.lazytrae/loop/',
  '.lazytrae/evidence/',
  MANAGED_END,
].join('\n');
const MANAGED_GITIGNORE_BLOCK = `\n${MANAGED_BODY}\n`;

function appendManagedGitignoreBlock(content) {
  if (content.includes(MANAGED_GITIGNORE_BLOCK)) return content;
  const start = content.indexOf(MANAGED_START);
  const end = start >= 0 ? content.indexOf(MANAGED_END, start) : -1;
  if (start >= 0 && end >= start) {
    return content.slice(0, start) + MANAGED_BODY + content.slice(end + MANAGED_END.length);
  }
  return content + MANAGED_GITIGNORE_BLOCK;
}

function removeManagedGitignoreBlock(content) {
  return content.replace(MANAGED_GITIGNORE_BLOCK, '');
}

module.exports = { appendManagedGitignoreBlock, removeManagedGitignoreBlock };
