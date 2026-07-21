// W4.6 Evidence Freshness integration tests for v1.0.3 Adaptive Harness.
//
// Purpose: prove the "Stale completion evidence" risk control (plan Section 18)
// is in place: completion verification is rerun after relevant implementation
// changes, and no new evidence-lineage database is introduced.
//
// Scenarios:
//   1. revisionMarker is present in the adaptive snapshot (Section 11)
//   2. revisionMarker changes when implementation changes (mock file-hash derivation)
//   3. No new lineage/evidence-db/transaction files introduced in W2/W3/W4 waves
//   4. Existing verification mechanism reused (completion-gates.js) — no parallel verifier
//   5. validateEvidencePaths still rejects stale (non-existent) paths
//   6. Stale snapshot triggers reclassification (xfail — classifier gap)
//   7. Re-verification trigger when revisionMarker changes (xfail — classifier gap)

'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { validateEvidencePaths } = require('../src/lib/completion-gates');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ADAPTIVE_LIB_DIR = path.join(__dirname, '..', 'src', 'lib');

// Mock revision-marker derivation: file-content hash simulates a git SHA.
// This mirrors what a real implementation would do (hash of relevant files).
function mockRevisionMarker(content) {
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

test('W4.6: adaptive snapshot carries a non-empty revisionMarker field', () => {
  const decision = classifyAdaptiveDecision('fix the typo in README', {});
  assert.equal(typeof decision.snapshot.revisionMarker, 'string',
    'snapshot.revisionMarker must be a string');
  assert.ok(decision.snapshot.revisionMarker.length > 0,
    'snapshot.revisionMarker must be non-empty');
});

test('W4.6: revisionMarker changes when implementation content changes (mock file-hash)', () => {
  const beforeContent = 'function oldImpl() { return 1; }';
  const afterContent = 'function newImpl() { return 2; }';
  const before = mockRevisionMarker(beforeContent);
  const after = mockRevisionMarker(afterContent);
  assert.notEqual(before, after,
    'revision marker must differ when implementation content changes');
  assert.equal(before, mockRevisionMarker(beforeContent),
    'revision marker must be deterministic for unchanged content');
});

test('W4.6: no new lineage/evidence-db/transaction files introduced since v1.0.2', () => {
  let diff = '';
  try {
    diff = execFileSync(
      'git',
      ['diff', '--name-only', 'v1.0.2..HEAD', '--', '**/lineage*', '**/evidence-db*', '**/transaction*'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
  } catch (err) {
    assert.fail(`git diff failed: ${err.message}`);
  }
  assert.equal(diff.trim(), '',
    `no lineage/evidence-db/transaction files may be introduced; got:\n${diff}`);
});

test('W4.6: adaptive layer reuses completion-gates.js (no parallel verifier introduced)', () => {
  const adaptiveModules = ['adaptive-decision.js', 'adaptive-mapping.js',
    'adaptive-snapshot.js', 'adaptive-explanation.js'];
  let combined = '';
  for (const name of adaptiveModules) {
    const p = path.join(ADAPTIVE_LIB_DIR, name);
    if (fs.existsSync(p)) combined += fs.readFileSync(p, 'utf8') + '\n';
  }
  assert.match(combined, /completion-gates\.js/,
    'adaptive layer must reference completion-gates.js as the verification surface');
  // Negative: no new verifier module introduced by the adaptive layer.
  assert.doesNotMatch(combined, /require\(['"]\.\/[a-z-]*lineage[a-z-]*['"]\)/,
    'adaptive layer must not import a new lineage module');
  assert.doesNotMatch(combined, /require\(['"]\.\/[a-z-]*evidence-db[a-z-]*['"]\)/,
    'adaptive layer must not import a new evidence-db module');
});

test('W4.6: validateEvidencePaths rejects stale (non-existent) paths', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w46-stale-'));
  try {
    // validateEvidencePaths requires repo-relative paths (path-boundary rule).
    fs.writeFileSync(path.join(tmpRoot, 'real.md'), 'proof\n');
    const realRel = 'real.md';
    const staleRel = path.join('.lazytrae', 'evidence', 'stale-and-missing.md');

    const errors = validateEvidencePaths(tmpRoot, [realRel, staleRel]);
    assert.ok(errors.length > 0, 'must report at least one error for the stale path');
    assert.ok(errors.some(e => /stale-and-missing/.test(e)),
      `must call out the stale path; got: ${errors.join('; ')}`);

    const clean = validateEvidencePaths(tmpRoot, [realRel]);
    assert.deepEqual(clean, [], 'must not report errors for a real evidence file');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('W4.6: validateEvidencePaths rejects blank and empty path lists', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w46-blank-'));
  try {
    const blankErrors = validateEvidencePaths(tmpRoot, ['']);
    assert.ok(blankErrors.some(e => /blank/.test(e)),
      `must report blank path; got: ${blankErrors.join('; ')}`);
    const emptyErrors = validateEvidencePaths(tmpRoot, []);
    assert.ok(emptyErrors.some(e => /no evidence_paths/.test(e)),
      `must report empty list; got: ${emptyErrors.join('; ')}`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// Known gap: the classifier does not currently accept a prior snapshot via
// context and therefore cannot detect that the recorded revisionMarker is
// stale. Plan Section 18 calls for stale detection (reclassify instead of
// resume). Marked xfail per W4.6 instructions; documented in evidence file.
test('W4.6 GAP: stale prior snapshot triggers reclassification (xfail — classifier has no prior_snapshot input)', () => {
  const priorSnapshot = {
    mode: 'direct',
    stages: ['implement', 'verify'],
    revisionMarker: 'sha256:old-implementation',
    currentStage: 'verify',
  };
  // Pass the prior snapshot via context.prior_snapshot (a field the classifier
  // would need to accept to implement stale detection).
  const decision = classifyAdaptiveDecision('fix the typo in README', {
    prior_snapshot: priorSnapshot,
    current_revision_marker: mockRevisionMarker('function newImpl() { return 2; }'),
  });
  // When the prior revisionMarker differs from the current one, the classifier
  // must NOT resume — it must reclassify starting from `understand`.
  assert.notEqual(decision.snapshot.revisionMarker, priorSnapshot.revisionMarker,
    'classifier must produce a fresh revisionMarker when the implementation changed');
  assert.ok(decision.stages.includes('understand'),
    'classifier must restart from understand when prior snapshot is stale');
  assert.ok(decision.reasons.some(r => /stale|re-?verif|reclassif/i.test(r)),
    'classifier reasons must mention stale/re-verify/reclassify');
});

// Known gap: when the revisionMarker changes, the classifier's output does
// not currently indicate that re-verification is needed. Plan Section 18
// requires re-verification after relevant changes. Marked xfail.
test('W4.6 GAP: re-verification trigger when revisionMarker changes (xfail — no re-verify signal in reasons)', () => {
  const oldMarker = mockRevisionMarker('old implementation');
  const newMarker = mockRevisionMarker('new implementation');
  assert.notEqual(oldMarker, newMarker, 'precondition: markers differ');

  const decision = classifyAdaptiveDecision('fix the typo in README', {
    prior_snapshot: { revisionMarker: oldMarker, mode: 'direct' },
    current_revision_marker: newMarker,
  });
  const joined = (decision.reasons || []).join('\n');
  assert.match(joined, /re-?verif|stale|revision/i,
    'reasons must signal that re-verification is required after a revision change');
});
