const fs = require('fs');
const path = require('path');
const { localCommand } = require('./local-command');
const { resolveRepoPath } = require('./path-boundary');
const { assessCompletion } = require('./completion-assessment');
const PACKAGE_VERSION = require('../../package.json').version;

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (fs.existsSync(path.join(dir, '.lazytrae'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function validateEvidencePaths(repoRoot, evidencePaths) {
  if (!Array.isArray(evidencePaths) || evidencePaths.length === 0) {
    return ['no evidence_paths recorded'];
  }
  const errors = [];
  for (const evidencePath of evidencePaths) {
    if (typeof evidencePath !== 'string' || evidencePath.trim() === '') {
      errors.push('blank evidence path');
      continue;
    }
    const resolved = resolveRepoPath(repoRoot, evidencePath, { mustExist: true });
    if (!resolved.ok) {
      if (resolved.error.startsWith('path does not exist')) errors.push(`evidence missing: ${evidencePath}`);
      else errors.push(`invalid evidence path: ${evidencePath} (${resolved.error})`);
      continue;
    }
    const stat = fs.statSync(resolved.path);
    if (!stat.isFile()) errors.push(`evidence is not a file: ${evidencePath}`);
    else if (stat.size === 0) errors.push(`evidence empty: ${evidencePath}`);
  }
  return errors;
}

function getCompletionStatus(repoRoot = detectRepoRoot()) {
  const assessed = assessCompletion(repoRoot, {
    authorityPath: '.lazytrae/state/completion-authority.json',
    packageVersion: PACKAGE_VERSION,
    remediationCommand: `${localCommand(repoRoot)} completion-status`,
  });
  return {
    ...assessed,
    reasons: assessed.reasons.map(code => ({ gate: code, message: code })),
    next_command: assessed.status === 'ready' ? null : assessed.remediation,
  };
}

function formatCompletionStatus(result) {
  const lines = [result.status];
  if (result.status === 'ready') {
    lines.push('Completion gates satisfied.');
    return lines.join('\n');
  }
  for (const reason of result.reasons) lines.push(`- [${reason.gate}] ${reason.message}`);
  lines.push(`Next command: ${result.next_command || `${localCommand(detectRepoRoot())} completion-status`}`);
  return lines.join('\n');
}

module.exports = {
  detectRepoRoot,
  formatCompletionStatus,
  getCompletionStatus,
  validateEvidencePaths,
};
