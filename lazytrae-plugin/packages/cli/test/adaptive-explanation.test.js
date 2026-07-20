const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_ESCALATIONS,
  formatAdaptiveExplanation,
} = require('../src/lib/adaptive-explanation');

function makeSnapshot(overrides = {}) {
  return {
    mode: 'orchestrated',
    stages: ['planning', 'implementation', 'verification'],
    responsibilities: ['planning', 'implementation', 'security-review'],
    capabilities: ['text-search', 'semantic-navigation'],
    not_selected: {
      stages: ['debugging'],
      capabilities: ['architecture-context'],
    },
    approval_required: true,
    reasons: ['security-sensitive change'],
    started_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    completed_at: null,
    escalation_count: 1,
    escalation_history: [],
    last_resolution: null,
    single_writer: 'orchestrator',
    ...overrides,
  };
}

function makeLoopState(snapshot) {
  return {
    version: 1,
    run_id: 'run-test',
    loop_state: 'active',
    goals: [],
    adaptive: snapshot,
  };
}

test('formatAdaptiveExplanation returns a multi-line string with all required fields', () => {
  const out = formatAdaptiveExplanation(makeLoopState(makeSnapshot()));
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 0);
  assert.match(out, /^Adaptive decision:/);
  assert.match(out, /Mode: orchestrated/);
  assert.match(out, /Stages: planning, implementation, verification/);
  assert.match(out, /Responsibilities: planning, implementation, security-review/);
  assert.match(out, /Capabilities: text-search, semantic-navigation/);
  assert.match(out, /Not selected: debugging, architecture-context/);
  assert.match(out, /Approval required: yes/);
  assert.match(out, /Escalations: 1\/2/);
  assert.match(out, /Single writer: orchestrator/);
});

test('formatAdaptiveExplanation returns null when adaptive is null (v1.0.3 idle state)', () => {
  const out = formatAdaptiveExplanation({ version: 1, adaptive: null });
  assert.equal(out, null);
});

test('formatAdaptiveExplanation returns null when adaptive field is absent (v1.0.2 state)', () => {
  const out = formatAdaptiveExplanation({ version: 1, run_id: 'r', goals: [] });
  assert.equal(out, null);
});

test('formatAdaptiveExplanation returns null when loopState is null', () => {
  assert.equal(formatAdaptiveExplanation(null), null);
});

test('formatAdaptiveExplanation returns null when loopState is undefined', () => {
  assert.equal(formatAdaptiveExplanation(undefined), null);
});

test('formatAdaptiveExplanation surfaces mode in output', () => {
  const out = formatAdaptiveExplanation(makeLoopState(makeSnapshot({ mode: 'planned' })));
  assert.match(out, /Mode: planned/);
});

test('formatAdaptiveExplanation surfaces stages in output', () => {
  const out = formatAdaptiveExplanation(
    makeLoopState(makeSnapshot({ stages: ['understand', 'implement'] })),
  );
  assert.match(out, /Stages: understand, implement/);
});

test('formatAdaptiveExplanation surfaces responsibilities in output', () => {
  const out = formatAdaptiveExplanation(
    makeLoopState(makeSnapshot({ responsibilities: ['exploration', 'verification'] })),
  );
  assert.match(out, /Responsibilities: exploration, verification/);
});

test('formatAdaptiveExplanation surfaces capabilities in output', () => {
  const out = formatAdaptiveExplanation(
    makeLoopState(makeSnapshot({ capabilities: ['local_search', 'lsp'] })),
  );
  assert.match(out, /Capabilities: local_search, lsp/);
});

test('formatAdaptiveExplanation surfaces not_selected stages and capabilities in output', () => {
  const out = formatAdaptiveExplanation(
    makeLoopState(
      makeSnapshot({
        not_selected: {
          stages: ['release-review'],
          capabilities: ['external-search', 'browser-automation'],
        },
      }),
    ),
  );
  assert.match(out, /Not selected: release-review, external-search, browser-automation/);
});

test('formatAdaptiveExplanation surfaces approval_required=false as no', () => {
  const out = formatAdaptiveExplanation(makeLoopState(makeSnapshot({ approval_required: false })));
  assert.match(out, /Approval required: no/);
});

test('formatAdaptiveExplanation surfaces escalation count over the bound', () => {
  const out = formatAdaptiveExplanation(makeLoopState(makeSnapshot({ escalation_count: 2 })));
  assert.match(out, /Escalations: 2\/2/);
});

test('formatAdaptiveExplanation reports MAX_ESCALATIONS=2 (Section 12 bound)', () => {
  assert.equal(MAX_ESCALATIONS, 2);
});

test('adversarial: malformed adaptive block (string) returns null', () => {
  const out = formatAdaptiveExplanation({ adaptive: 'not-an-object' });
  assert.equal(out, null);
});

test('adversarial: missing mode field surfaces "unknown" rather than throwing', () => {
  const snapshot = makeSnapshot();
  delete snapshot.mode;
  const out = formatAdaptiveExplanation(makeLoopState(snapshot));
  assert.match(out, /Mode: unknown/);
});

test('adversarial: missing stages field surfaces "none" rather than throwing', () => {
  const snapshot = makeSnapshot();
  delete snapshot.stages;
  const out = formatAdaptiveExplanation(makeLoopState(snapshot));
  assert.match(out, /Stages: none/);
});

test('adversarial: missing not_selected field surfaces "none" rather than throwing', () => {
  const snapshot = makeSnapshot();
  delete snapshot.not_selected;
  const out = formatAdaptiveExplanation(makeLoopState(snapshot));
  assert.match(out, /Not selected: none/);
});

test('adversarial: missing approval_required field surfaces "no" rather than throwing', () => {
  const snapshot = makeSnapshot();
  delete snapshot.approval_required;
  const out = formatAdaptiveExplanation(makeLoopState(snapshot));
  assert.match(out, /Approval required: no/);
});

test('adversarial: empty stages array surfaces "none"', () => {
  const out = formatAdaptiveExplanation(
    makeLoopState(makeSnapshot({ stages: [], responsibilities: [], capabilities: [] })),
  );
  assert.match(out, /Stages: none/);
  assert.match(out, /Responsibilities: none/);
  assert.match(out, /Capabilities: none/);
});

test('adversarial: non-integer escalation_count falls back to 0', () => {
  const out = formatAdaptiveExplanation(
    makeLoopState(makeSnapshot({ escalation_count: 'oops' })),
  );
  assert.match(out, /Escalations: 0\/2/);
});

test('adversarial: missing single_writer surfaces "unknown"', () => {
  const snapshot = makeSnapshot();
  delete snapshot.single_writer;
  const out = formatAdaptiveExplanation(makeLoopState(snapshot));
  assert.match(out, /Single writer: unknown/);
});
