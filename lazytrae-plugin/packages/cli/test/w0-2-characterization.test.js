// W0.2 v1.0.2 characterization tests for the LazyTrae adaptive-harness release plan.
//
// Purpose: pin down v1.0.2 detector + fallback behavior for the eight representative
// request types that the v1.0.3 adaptive harness is expected to route. These tests
// document current behavior; they are NOT a specification of desired v1.0.3 behavior.
// If v1.0.3 changes detector classification or fallback semantics, these tests will
// fail and force a deliberate reconciliation.
//
// Scope: this file exercises ONLY the public exports of automatic-tooling-detector.js
// (detectNeed, executeFallback, redactQuery). It does NOT modify any source file.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  detectNeed,
  executeFallback,
  redactQuery,
} = require('../src/lib/automatic-tooling-detector');

// Eight representative request types named in the W0.2 plan. Each scenario captures
// the v1.0.2 detector's classification. Note: v1.0.2 detectNeed() returns a
// capability class only; it does NOT emit a workflow mode (direct / assisted /
// planned / orchestrated / long-horizon). That is the central gap the v1.0.3
// adaptive harness is expected to close.

const SCENARIOS = [
  {
    id: 1,
    label: 'localized-one-file-behavior-correction-direct',
    context: {
      question: 'Fix the off-by-one error in the boulder validation loop in loop-store.js where the index skips the first task.',
      repository: { languages: ['JavaScript'], fileCount: 60, moduleCount: 5 },
    },
    expectedCapability: 'local_search',
    expectedReason: 'local-repository-evidence-first',
  },
  {
    id: 2,
    label: 'unfamiliar-cross-file-bug-assisted',
    context: {
      question: 'Investigate where the MCP declaration writer is called across modules when EPERM is thrown on rename.',
      repository: { languages: ['JavaScript'], fileCount: 120, moduleCount: 18 },
    },
    expectedCapability: 'local_search',
    expectedReason: 'local-repository-evidence-first',
  },
  {
    id: 3,
    label: 'broad-feature-unresolved-design-planned',
    context: {
      question: 'Design the adaptive harness so that broker policy can route between direct and orchestrated workflows based on detector evidence.',
      repository: { languages: ['JavaScript'], fileCount: 200, moduleCount: 30 },
    },
    expectedCapability: 'architecture_search',
    expectedReason: 'cross-module-or-large-repository-analysis',
  },
  {
    id: 4,
    label: 'security-sensitive-authorization-change-orchestrated',
    context: {
      question: 'Tighten the approval resolver so that any capability run on a security-sensitive path requires explicit human approval.',
      repository: { languages: ['JavaScript'], fileCount: 50, moduleCount: 8 },
    },
    expectedCapability: 'local_search',
    expectedReason: 'local-repository-evidence-first',
  },
  {
    id: 5,
    label: 'release-or-publication-change-orchestrated',
    context: {
      question: 'Cut the v1.0.3 release: bump version, update CHANGELOG, refresh publication fixtures, and verify parity.',
      repository: { languages: ['JavaScript'], fileCount: 80, moduleCount: 12 },
    },
    expectedCapability: 'documentation_search',
    expectedReason: 'version-specific-documentation-request',
  },
  {
    id: 6,
    label: 'multi-session-migration-long-horizon',
    context: {
      question: 'Migrate every consumer project from the v1.0.1 state shape to the v1.0.3 schema across multiple sessions.',
      repository: { languages: ['JavaScript'], fileCount: 90, moduleCount: 14 },
    },
    expectedCapability: 'documentation_search',
    expectedReason: 'version-specific-documentation-request',
  },
  {
    id: 7,
    label: 'explicit-named-workflow-plan-only',
    context: {
      question: 'Create a plan only for the loop steering redesign; do not begin implementation until I approve.',
      repository: { languages: ['JavaScript'], fileCount: 40, moduleCount: 6 },
    },
    expectedCapability: 'local_search',
    expectedReason: 'local-repository-evidence-first',
  },
  {
    id: 8,
    label: 'preferred-provider-unavailable-fallback-chain',
    context: {
      question: 'How does React 19 useActionState work? Need the latest version-specific docs.',
      alreadyTriedLocal: true,
      repository: { languages: ['TypeScript'], packages: ['react@19.0.0'] },
    },
    expectedCapability: 'documentation_search',
    expectedReason: 'version-specific-documentation-request',
  },
];

for (const scenario of SCENARIOS) {
  test(`W0.2 #${scenario.id} detectNeed classifies "${scenario.label}" as ${scenario.expectedCapability}`, () => {
    const request = detectNeed(scenario.context);
    assert.equal(request.capability, scenario.expectedCapability);
    assert.equal(request.reason, scenario.expectedReason);
    assert.deepEqual(request.evidence.alreadyTriedLocal, scenario.context.alreadyTriedLocal === true);
    // Capability-only output: no provider names leak from detectNeed.
    assert.equal(JSON.stringify(request).match(/context7|grep_app|playwright|codegraph|ripgrep|ast-grep|\blsp\b/i), null);
  });
}

test('W0.2 #8 fallback chain: documentation_search unavailable falls through to web_search', async () => {
  const calls = [];
  const result = await executeFallback(
    { capability: 'documentation_search', query: 'React 19 useActionState token=TOP_SECRET' },
    async (req) => {
      calls.push(req.capability);
      if (req.capability === 'filesystem_read') return { status: 'unavailable' };
      if (req.capability === 'documentation_search') return { status: 'unavailable' };
      return { status: 'success', output: 'react docs summary' };
    }
  );
  assert.deepEqual(calls, ['filesystem_read', 'documentation_search', 'web_search']);
  assert.equal(result.status, 'success');
  assert.equal(result.capability, 'web_search');
  assert.equal(result.output.trust, 'untrusted');
  assert.equal(JSON.stringify(result).includes('TOP_SECRET'), false);
});

test('W0.2 architecture_search fallback chain crosses four capabilities before local_search', async () => {
  const calls = [];
  const result = await executeFallback(
    { capability: 'architecture_search', query: 'map module dependencies' },
    async (req) => {
      calls.push(req.capability);
      if (req.capability === 'local_search') return { status: 'success', output: 'local results' };
      return { status: 'unavailable' };
    }
  );
  assert.deepEqual(calls, ['architecture_search', 'code_navigation', 'structural_search', 'local_search']);
  assert.equal(result.status, 'success');
  assert.equal(result.capability, 'local_search');
});

test('W0.2 external_code_search fallback chain crosses three capabilities before web_search', async () => {
  const calls = [];
  const result = await executeFallback(
    { capability: 'external_code_search', query: 'how is useActionState implemented in public react examples' },
    async (req) => {
      calls.push(req.capability);
      if (req.capability === 'web_search') return { status: 'success', output: 'github summary' };
      return { status: 'unavailable' };
    }
  );
  assert.deepEqual(calls, ['local_search', 'external_code_search', 'web_search']);
  assert.equal(result.status, 'success');
  assert.equal(result.capability, 'web_search');
});

test('W0.2 denial is terminal when adapter responds with the canonical capability name', async () => {
  // v1.0.2 normalizeOutcome accepts the canonical capability name (or an alias) in
  // the response.capability field. When the adapter denies with the canonical name,
  // the chain stops immediately and does not try later fallbacks.
  const calls = [];
  const result = await executeFallback(
    { capability: 'external_code_search', query: 'latest API' },
    async (req) => {
      calls.push(req.capability);
      if (req.capability === 'local_search') return { status: 'unavailable' };
      if (req.capability === 'external_code_search') {
        return { capability: 'external_code_search', status: 'denied', output: 'try web_search' };
      }
      return { status: 'success', output: 'should not reach' };
    }
  );
  assert.deepEqual(calls, ['local_search', 'external_code_search']);
  assert.equal(result.status, 'denied');
  assert.equal(result.capability, 'external_code_search');
});

test('W0.2 normalizeOutcome rejects provider names supplied as capability aliases', async () => {
  // v1.0.2 canonicalCapability() only accepts canonical capability names or the
  // declared aliases (documentation, library_documentation, docs, repository_search,
  // code_search, architecture, browser). Provider names such as "grep_app",
  // "context7", or "playwright" are rejected with AUTOMATIC_TOOLING_UNKNOWN_CAPABILITY.
  // This forces adapters to use canonical capability names in their outcomes.
  await assert.rejects(
    executeFallback(
      { capability: 'external_code_search', query: 'latest API' },
      async (req) => {
        if (req.capability === 'local_search') return { status: 'unavailable' };
        return { capability: 'grep_app', status: 'denied', output: 'try web_search' };
      }
    ),
    /AUTOMATIC_TOOLING_UNKNOWN_CAPABILITY/
  );
});

test('W0.2 redactQuery scrubs bearer tokens, secret assignments, and absolute paths', () => {
  assert.equal(redactQuery('Authorization: Bearer abcdefghijkl'), 'Authorization: Bearer [REDACTED]');
  assert.equal(redactQuery('api_key=TOP_SECRET'), 'api_key=[REDACTED]');
  assert.equal(redactQuery('token: SUP3R_SECRET_VALUE'), 'token=[REDACTED]');
  assert.equal(redactQuery('see /Users/admin/secret'), 'see [PATH]');
  assert.equal(redactQuery('check C:\\Users\\admin\\secret'), 'check [PATH]');
});

test('W0.2 redactQuery truncates long queries to 512 characters', () => {
  const long = 'x'.repeat(2000);
  const redacted = redactQuery(long);
  assert.equal(redacted.length, 512);
});

test('W0.2 detectNeed rejects malformed context with a bounded-question error', () => {
  assert.throws(() => detectNeed({}), /bounded question/);
  assert.throws(() => detectNeed({ question: '' }), /bounded question/);
  assert.throws(() => detectNeed({ question: 'x'.repeat(5000) }), /bounded question/);
  assert.throws(() => detectNeed(null), /bounded question/);
});

test('W0.2 detectNeed caps repository metadata to documented bounds', () => {
  const request = detectNeed({
    question: 'how does the api work',
    repository: {
      languages: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v'],
      packages: Array.from({ length: 150 }, (_, i) => `pkg${i}@1.0.0`),
      fileCount: 5000,
      moduleCount: 200,
    },
  });
  assert.equal(request.evidence.languageCount, 20);
  assert.equal(request.evidence.packageCount, 100);
  assert.equal(request.evidence.fileCount, 5000);
  assert.equal(request.evidence.moduleCount, 200);
});

test('W0.2 detectNeed routes browser tasks ahead of architecture and documentation', () => {
  const browser = detectNeed({
    question: 'click the form button in the browser UI and inspect the layout',
    repository: { languages: ['TypeScript'], fileCount: 500, moduleCount: 50 },
  });
  assert.equal(browser.capability, 'browser_automation');
  assert.equal(browser.reason, 'explicit-browser-or-ui-task');
});

test('W0.2 detectNeed routes external-code requests through external_code_search', () => {
  const external = detectNeed({
    question: 'how is useActionState implemented in public open-source repos on github',
    repository: { languages: ['TypeScript'] },
  });
  assert.equal(external.capability, 'external_code_search');
  assert.equal(external.reason, 'external-code-evidence-requested');
});
