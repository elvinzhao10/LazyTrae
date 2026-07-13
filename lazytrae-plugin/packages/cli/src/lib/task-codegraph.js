const fs = require('fs');
const path = require('path');
const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.go', '.java', '.js', '.jsx', '.kt', '.py', '.rb', '.rs', '.swift', '.ts', '.tsx']);

function lockPath(workspace) {
  return path.join(workspace, '.codegraph', '.lazytrae-index.lock');
}

function acquire(lock, staleMs) {
  fs.mkdirSync(path.dirname(lock), { recursive: true, mode: 0o700 });
  try { return fs.openSync(lock, 'wx', 0o600); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age <= staleMs) return null;
    fs.rmSync(lock, { force: true });
    return fs.openSync(lock, 'wx', 0o600);
  }
}

function sourceCount(directory, limit, count = 0) {
  if (count > limit) return count;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.codegraph', '.git', '.lazytrae', 'node_modules'].includes(entry.name) || entry.isSymbolicLink()) continue;
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) count = sourceCount(candidate, limit, count);
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) count += 1;
    if (count > limit) return count;
  }
  return count;
}

async function indexTaskScoped(input) {
  if (!input.approval || input.approval.kind !== 'allowed') return { status: 'denied', code: 'AUTOMATIC_TOOLING_PERMISSION_DENIED' };
  const workspace = fs.realpathSync(input.workspace);
  const lock = lockPath(workspace);
  const descriptor = acquire(lock, input.staleMs || 300000);
  if (descriptor === null) return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_INDEX_LOCKED' };
  try {
    const index = path.join(workspace, '.codegraph', 'codegraph.db');
    const maxFiles = input.maxFiles || 20000;
    const quotaBytes = input.quotaBytes || 1024 * 1024 * 1024;
    if (sourceCount(workspace, maxFiles) > maxFiles) return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_INDEX_THRESHOLD_EXCEEDED' };
    const existed = fs.existsSync(index);
    if (existed && fs.statSync(index).size > quotaBytes) return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_INDEX_QUOTA_EXCEEDED' };
    await input.initialize({ workspace, excludes: ['.git', '.lazytrae', 'node_modules'], maxFiles });
    if (!fs.existsSync(index)) return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE' };
    if (fs.statSync(index).size > quotaBytes) {
      if (!existed) fs.rmSync(index, { force: true });
      return { status: 'unavailable', code: 'AUTOMATIC_TOOLING_INDEX_QUOTA_EXCEEDED' };
    }
    return { status: 'success', index, ownership: 'caller' };
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(lock, { force: true });
  }
}

module.exports = { indexTaskScoped, lockPath };
