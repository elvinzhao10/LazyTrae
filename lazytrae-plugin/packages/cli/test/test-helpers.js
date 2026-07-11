const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MONOREPO_ROOT = path.resolve(REPO_ROOT, '..');
const CLI = path.join(REPO_ROOT, 'packages', 'cli', 'src', 'index.js');
const QUALITY_GATE_PATH = '.lazytrae/evidence/quality.json';
const BAD_QUALITY_GATE_PATH = '.lazytrae/evidence/bad-quality.json';
const OLD_QUALITY_GATE_PATH = '.lazytrae/evidence/old-quality.json';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: options.cwd || REPO_ROOT,
    input: options.input,
    encoding: 'utf-8',
  });
}

function makeFixture(prefix = 'lazytrae-cli-test-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  fs.cpSync(path.join(REPO_ROOT, '.trae'), path.join(root, '.trae'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, '.lazytrae'), path.join(root, '.lazytrae'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'state'), path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'evidence'), path.join(root, '.lazytrae', 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'mcp', 'src'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'packages', 'mcp', 'src'), path.join(root, 'packages', 'mcp', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'cli', 'src', 'lib'), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'src', 'lib', 'completion-gates.js'),
    path.join(root, 'packages', 'cli', 'src', 'lib', 'completion-gates.js'),
  );
  fs.copyFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'src', 'lib', 'path-boundary.js'),
    path.join(root, 'packages', 'cli', 'src', 'lib', 'path-boundary.js'),
  );
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.copyFileSync(path.join(MONOREPO_ROOT, 'docs', 'reference', 'lazytrae-parity-ledger.md'), path.join(root, 'docs', 'lazytrae-parity-ledger.md'));
  fs.copyFileSync(path.join(__dirname, '..', 'templates', 'AGENTS.md'), path.join(root, 'AGENTS.md'));
  return root;
}

function writeActiveWork(root, task) {
  const boulderPath = path.join(root, '.lazytrae', 'state', 'boulder.json');
  const now = '2026-07-09T00:00:00Z';
  const boulder = {
    schema_version: 2,
    active_work_id: 'work-1',
    works: {
      'work-1': {
        work_id: 'work-1',
        active_plan: '.lazytrae/plans/demo.md',
        plan_name: 'demo',
        session_ids: [],
        status: 'active',
        worktree_path: null,
        tasks: [task],
        blockers: [],
        created_at: now,
        updated_at: now,
      },
    },
  };
  fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');
}

function makeCompletionFixture(prefix, complete) {
  const root = makeFixture(prefix);
  const task = { id: 'task-1', description: 'Gate task', status: complete ? 'complete' : 'in_progress', evidence_paths: [] };
  if (complete) {
    fs.mkdirSync(path.join(root, '.lazytrae', 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'task-1.md'), 'proof\n');
    task.evidence_paths = ['.lazytrae/evidence/task-1.md'];
    task.completed_at = '2026-07-09T00:00:00Z';
  }
  writeActiveWork(root, task);
  return root;
}

function makeLoopFixture(prefix = 'lazytrae-loop-test-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.lazytrae', 'schemas'), { recursive: true });
  fs.mkdirSync(path.join(root, '.lazytrae', 'evidence'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'state', 'active-loop.json'), path.join(root, '.lazytrae', 'state', 'active-loop.json'));
  fs.cpSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'schemas', 'active-loop.schema.json'), path.join(root, '.lazytrae', 'schemas', 'active-loop.schema.json'));
  fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'brief.md'), 'Ship the T1 loop runtime\n');
  fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'proof.txt'), 'observable proof\n');
  writeCanonicalQualityGate(root, QUALITY_GATE_PATH);
  const badGate = makeCanonicalQualityGate();
  badGate.manualQa.surfaceEvidence = [];
  writeJson(root, BAD_QUALITY_GATE_PATH, badGate);
  fs.writeFileSync(path.join(root, OLD_QUALITY_GATE_PATH), JSON.stringify({
    plan_reread: { status: 'pass' },
    automated_verification: { status: 'pass' },
    manual_qa: { status: 'pass' },
    adversarial_qa: { status: 'pass' },
    cleanup: { status: 'pass' },
  }, null, 2));
  return root;
}

function makeCanonicalQualityGate() {
  return {
    codeReview: {
      by: 'lazycodex-code-reviewer',
      recommendation: 'APPROVE',
      codeQualityStatus: 'CLEAR',
      reportPath: '.lazytrae/evidence/code-review.md',
      evidence: 'Reviewer approved the implementation and focused tests.',
      blockers: [],
    },
    manualQa: {
      by: 'lazycodex-qa-executor',
      status: 'passed',
      evidence: 'CLI checkpoint scenarios passed with captured artifacts.',
      surfaceEvidence: [{
        id: 'surface-cli-pass',
        criterionRef: 'crit-1',
        surface: 'cli',
        invocation: 'lazytrae loop checkpoint --quality-gate-json .lazytrae/evidence/quality.json',
        verdict: 'passed',
        artifactRefs: ['artifact-cli-pass'],
      }],
      adversarialCases: [{
        id: 'adv-old-gate',
        criterionRef: 'crit-1',
        scenario: 'old snake_case local gate is submitted',
        expectedBehavior: 'checkpoint rejects the non-canonical gate before mutating state',
        verdict: 'passed',
        artifactRefs: ['artifact-cli-reject'],
      }],
      artifactRefs: [
        { id: 'artifact-cli-pass', kind: 'cli-transcript', description: 'Valid checkpoint transcript.', path: '.lazytrae/evidence/cli-pass.txt' },
        { id: 'artifact-cli-reject', kind: 'log', description: 'Invalid checkpoint rejection log.', path: '.lazytrae/evidence/rejection.txt' },
      ],
    },
    gateReview: {
      by: 'lazycodex-gate-reviewer',
      recommendation: 'APPROVE',
      reportPath: '.lazytrae/evidence/gate-review.md',
      evidence: 'Gate reviewer approved the artifact-backed completion.',
      blockers: [],
    },
    iteration: {
      fullRerun: true,
      status: 'passed',
      rerunCommands: ['cd packages/cli && npm test'],
      evidence: 'Full CLI test suite passed.',
    },
    criteriaCoverage: {
      totalCriteria: 1,
      passCount: 1,
      originalIntent: 'Validate canonical LazyCodex quality gates.',
      desiredOutcome: 'Only artifact-backed canonical gates complete the loop.',
      userOutcomeReview: 'The checkpoint behavior matches the requested user-visible contract.',
      adversarialClassesCovered: ['old_local_gate', 'missing_artifact'],
    },
  };
}

function writeCanonicalQualityGate(root, relativePath, gate = makeCanonicalQualityGate()) {
  fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'code-review.md'), 'code review approved\n');
  fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'gate-review.md'), 'gate review approved\n');
  fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'cli-pass.txt'), 'checkpoint passed\n');
  fs.writeFileSync(path.join(root, '.lazytrae', 'evidence', 'rejection.txt'), 'checkpoint rejected invalid gate\n');
  writeJson(root, relativePath, gate);
  return gate;
}

function writeJson(root, relativePath, value) {
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(root, relativePath), JSON.stringify(value, null, 2) + '\n');
}

function readLoopState(root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'), 'utf-8'));
}

module.exports = {
  BAD_QUALITY_GATE_PATH,
  CLI,
  MONOREPO_ROOT,
  OLD_QUALITY_GATE_PATH,
  QUALITY_GATE_PATH,
  REPO_ROOT,
  makeCanonicalQualityGate,
  makeCompletionFixture,
  makeFixture,
  makeLoopFixture,
  readLoopState,
  runCli,
  writeCanonicalQualityGate,
  writeJson,
};
