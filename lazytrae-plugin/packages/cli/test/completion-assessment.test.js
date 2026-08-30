const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { assessCompletion } = require('../src/lib/completion-assessment');
const { runCli } = require('./test-helpers');
const EXPECTED_MUTATION_REASONS = require('../contracts/fixtures/v120/completion-assessment-reasons.json');

const VERSION = '1.2.0';
const STATE = '.lazytrae/state/completion-authority.json';
const FIXTURE_ROOTS = new Set();
test.after(() => { for (const root of FIXTURE_ROOTS) fs.rmSync(root, { recursive: true, force: true }); });

function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function write(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}
function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-completion-v120-'));
  FIXTURE_ROOTS.add(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'completion@example.invalid');
  git(root, 'config', 'user.name', 'Completion Fixture');
  write(root, '.gitignore', '.lazytrae/\n');
  write(root, 'tracked.txt', 'current\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'fixture');
  const head = git(root, 'rev-parse', 'HEAD');
  const plan = '# Plan\n\n## TODOs\n- [x] [criterion-1] observable outcome\n';
  const artifact = 'observable proof\n';
  const review = { verdict: 'approved', verifier: { identity: 'verifier-1' } };
  write(root, '.lazytrae/plans/plan.md', plan);
  write(root, '.lazytrae/evidence/artifact.txt', artifact);
  write(root, '.lazytrae/reviews/review.json', review);
  const evidence = {
    schema_version: 'lazyseries.completion-evidence.v1', run_id: 'run-1', task_id: 'task-1', criterion_id: 'criterion-1',
    repo_head: head, package_version: VERSION, command: 'node --test completion', exit_code: 0,
    started_at: '2026-08-27T10:00:00Z', finished_at: '2026-08-27T10:00:01Z',
    artifact: { path: '.lazytrae/evidence/artifact.txt', sha256: sha(artifact) },
    executor: { identity: 'executor-1' }, verifier: { identity: 'verifier-1' },
    review: { verdict: 'approved', source_sha256: sha(`${JSON.stringify(review, null, 2)}\n`) },
  };
  write(root, '.lazytrae/evidence/criterion-1.json', evidence);
  const authority = {
    schema_version: 'lazyseries.completion-authority.v1', run_id: 'run-1', repo_head: head, package_version: VERSION,
    plan: { id: 'plan-1', path: '.lazytrae/plans/plan.md', sha256: sha(plan) },
    criteria: [{ criterion_id: 'criterion-1', task_id: 'task-1', applicable: true, status: 'complete', evidence_path: '.lazytrae/evidence/criterion-1.json', review_path: '.lazytrae/reviews/review.json' }],
  };
  write(root, STATE, authority);
  return { root, authority, evidence };
}
function assess(root) { return assessCompletion(root, { authorityPath: STATE, packageVersion: VERSION, remediationCommand: 'lazytrae completion-status' }); }

test('five-state precedence is fail-closed', () => {
  const f = fixture();
  const table = [
    ['uninitialized', 'AUTHORITY_MALFORMED', () => write(f.root, STATE, '{')],
    ['stale', 'REPO_HEAD_STALE', () => write(f.root, STATE, { ...f.authority, repo_head: '0'.repeat(40), criteria: [] })],
    ['not-applicable', 'NO_APPLICABLE_CRITERIA', () => write(f.root, STATE, { ...f.authority, criteria: [] })],
    ['blocked', 'CRITERION_UNFINISHED', () => write(f.root, STATE, { ...f.authority, criteria: [{ ...f.authority.criteria[0], status: 'failed' }] })],
    ['ready', 'READY', () => write(f.root, STATE, f.authority)],
  ];
  for (const [state, reason, arrange] of table) {
    arrange();
    const result = assess(f.root);
    assert.equal(result.status, state);
    assert.equal(result.reason_code, reason);
  }
});

test('current evidence is ready and identity, review, criteria, and bytes mutations are non-ready', () => {
  const mutations = [
    ['same executor and verifier', 'blocked', 'REVIEW_NOT_INDEPENDENT', f => {
      const review = { verdict: 'approved', verifier: { identity: 'executor-1' } };
      write(f.root, '.lazytrae/reviews/review.json', review);
      write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, verifier: { identity: 'executor-1' }, review: { verdict: 'approved', source_sha256: sha(`${JSON.stringify(review, null, 2)}\n`) } });
    }],
    ['stale head', 'stale', 'REPO_HEAD_STALE', f => write(f.root, STATE, { ...f.authority, repo_head: '0'.repeat(40) })],
    ['stale version', 'stale', 'PACKAGE_VERSION_STALE', f => write(f.root, STATE, { ...f.authority, package_version: '9.9.9' })],
    ['stale plan digest', 'stale', 'PLAN_DIGEST_STALE', f => write(f.root, '.lazytrae/plans/plan.md', 'changed plan\n')],
    ['evidence head drift', 'stale', 'EVIDENCE_REPO_HEAD_STALE', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, repo_head: '0'.repeat(40) })],
    ['evidence version drift', 'stale', 'EVIDENCE_PACKAGE_VERSION_STALE', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, package_version: '9.9.9' })],
    ['run identity drift', 'blocked', 'EVIDENCE_IDENTITY_MISMATCH', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, run_id: 'other-run' })],
    ['task identity drift', 'blocked', 'EVIDENCE_IDENTITY_MISMATCH', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, task_id: 'other-task' })],
    ['criterion identity drift', 'blocked', 'EVIDENCE_IDENTITY_MISMATCH', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, criterion_id: 'other-criterion' })],
    ['unchecked criterion', 'blocked', 'CRITERION_UNCHECKED', f => {
      const plan = '# Plan\n\n## TODOs\n- [ ] [criterion-1] observable outcome\n';
      write(f.root, '.lazytrae/plans/plan.md', plan); write(f.root, STATE, { ...f.authority, plan: { ...f.authority.plan, sha256: sha(plan) } });
    }],
    ['missing review', 'blocked', 'REVIEW_MISSING', f => fs.unlinkSync(path.join(f.root, '.lazytrae/reviews/review.json'))],
    ['missing evidence', 'blocked', 'EVIDENCE_MISSING', f => fs.unlinkSync(path.join(f.root, '.lazytrae/evidence/criterion-1.json'))],
    ['review digest drift', 'blocked', 'REVIEW_TAMPERED', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, review: { ...f.evidence.review, source_sha256: '0'.repeat(64) } })],
    ['residual-risk review', 'blocked', 'RESIDUAL_RISK_NON_AUTHORITATIVE', f => write(f.root, '.lazytrae/reviews/review.json', {
      kind: 'residual-risk', scope: 'criterion-1', revision: f.authority.repo_head, authoritative_for_completion: false,
    })],
    ['unapproved review', 'blocked', 'REVIEW_UNAPPROVED', f => write(f.root, '.lazytrae/reviews/review.json', { verdict: 'needs-fix', verifier: { identity: 'verifier-1' } })],
    ['artifact tampering', 'blocked', 'ARTIFACT_TAMPERED', f => write(f.root, '.lazytrae/evidence/artifact.txt', 'tampered\n')],
    ['nonzero command', 'blocked', 'COMMAND_FAILED', f => write(f.root, '.lazytrae/evidence/criterion-1.json', { ...f.evidence, exit_code: 9 })],
    ['valid residual-risk receipt', 'blocked', 'RESIDUAL_RISK_NON_AUTHORITATIVE', f => write(f.root, '.lazytrae/evidence/criterion-1.json', {
      kind: 'residual-risk', scope: 'criterion-1', revision: f.authority.repo_head, authoritative_for_completion: false,
    })],
    ['forged residual-risk authority', 'blocked', 'RESIDUAL_RISK_MALFORMED', f => write(f.root, '.lazytrae/evidence/criterion-1.json', {
      kind: 'residual-risk', scope: 'criterion-1', revision: f.authority.repo_head, authoritative_for_completion: true,
    })],
    ['stale residual-risk receipt', 'blocked', 'RESIDUAL_RISK_MALFORMED', f => write(f.root, '.lazytrae/evidence/criterion-1.json', {
      kind: 'residual-risk', scope: 'criterion-1', revision: 'stale-revision', authoritative_for_completion: false,
    })],
    ['dirty worktree', 'blocked', 'WORKTREE_DIRTY', f => write(f.root, 'untracked.txt', 'dirty\n')],
  ];
  const ready = fixture();
  const current = assess(ready.root);
  assert.deepEqual([current.status, current.reason_code], ['ready', 'READY']);
  const observedReasons = [current.reason_code];
  for (const [name, state, reason, mutate] of mutations) {
    const f = fixture(); mutate(f);
    const result = assess(f.root);
    assert.equal(result.status, state, name);
    assert.equal(result.reason_code, reason, name);
    assert.match(result.remediation, /completion-status/);
    const surface = runCli(['completion-status', '--json'], { cwd: f.root });
    assert.equal(surface.status, 1, name);
    assert.deepEqual([JSON.parse(surface.stdout).status, JSON.parse(surface.stdout).reason_code], [state, reason], name);
    observedReasons.push(result.reason_code);
  }
  assert.deepEqual(observedReasons, EXPECTED_MUTATION_REASONS);
});

test('absent authority and legacy path-only evidence never report ready', () => {
  const f = fixture();
  fs.unlinkSync(path.join(f.root, STATE));
  write(f.root, '.lazytrae/state/boulder.json', { active_work_id: null, works: { old: { tasks: [{ status: 'complete', evidence_paths: ['.lazytrae/evidence/artifact.txt'] }] } } });
  const result = assess(f.root);
  assert.deepEqual([result.status, result.reason_code], ['uninitialized', 'AUTHORITY_ABSENT']);
});

test('nine failed criteria and unchecked plan cannot reproduce false-ready', () => {
  const f = fixture();
  const plan = `# Plan\n\n## TODOs\n${Array.from({ length: 9 }, (_, i) => `- [ ] [criterion-${i + 1}] failure`).join('\n')}\n`;
  const criteria = Array.from({ length: 9 }, (_, i) => ({ ...f.authority.criteria[0], criterion_id: `criterion-${i + 1}`, task_id: `task-${i + 1}`, status: 'failed' }));
  write(f.root, '.lazytrae/plans/plan.md', plan);
  write(f.root, STATE, { ...f.authority, plan: { ...f.authority.plan, sha256: sha(plan) }, criteria });
  const result = assess(f.root);
  assert.deepEqual([result.status, result.reason_code], ['blocked', 'CRITERION_UNFINISHED']);
  const surface = runCli(['completion-status', '--json'], { cwd: f.root });
  assert.deepEqual([surface.status, JSON.parse(surface.stdout).reason_code], [1, 'CRITERION_UNFINISHED']);
});

test('CLI and MCP status surfaces expose the same ready assessment', () => {
  const f = fixture();
  const cli = runCli(['completion-status', '--json'], { cwd: f.root });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.deepEqual([JSON.parse(cli.stdout).status, JSON.parse(cli.stdout).reason_code], ['ready', 'READY']);

  const { HANDLERS } = require('../../mcp/src/tools');
  const handoff = HANDLERS['lazytrae.generate_handoff'](f.root, {});
  assert.deepEqual([handoff.completion_gate.status, handoff.completion_gate.reason_code], ['ready', 'READY']);
});
