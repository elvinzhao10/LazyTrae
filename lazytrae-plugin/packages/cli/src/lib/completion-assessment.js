const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const AUTHORITY_SCHEMA = 'lazyseries.completion-authority.v1';
const EVIDENCE_SCHEMA = 'lazyseries.completion-evidence.v1';

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function reason(status, reasonCode, remediation, details = []) {
  return { status, reason_code: reasonCode, reasons: [reasonCode, ...details], remediation };
}

function readRecord(root, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) return { kind: 'invalid' };
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) return { kind: 'invalid' };
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) return { kind: 'invalid' };
    const bytes = fs.readFileSync(target);
    return { kind: 'ok', target, bytes };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'invalid' };
  }
}

function parseJSON(record) {
  if (record.kind !== 'ok') return null;
  try {
    const value = JSON.parse(record.bytes.toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (_) {
    return null;
  }
}

function gitOutput(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {
    return null;
  }
}

function currentIdentity(root) {
  const head = gitOutput(root, ['rev-parse', '--verify', 'HEAD']);
  if (!head || !/^[a-f0-9]{40,64}$/.test(head)) return null;
  const dirty = (gitOutput(root, ['status', '--porcelain=v1', '--untracked-files=all']) || '')
    .split('\n').filter(Boolean).map(line => line.slice(3).replace(/^"|"$/g, ''))
    .filter(file => !file.startsWith('.lazytrae/') && !file.startsWith('.lazybuddy/'));
  return { head, dirty };
}

function validAuthority(value) {
  return value && value.schema_version === AUTHORITY_SCHEMA && typeof value.run_id === 'string'
    && typeof value.repo_head === 'string' && typeof value.package_version === 'string'
    && value.plan && typeof value.plan.id === 'string' && typeof value.plan.path === 'string'
    && typeof value.plan.sha256 === 'string' && Array.isArray(value.criteria)
    && value.criteria.every(criterion => criterion && typeof criterion.criterion_id === 'string'
      && typeof criterion.task_id === 'string' && typeof criterion.applicable === 'boolean'
      && ['pending', 'in_progress', 'complete', 'failed', 'blocked'].includes(criterion.status)
      && typeof criterion.evidence_path === 'string' && typeof criterion.review_path === 'string');
}

function inspectCriterion(root, authority, criterion) {
  if (criterion.status !== 'complete') return ['blocked', 'CRITERION_UNFINISHED'];
  const plan = readRecord(root, authority.plan.path);
  if (plan.kind !== 'ok') return ['stale', 'PLAN_MISSING'];
  const escaped = criterion.criterion_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^- \\[x\\] \\[${escaped}\\](?:\\s|$)`, 'm').test(plan.bytes.toString('utf8'))) return ['blocked', 'CRITERION_UNCHECKED'];
  const evidenceRecord = readRecord(root, criterion.evidence_path);
  if (evidenceRecord.kind === 'missing') return ['blocked', 'EVIDENCE_MISSING'];
  const evidence = parseJSON(evidenceRecord);
  if (!evidence || evidence.schema_version !== EVIDENCE_SCHEMA) return ['blocked', 'EVIDENCE_MALFORMED'];
  if (evidence.repo_head !== authority.repo_head) return ['stale', 'EVIDENCE_REPO_HEAD_STALE'];
  if (evidence.package_version !== authority.package_version) return ['stale', 'EVIDENCE_PACKAGE_VERSION_STALE'];
  if (evidence.run_id !== authority.run_id || evidence.task_id !== criterion.task_id || evidence.criterion_id !== criterion.criterion_id) return ['blocked', 'EVIDENCE_IDENTITY_MISMATCH'];
  if (evidence.exit_code !== 0) return ['blocked', 'COMMAND_FAILED'];
  if (!evidence.artifact || typeof evidence.artifact.path !== 'string' || typeof evidence.artifact.sha256 !== 'string') return ['blocked', 'EVIDENCE_MALFORMED'];
  const artifact = readRecord(root, evidence.artifact.path);
  if (artifact.kind === 'missing') return ['blocked', 'ARTIFACT_MISSING'];
  if (artifact.kind !== 'ok' || digest(artifact.bytes) !== evidence.artifact.sha256) return ['blocked', 'ARTIFACT_TAMPERED'];
  const reviewRecord = readRecord(root, criterion.review_path);
  if (reviewRecord.kind === 'missing') return ['blocked', 'REVIEW_MISSING'];
  const review = parseJSON(reviewRecord);
  if (!review || !review.verifier || typeof review.verifier.identity !== 'string') return ['blocked', 'REVIEW_MALFORMED'];
  if (review.verdict !== 'approved') return ['blocked', 'REVIEW_UNAPPROVED'];
  if (!evidence.executor || !evidence.verifier || typeof evidence.executor.identity !== 'string' || evidence.verifier.identity !== review.verifier.identity) return ['blocked', 'REVIEW_IDENTITY_MISMATCH'];
  if (evidence.executor.identity === evidence.verifier.identity) return ['blocked', 'REVIEW_NOT_INDEPENDENT'];
  if (!evidence.review || evidence.review.verdict !== 'approved' || evidence.review.source_sha256 !== digest(reviewRecord.bytes)) return ['blocked', 'REVIEW_TAMPERED'];
  return ['ready', 'READY'];
}

function assessCompletion(root, options) {
  const remediation = options.remediationCommand;
  const authorityRecord = readRecord(root, options.authorityPath);
  if (authorityRecord.kind === 'missing') return reason('uninitialized', 'AUTHORITY_ABSENT', remediation);
  const authority = parseJSON(authorityRecord);
  if (!validAuthority(authority)) return reason('uninitialized', 'AUTHORITY_MALFORMED', remediation);
  const identity = currentIdentity(root);
  if (!identity) return reason('uninitialized', 'REPOSITORY_UNAVAILABLE', remediation);
  if (authority.repo_head !== identity.head) return reason('stale', 'REPO_HEAD_STALE', remediation);
  if (authority.package_version !== options.packageVersion) return reason('stale', 'PACKAGE_VERSION_STALE', remediation);
  const plan = readRecord(root, authority.plan.path);
  if (plan.kind !== 'ok' || digest(plan.bytes) !== authority.plan.sha256) return reason('stale', plan.kind === 'missing' ? 'PLAN_MISSING' : 'PLAN_DIGEST_STALE', remediation);
  const applicable = authority.criteria.filter(criterion => criterion.applicable);
  if (applicable.length === 0) return reason('not-applicable', 'NO_APPLICABLE_CRITERIA', remediation);
  if (identity.dirty.length > 0) return reason('blocked', 'WORKTREE_DIRTY', remediation, identity.dirty);
  const outcomes = applicable.map(criterion => inspectCriterion(root, authority, criterion));
  const stale = outcomes.find(([status]) => status === 'stale');
  if (stale) return reason(stale[0], stale[1], remediation);
  const blocked = outcomes.find(([status]) => status === 'blocked');
  if (blocked) return reason(blocked[0], blocked[1], remediation);
  return reason('ready', 'READY', remediation);
}

module.exports = { assessCompletion };
