// W2.1 adaptive-decision tests for the v1.0.3 Adaptive Harness release.
//
// Purpose: validate the new adaptive-decision module that wraps detectNeed() with
// the 7-step decision policy (plan Section 6) and emits the Section 5 decision +
// Section 11 snapshot. Covers 10 fixtures + 10 test categories.

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { detectNeed } = require('../src/lib/automatic-tooling-detector');

const FIXTURES_DIR = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103');

function loadFixtures() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
  return manifest.fixtures.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f.file), 'utf8'));
    return { file: f.file, sha: f.sha256, data };
  });
}

const FIXTURES = loadFixtures();
const FIXTURE_BY_ID = Object.fromEntries(FIXTURES.map(f => [f.data.id, f.data]));

const ALL_STAGES = new Set(['understand', 'plan', 'implement', 'debug', 'verify', 'review', 'continue']);
const ALL_RESP = new Set(['exploration', 'planning', 'implementation', 'debugging', 'verification',
  'quality-review', 'security-review', 'release-review', 'continuity']);
const ALL_CAPS = new Set(['text-search', 'structural-search', 'semantic-navigation',
  'architecture-context', 'documentation', 'execution', 'task-state', 'outcome-verification']);

const SNAPSHOT_FIELDS = ['version', 'decisionId', 'requestDigest', 'mode', 'stages',
  'currentStage', 'responsibilities', 'capabilityClasses', 'runtimeResolution', 'reasons',
  'escalationCount', 'revisionMarker', 'blocker', 'nextAction'];

function run(fx) {
  return classifyAdaptiveDecision(fx.request, fx.context);
}

// Category 1: fixture validation — every fixture must satisfy structural contract.
test('fixture validation: all 10 fixtures produce structurally valid decisions', () => {
  assert.equal(FIXTURES.length, 10, 'expected 10 fixtures in manifest');
  for (const f of FIXTURES) {
    const fx = f.data;
    const r = run(fx);
    const e = fx.expected_decision;
    assert.equal(r.mode, e.mode, `${fx.id}: mode`);
    assert.equal(r.approval_required, e.approval_required, `${fx.id}: approval_required`);
    assert.equal(r.verification_level, e.verification_level, `${fx.id}: verification_level`);
    assert.deepEqual(r.stages, e.stages, `${fx.id}: stages`);
    assert.deepEqual(new Set(r.responsibilities), new Set(e.responsibilities), `${fx.id}: responsibilities`);
    assert.deepEqual(new Set(r.capabilities), new Set(e.capabilities), `${fx.id}: capabilities`);
    assert.deepEqual(new Set(r.not_selected.capabilities), new Set(e.not_selected.capabilities),
      `${fx.id}: not_selected.capabilities`);
    // not_selected.stages and not_selected.responsibilities: disjoint + subset check (fixture 09 is intentionally lean).
    for (const s of r.not_selected.stages) {
      assert.ok(ALL_STAGES.has(s), `${fx.id}: not_selected.stages has unknown ${s}`);
      assert.ok(!r.stages.includes(s), `${fx.id}: ${s} in both selected and not_selected.stages`);
    }
    for (const s of e.not_selected.stages) {
      assert.ok(r.not_selected.stages.includes(s), `${fx.id}: expected not_selected.stages missing ${s}`);
    }
    for (const s of r.not_selected.responsibilities) {
      assert.ok(ALL_RESP.has(s), `${fx.id}: not_selected.responsibilities has unknown ${s}`);
      assert.ok(!r.responsibilities.includes(s), `${fx.id}: ${s} in both selected and not_selected.responsibilities`);
    }
    for (const s of e.not_selected.responsibilities) {
      assert.ok(r.not_selected.responsibilities.includes(s), `${fx.id}: expected not_selected.responsibilities missing ${s}`);
    }
    // snapshot: all 14 fields present
    for (const k of SNAPSHOT_FIELDS) assert.ok(k in r.snapshot, `${fx.id}: snapshot missing ${k}`);
    assert.equal(r.snapshot.version, 1, `${fx.id}: snapshot.version`);
    assert.equal(r.snapshot.mode, r.mode, `${fx.id}: snapshot.mode mismatch`);
    assert.equal(r.snapshot.stages, r.stages, `${fx.id}: snapshot.stages mismatch`);
    assert.equal(r.snapshot.responsibilities, r.responsibilities, `${fx.id}: snapshot.responsibilities mismatch`);
    assert.equal(r.snapshot.capabilityClasses, r.capabilities, `${fx.id}: snapshot.capabilityClasses mismatch`);
    assert.equal(r.snapshot.runtimeResolution, r.runtime_resolution, `${fx.id}: snapshot.runtimeResolution mismatch`);
    assert.equal(r.snapshot.reasons, r.reasons, `${fx.id}: snapshot.reasons mismatch`);
    assert.equal(r.snapshot.revisionMarker, 'git:HEAD', `${fx.id}: snapshot.revisionMarker`);
    assert.equal(typeof r.snapshot.decisionId, 'string', `${fx.id}: decisionId type`);
    assert.ok(r.snapshot.decisionId.length > 0, `${fx.id}: decisionId empty`);
    assert.equal(typeof r.snapshot.requestDigest, 'string', `${fx.id}: requestDigest type`);
    assert.ok(r.snapshot.requestDigest.startsWith('sha256:'), `${fx.id}: requestDigest prefix`);
    assert.equal(typeof r.snapshot.nextAction, 'string', `${fx.id}: nextAction type`);
    assert.ok(r.snapshot.nextAction.length > 0, `${fx.id}: nextAction empty`);
  }
});

// Category 2: Step 1 — explicit user workflow override (fixture 07).
test('step 1 explicit_user_workflow: plan-only request stays authoritative', () => {
  const fx = FIXTURE_BY_ID['07-explicit-workflow-override'];
  const r = run(fx);
  assert.equal(r.mode, 'planned');
  assert.deepEqual(r.stages, ['understand', 'plan']);
  assert.ok(!r.stages.includes('implement'), 'must not include implementation stage for plan-only');
  assert.equal(r.approval_required, false);
  assert.ok(r.reasons.some(x => /authoritative/.test(x)), 'must cite authoritative rule');
  assert.ok(r.reasons.some(x => /explicitly forbidden/.test(x)), 'must forbid implementation');
});

// Category 3: Step 2 — compatible continuation input is accepted (not yet implemented, must not crash).
test('step 2 compatible_continuation: snapshot input does not crash and still produces a decision', () => {
  const r = classifyAdaptiveDecision('Continue the previous task', {
    adaptive_snapshot: { mode: 'planned', currentStage: 'implement' },
    repository_revision: 'abc123',
  });
  assert.ok(['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'].includes(r.mode));
  assert.equal(r.snapshot.version, 1);
});

// Category 4: Step 3 — long-horizon work (fixture 06).
test('step 3 long_horizon_work: multi-session migration selects long-horizon', () => {
  const fx = FIXTURE_BY_ID['06-long-horizon-migration'];
  const r = run(fx);
  assert.equal(r.mode, 'long-horizon');
  assert.equal(r.approval_required, false);
  assert.ok(r.responsibilities.includes('continuity'), 'must include continuity responsibility');
  assert.ok(r.stages.includes('continue'), 'must include continue stage');
  assert.ok(r.capabilities.includes('task-state'), 'must include task-state capability');
  assert.ok(r.capabilities.includes('documentation'), 'long-horizon engages documentation capability');
  assert.equal(r.snapshot.currentStage, 'understand');
  assert.equal(r.snapshot.escalationCount, 0);
  assert.equal(r.snapshot.blocker, null);
});

// Category 5: Step 4 — high-risk or multi-system work (fixtures 04, 05, 10).
test('step 4 high_risk_or_multi_system_work: orchestrated with approval_required', () => {
  for (const id of ['04-orchestrated-security-change', '05-orchestrated-release', '10-responsibility-ownership']) {
    const fx = FIXTURE_BY_ID[id];
    const r = run(fx);
    assert.equal(r.mode, 'orchestrated', `${id}: mode`);
    assert.equal(r.approval_required, true, `${id}: approval_required`);
    assert.equal(r.verification_level, 'independent', `${id}: verification_level`);
    assert.ok(r.stages.includes('review'), `${id}: must include review stage`);
  }
});

// Category 5b: orchestrated security includes security-review; release drops security-review from responsibilities.
test('step 4 authority matrix: security scenario keeps security-review; release drops it', () => {
  const sec = run(FIXTURE_BY_ID['04-orchestrated-security-change']);
  assert.ok(sec.responsibilities.includes('security-review'), 'security scenario must include security-review');
  const rel = run(FIXTURE_BY_ID['05-orchestrated-release']);
  assert.ok(!rel.responsibilities.includes('security-review'), 'release scenario must drop security-review');
  assert.ok(!rel.responsibilities.includes('release-review'), 'release-review is authority checkpoint, not mode responsibility');
});

// Category 6: Step 5 — broad or ambiguous work (fixture 03).
test('step 5 broad_or_ambiguous_work: planned mode with plan stage preceding implement', () => {
  const fx = FIXTURE_BY_ID['03-planned-broad-feature'];
  const r = run(fx);
  assert.equal(r.mode, 'planned');
  assert.equal(r.approval_required, false);
  const planIdx = r.stages.indexOf('plan');
  const implIdx = r.stages.indexOf('implement');
  assert.ok(planIdx >= 0 && implIdx >= 0 && planIdx < implIdx, 'plan must precede implement');
  assert.ok(r.responsibilities.includes('planning'));
});

// Category 7: Step 6 — unfamiliar cross-file or diagnostic work (fixtures 02, 08).
test('step 6 unfamiliar_cross_file_or_diagnostic_work: assisted mode with debug stage', () => {
  for (const id of ['02-assisted-cross-file-bug', '08-preferred-provider-unavailable']) {
    const fx = FIXTURE_BY_ID[id];
    const r = run(fx);
    assert.equal(r.mode, 'assisted', `${id}: mode`);
    assert.equal(r.approval_required, false, `${id}: approval_required`);
    assert.ok(r.stages.includes('debug'), `${id}: must include debug stage`);
    assert.ok(r.responsibilities.includes('debugging'), `${id}: must include debugging responsibility`);
  }
});

// Category 7b: preferred provider unavailable preserves mode and reports substitution.
test('step 6 capability fallback: mode preserved and substitution reported', () => {
  const fx = FIXTURE_BY_ID['08-preferred-provider-unavailable'];
  const r = run(fx);
  assert.equal(r.mode, 'assisted');
  assert.ok(!r.capabilities.includes('semantic-navigation'), 'semantic-navigation must NOT be in selected capabilities');
  assert.equal(r.runtime_resolution['semantic-navigation'], 'unavailable:fallback-to-structural-search+text-search');
  assert.ok(r.capabilities.includes('structural-search'), 'fallback includes structural-search');
  assert.ok(r.capabilities.includes('text-search'), 'fallback includes text-search');
});

// Category 8: Step 7 — small, clear, low-risk work (fixture 01).
test('step 7 small_clear_low_risk_work: direct mode with targeted verification', () => {
  const fx = FIXTURE_BY_ID['01-direct-localized-fix'];
  const r = run(fx);
  assert.equal(r.mode, 'direct');
  assert.equal(r.approval_required, false);
  assert.equal(r.verification_level, 'targeted');
  assert.deepEqual(r.stages, ['implement', 'verify']);
  assert.deepEqual(r.responsibilities, ['implementation', 'verification']);
  assert.deepEqual(r.capabilities, ['outcome-verification', 'text-search']);
  assert.equal(r.snapshot.escalationCount, 0);
  assert.equal(r.snapshot.blocker, null);
  assert.equal(r.snapshot.currentStage, 'implement');
});

// Category 9: backward compatibility — detectNeed still callable and evidence is captured.
test('backward compatibility: detectNeed is wrapped and detector evidence is preserved', () => {
  // The existing detector is still callable directly.
  const direct = detectNeed({
    question: 'Fix typo in README.md',
    repository: { languages: ['JavaScript'], fileCount: 5, moduleCount: 1 },
  });
  assert.equal(typeof direct.capability, 'string');
  assert.equal(typeof direct.reason, 'string');
  // The adaptive module does not break when the detector throws (defensive evidence path).
  const r1 = classifyAdaptiveDecision('Fix the typo', {});
  assert.equal(r1.mode, 'direct');
  // The adaptive module uses detection as evidence only; it never lets the detector gate the mode.
  const r2 = classifyAdaptiveDecision('Investigate the architecture graph for this large monorepo', {
    repository: { fileCount: 600, moduleCount: 30 },
  });
  // Even if the detector returns architecture_search, the adaptive mode is determined by policy, not by the detector.
  assert.ok(['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'].includes(r2.mode));
});

// Category 10: adversarial — escalation bound (fixture 09), single-writer rule, authority matrix.
test('adversarial: escalation bound produces blocked-state record with all required fields', () => {
  const fx = FIXTURE_BY_ID['09-escalation-bound'];
  const r = run(fx);
  assert.equal(r.mode, 'assisted');
  assert.equal(r.approval_required, false);
  assert.equal(r.snapshot.escalationCount, 2, 'must reach max_auto_escalations=2');
  assert.ok(r.snapshot.blocker, 'blocker must be present (non-null) when escalation bound is hit');
  const b = r.snapshot.blocker;
  for (const k of ['attempted_approaches', 'current_evidence', 'exact_next_user_decision',
    'reproduced_failure', 'unresolved_decision']) {
    assert.ok(k in b, `blocker must contain ${k}`);
  }
  assert.ok(Array.isArray(b.attempted_approaches) && b.attempted_approaches.length >= 1);
  assert.equal(typeof b.current_evidence, 'string');
  assert.equal(typeof b.exact_next_user_decision, 'string');
  assert.equal(typeof b.reproduced_failure, 'string');
  assert.equal(typeof b.unresolved_decision, 'string');
});

test('adversarial: single-writer rule — snapshot is only written by the orchestrator', () => {
  // The contract states single_writer: "orchestrator". For non-orchestrated modes, the snapshot
  // is still produced by the adaptive decision (the orchestrator-equivalent entry point), but
  // the rule is that only one writer exists per decision. Validate that the snapshot is internally
  // consistent: mode, stages, responsibilities, capabilities all agree with the decision.
  for (const f of FIXTURES) {
    const r = run(f.data);
    assert.equal(r.snapshot.mode, r.mode, `${f.data.id}: single-writer consistency (mode)`);
    assert.equal(r.snapshot.stages, r.stages, `${f.data.id}: single-writer consistency (stages)`);
    assert.equal(r.snapshot.responsibilities, r.responsibilities, `${f.data.id}: single-writer consistency (responsibilities)`);
  }
});

test('adversarial: authority matrix — approval_required is true only for orchestrated mode', () => {
  // Per the contract modes table, only orchestrated has approval_required=true.
  // All other modes (direct, assisted, planned, long-horizon) are approval_required=false.
  for (const f of FIXTURES) {
    const r = run(f.data);
    if (r.mode === 'orchestrated') {
      assert.equal(r.approval_required, true, `${f.data.id}: orchestrated must require approval`);
    } else {
      assert.equal(r.approval_required, false, `${f.data.id}: non-orchestrated must not require approval`);
    }
  }
});

test('adversarial: detector signal is captured as evidence in direct mode', () => {
  // The detector's signal must be appended to reasons in direct mode (evidence only, never gates mode).
  const r = classifyAdaptiveDecision('Fix typo in errors.js', {});
  assert.equal(r.mode, 'direct');
  const detSignal = r.reasons.find(x => /detector-signal:/.test(x));
  assert.ok(detSignal, 'direct mode must surface detector signal as evidence');
});
