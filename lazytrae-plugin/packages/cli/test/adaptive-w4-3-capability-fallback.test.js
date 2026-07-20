// W4.3 Capability Fallback integration tests for v1.0.3 Adaptive Harness.
//
// Purpose: prove authority-safe capability fallback behavior per plan Section 9
// (Fallback behavior). When the preferred semantic-navigation provider is
// unavailable, the adaptive decision must:
//   - resolve to an allowed safe fallback (not the unavailable provider)
//   - preserve the mode (no escalation)
//   - report the substitution in the decision reasons
//   - adjust verification expectations (acknowledge weaker evidence)
//   - NOT activate any approval-required authority
//   - NOT silently enable a remote provider
//   - cover every capability class (selected with resolution OR explicitly not-selected)
//
// Fixture: contracts/fixtures/v103/08-preferred-provider-unavailable.json
// (Task description referenced "07-preferred-provider-unavailable.json" — that
// is a typo; the canonical filename in both repos is "08-preferred-provider-
// unavailable.json". Fixture 07 is the explicit-workflow-override case.)

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { mapAdaptiveDecisionToSurfaces } = require('../src/lib/adaptive-mapping');
const {
  writeAdaptiveSnapshot,
  readAdaptiveSnapshot,
} = require('../src/lib/adaptive-snapshot');
const { formatAdaptiveExplanation } = require('../src/lib/adaptive-explanation');
const { defaultLoop } = require('../src/lib/loop-store');

const FIXTURE_PATH = path.join(__dirname, '..', 'contracts', 'fixtures', 'v103',
  '08-preferred-provider-unavailable.json');
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

// Contract capability classes (plan Section 5).
const ALL_CAPS = ['text-search', 'structural-search', 'semantic-navigation',
  'architecture-context', 'documentation', 'execution', 'task-state', 'outcome-verification'];

// Automatic-authority providers per plan Section 9 (already-loaded host-native,
// repository-native, compatible system-local, package-owned ephemeral).
const AUTOMATIC_AUTHORITIES = ['host-native', 'package-verification', 'package-lsp',
  'package-codegraph', 'package-docs', 'package-cli', 'package-loop-store'];

// Approval-required tokens that must NOT appear in any fallback resolution.
const APPROVAL_REQUIRED_TOKENS = ['install', 'credential', 'paid', 'remote-provider',
  'marketplace', 'browser', 'desktop-control', 'account-mutation', 'data-egress'];

// Remote provider tokens that must NOT be silently enabled.
const REMOTE_PROVIDER_TOKENS = ['remote', 'cloud-api', 'external-api', 'paid-service'];

function buildLoopAdaptiveBlock(decision) {
  return {
    mode: decision.mode,
    stages: decision.stages,
    responsibilities: decision.responsibilities,
    capabilities: decision.capabilities,
    not_selected: {
      stages: decision.not_selected.stages,
      capabilities: decision.not_selected.capabilities,
    },
    approval_required: decision.approval_required,
    reasons: decision.reasons,
    started_at: null,
    updated_at: null,
    completed_at: null,
    escalation_count: decision.snapshot.escalationCount,
    escalation_history: [],
    last_resolution: decision.runtime_resolution,
    single_writer: 'orchestrator',
  };
}

function classify() {
  return classifyAdaptiveDecision(FIXTURE.request, FIXTURE.context);
}

test('W4.3: preferred provider unavailable -> safe fallback (not the unavailable provider)', () => {
  const decision = classify();
  const semNav = decision.runtime_resolution['semantic-navigation'];
  assert.ok(typeof semNav === 'string' && semNav.length > 0,
    'semantic-navigation must have a non-empty resolution');
  assert.ok(!/lsp-bridge/i.test(semNav),
    `semantic-navigation must not resolve to the unavailable provider; got: ${semNav}`);
  assert.ok(/fallback|unavailable|host-native|package-/i.test(semNav),
    `semantic-navigation resolution must be a safe fallback; got: ${semNav}`);
});

test('W4.3: fallback does NOT escalate mode (assisted stays assisted)', () => {
  const decision = classify();
  assert.equal(decision.mode, 'assisted',
    'fallback must preserve assisted mode (fixture scope is cross-file)');
  assert.equal(decision.approval_required, false,
    'fallback must not flip approval_required on');
  assert.equal(decision.snapshot.escalationCount, 0,
    'fallback must not consume an escalation');
});

test('W4.3: all capability classes covered (resolved OR explicitly not-selected)', () => {
  const decision = classify();
  const resolved = Object.keys(decision.runtime_resolution);
  const notSelected = decision.not_selected.capabilities;
  for (const cap of ALL_CAPS) {
    const isResolved = resolved.includes(cap)
      && typeof decision.runtime_resolution[cap] === 'string'
      && decision.runtime_resolution[cap].length > 0;
    const isNotSelected = notSelected.includes(cap);
    assert.ok(isResolved || isNotSelected,
      `capability ${cap} must be resolved (non-empty) or explicitly not-selected`);
  }
});

test('W4.3: no approval-required authority silently activated', () => {
  const decision = classify();
  assert.equal(decision.approval_required, false,
    'fallback must not activate approval_required');
  for (const [cap, value] of Object.entries(decision.runtime_resolution)) {
    const isAutomatic = AUTOMATIC_AUTHORITIES.includes(value);
    const isFallbackMarker = /^unavailable:fallback-/i.test(value);
    assert.ok(isAutomatic || isFallbackMarker,
      `${cap}=${value} must be automatic-authority or fallback marker`);
    for (const tok of APPROVAL_REQUIRED_TOKENS) {
      assert.ok(!new RegExp(tok, 'i').test(value),
        `${cap}=${value} must not reference approval-required token "${tok}"`);
    }
  }
});

test('W4.3: no remote provider silently enabled', () => {
  const decision = classify();
  for (const [cap, value] of Object.entries(decision.runtime_resolution)) {
    for (const tok of REMOTE_PROVIDER_TOKENS) {
      assert.ok(!new RegExp(tok, 'i').test(value),
        `${cap}=${value} must not reference remote provider token "${tok}"`);
    }
  }
});

test('W4.3: decision reasons report substitution and weaker evidence', () => {
  const decision = classify();
  const joined = decision.reasons.join('\n');
  assert.match(joined, /semantic.navigation.*unavailable|substitut/i,
    'decision reasons must report the semantic-navigation substitution');
  assert.match(joined, /verification expectations adjusted|weaker|no equivalent-evidence/i,
    'decision reasons must acknowledge weaker evidence / verification adjustment');
});

test('W4.3: mapping surfaces stay non-empty for assisted mode', () => {
  const decision = classify();
  const mapping = mapAdaptiveDecisionToSurfaces(decision);
  assert.deepEqual(mapping.workflow_surfaces, ['lazy-start-work'],
    'assisted mode maps to lazy-start-work (no escalation)');
  assert.equal(mapping.verification_surface, 'completion-gates.js');
});

test('W4.3: snapshot round-trip preserves fallback resolution', () => {
  const decision = classify();
  const loopState = defaultLoop();
  writeAdaptiveSnapshot(loopState, buildLoopAdaptiveBlock(decision));
  const read = readAdaptiveSnapshot(loopState);
  assert.equal(read.mode, 'assisted');
  assert.deepEqual(read.last_resolution, decision.runtime_resolution);
  assert.equal(read.last_resolution['semantic-navigation'],
    'unavailable:fallback-to-structural-search+text-search');
});

// Known gap: formatAdaptiveExplanation surfaces Mode/Stages/Responsibilities/
// Capabilities/Not-selected/Approval/Escalations/Single-writer but does NOT
// surface `reasons` or `last_resolution`. The substitution is therefore not
// visible in the explanation output today. Marked expected-fail per W4.3 task
// instructions; documented in the evidence file.
test.expectFailure('W4.3 GAP: explanation mentions substitution (xfail — reasons not surfaced)', () => {
  const decision = classify();
  const loopState = defaultLoop();
  writeAdaptiveSnapshot(loopState, buildLoopAdaptiveBlock(decision));
  const explanation = formatAdaptiveExplanation(loopState);
  assert.ok(typeof explanation === 'string' && explanation.length > 0);
  assert.match(explanation, /semantic.navigation.*unavailable|substitut/i,
    'explanation must mention the substitution (gap: reasons not surfaced yet)');
});
