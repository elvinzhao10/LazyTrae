'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ledger = require('../src/lib/decision-ledger');

let suiteRoot;

function freshLedger() {
  const dir = fs.mkdtempSync(path.join(suiteRoot, 'ledger-'));
  return path.join(dir, 'ledger.jsonl');
}

function recorded(id, overrides = {}) {
  return {
    id,
    type: ledger.EVENT_TYPES.DECISION_RECORDED,
    summary: 'use provider X',
    rationale: 'lower cost',
    project: 'shop',
    scope: 'billing/payments',
    source: { plan: 'plan-1', revision: 'r1' },
    evidence: 'bench-1',
    ...overrides,
  };
}

const TABLE = [
  {
    name: 'records a decision-recorded event',
    run() {
      const p = freshLedger();
      const r = ledger.appendEvent(p, recorded('d1'));
      assert.equal(r.appended, true);
      const view = ledger.replay(p);
      assert.equal(view.activeDecisions.length, 1);
      assert.equal(view.activeDecisions[0].id, 'd1');
    },
  },
  {
    name: 'records decision-superseded and demotes the old decision',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1'));
      ledger.appendEvent(p, recorded('d2', { summary: 'use provider Y' }));
      ledger.appendEvent(p, {
        id: 's1',
        type: ledger.EVENT_TYPES.DECISION_SUPERSEDED,
        old: 'd1',
        new: 'd2',
        reason: 'provider Y won benchmark',
      });
      const view = ledger.replay(p);
      const d1 = view.decisions.find((d) => d.id === 'd1');
      const d2 = view.decisions.find((d) => d.id === 'd2');
      assert.equal(d1.status, 'superseded');
      assert.equal(d1.supersededBy, 'd2');
      assert.equal(d2.status, 'active');
      assert.equal(view.activeDecisions.length, 1);
    },
  },
  {
    name: 'records decision-voided and removes the decision from active view',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1'));
      ledger.appendEvent(p, {
        id: 'v1',
        type: ledger.EVENT_TYPES.DECISION_VOIDED,
        target: 'd1',
        reason: 'no longer applicable',
      });
      const view = ledger.replay(p);
      assert.equal(view.decisions.find((d) => d.id === 'd1').status, 'voided');
      assert.equal(view.activeDecisions.length, 0);
    },
  },
  {
    name: 'records correction-opened',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, {
        id: 'c1',
        type: ledger.EVENT_TYPES.CORRECTION_OPENED,
        ref: 'd1',
        scope: 'billing/payments',
        defect: 'double-charge on retry',
      });
      const view = ledger.replay(p);
      assert.equal(view.openCorrections.length, 1);
      assert.equal(view.openCorrections[0].id, 'c1');
    },
  },
  {
    name: 'records correction-resolved and closes the correction',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, {
        id: 'c1',
        type: ledger.EVENT_TYPES.CORRECTION_OPENED,
        ref: 'd1',
        scope: 'billing/payments',
        defect: 'double-charge on retry',
      });
      ledger.appendEvent(p, {
        id: 'x1',
        type: ledger.EVENT_TYPES.CORRECTION_RESOLVED,
        target: 'c1',
        verified_fix: 'idempotency key added; test passes',
      });
      const view = ledger.replay(p);
      assert.equal(view.openCorrections.length, 0);
      const correction = view.corrections.find((c) => c.id === 'c1');
      assert.equal(correction.open, false);
      assert.equal(correction.resolvedBy, 'x1');
    },
  },
  {
    name: 'all five event types coexist in one ledger',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1'));
      ledger.appendEvent(p, recorded('d2', { summary: 'provider Y' }));
      ledger.appendEvent(p, {
        id: 's1',
        type: ledger.EVENT_TYPES.DECISION_SUPERSEDED,
        old: 'd1',
        new: 'd2',
        reason: 'Y wins',
      });
      ledger.appendEvent(p, {
        id: 'c1',
        type: ledger.EVENT_TYPES.CORRECTION_OPENED,
        ref: 'd2',
        scope: 'billing/payments',
        defect: 'edge case',
      });
      ledger.appendEvent(p, {
        id: 'x1',
        type: ledger.EVENT_TYPES.CORRECTION_RESOLVED,
        target: 'c1',
        verified_fix: 'fixed',
      });
      const view = ledger.replay(p);
      assert.equal(view.activeDecisions.length, 1);
      assert.equal(view.openCorrections.length, 0);
      assert.equal(view.events.length, 5);
    },
  },
  {
    name: 'rejects malformed JSON with a visible byte offset',
    run() {
      const p = freshLedger();
      fs.writeFileSync(p, 'this is not json\n');
      let err;
      try {
        ledger.replay(p);
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'expected a malformed error');
      assert.ok(err instanceof ledger.LedgerMalformedError);
      assert.equal(err.byteOffset, 0);
      assert.match(err.message, /byte 0/);
    },
  },
  {
    name: 'rejects a leading non-JSON header line',
    run() {
      const p = freshLedger();
      fs.writeFileSync(p, '=== DECISION LEDGER ===\n{"id":"d1","type":"decision-recorded"}\n');
      assert.throws(() => ledger.replay(p), (e) => e instanceof ledger.LedgerMalformedError);
    },
  },
  {
    name: 'rejects a truncated record and preserves the bytes',
    run() {
      const p = freshLedger();
      const original = '{"id":"d1","type":"decision-recorded",';
      fs.writeFileSync(p, original);
      assert.throws(() => ledger.replay(p), (e) => e instanceof ledger.LedgerMalformedError);
      // Bytes must be preserved: never silently skip or rewrite.
      assert.equal(fs.readFileSync(p, 'utf8'), original);
    },
  },
  {
    name: 'idempotent identical re-append does not duplicate',
    run() {
      const p = freshLedger();
      const first = ledger.appendEvent(p, recorded('d1'));
      assert.equal(first.appended, true);
      const second = ledger.appendEvent(p, recorded('d1'));
      assert.equal(second.appended, false);
      assert.equal(second.reason, 'idempotent');
      const view = ledger.replay(p);
      assert.equal(view.activeDecisions.length, 1);
    },
  },
  {
    name: 'rejects the same id with different content',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1', { summary: 'provider X' }));
      assert.throws(
        () => ledger.appendEvent(p, recorded('d1', { summary: 'provider Z' })),
        (e) => e instanceof ledger.LedgerIdError,
      );
    },
  },
  {
    name: 'rejects supersede referencing a non-existent decision',
    run() {
      const p = freshLedger();
      assert.throws(
        () => ledger.appendEvent(p, {
          id: 's1',
          type: ledger.EVENT_TYPES.DECISION_SUPERSEDED,
          old: 'ghost',
          new: 'ghost2',
          reason: 'x',
        }),
        (e) => e instanceof ledger.LedgerReferenceError,
      );
    },
  },
  {
    name: 'rejects supersede cycle (new already superseded)',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1'));
      ledger.appendEvent(p, recorded('d2'));
      ledger.appendEvent(p, {
        id: 's1',
        type: ledger.EVENT_TYPES.DECISION_SUPERSEDED,
        old: 'd1',
        new: 'd2',
        reason: 'd1 -> d2',
      });
      assert.throws(
        () => ledger.appendEvent(p, {
          id: 's2',
          type: ledger.EVENT_TYPES.DECISION_SUPERSEDED,
          old: 'd2',
          new: 'd1',
          reason: 'd2 -> d1 cycle',
        }),
        (e) => e instanceof ledger.LedgerReferenceError,
      );
    },
  },
  {
    name: 'rejects void of an already-voided decision',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1'));
      ledger.appendEvent(p, {
        id: 'v1',
        type: ledger.EVENT_TYPES.DECISION_VOIDED,
        target: 'd1',
        reason: 'void once',
      });
      assert.throws(
        () => ledger.appendEvent(p, {
          id: 'v2',
          type: ledger.EVENT_TYPES.DECISION_VOIDED,
          target: 'd1',
          reason: 'void twice',
        }),
        (e) => e instanceof ledger.LedgerReferenceError,
      );
    },
  },
  {
    name: 'rejects resolve of a non-existent correction',
    run() {
      const p = freshLedger();
      assert.throws(
        () => ledger.appendEvent(p, {
          id: 'x1',
          type: ledger.EVENT_TYPES.CORRECTION_RESOLVED,
          target: 'ghost',
          verified_fix: 'n/a',
        }),
        (e) => e instanceof ledger.LedgerReferenceError,
      );
    },
  },
  {
    name: 'rejects resolve of an already-resolved correction',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, {
        id: 'c1',
        type: ledger.EVENT_TYPES.CORRECTION_OPENED,
        ref: 'd1',
        scope: 'billing/payments',
        defect: 'oops',
      });
      ledger.appendEvent(p, {
        id: 'x1',
        type: ledger.EVENT_TYPES.CORRECTION_RESOLVED,
        target: 'c1',
        verified_fix: 'fixed once',
      });
      assert.throws(
        () => ledger.appendEvent(p, {
          id: 'x2',
          type: ledger.EVENT_TYPES.CORRECTION_RESOLVED,
          target: 'c1',
          verified_fix: 'fixed twice',
        }),
        (e) => e instanceof ledger.LedgerReferenceError,
      );
    },
  },
  {
    name: 'active view derives recorded - superseded - voided together',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, recorded('d1'));
      ledger.appendEvent(p, recorded('d2'));
      ledger.appendEvent(p, recorded('d3'));
      ledger.appendEvent(p, {
        id: 's1',
        type: ledger.EVENT_TYPES.DECISION_SUPERSEDED,
        old: 'd1',
        new: 'd2',
        reason: 'replace',
      });
      ledger.appendEvent(p, {
        id: 'v1',
        type: ledger.EVENT_TYPES.DECISION_VOIDED,
        target: 'd3',
        reason: 'drop',
      });
      const view = ledger.replay(p);
      const statuses = Object.fromEntries(view.decisions.map((d) => [d.id, d.status]));
      assert.equal(statuses.d1, 'superseded');
      assert.equal(statuses.d2, 'active');
      assert.equal(statuses.d3, 'voided');
      assert.deepEqual(view.activeDecisions.map((d) => d.id), ['d2']);
    },
  },
  {
    name: 'open correction blocks completion only in its affected scope',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, {
        id: 'c1',
        type: ledger.EVENT_TYPES.CORRECTION_OPENED,
        ref: 'd1',
        scope: 'billing/payments',
        defect: 'double charge',
      });
      assert.equal(ledger.blocksCompletion(p, 'billing/payments'), true);
      assert.equal(ledger.blocksCompletion(p, 'billing'), true); // parent scope blocked
      assert.equal(ledger.blocksCompletion(p, 'billing/payouts'), false); // distinct sibling
      assert.equal(ledger.blocksCompletion(p, 'navigation'), false); // unrelated
      const blocking = ledger.blockingCorrections(p, 'billing/payments');
      assert.equal(blocking.length, 1);
    },
  },
  {
    name: 'resolving a correction clears the completion block in its scope',
    run() {
      const p = freshLedger();
      ledger.appendEvent(p, {
        id: 'c1',
        type: ledger.EVENT_TYPES.CORRECTION_OPENED,
        ref: 'd1',
        scope: 'billing/payments',
        defect: 'double charge',
      });
      assert.equal(ledger.blocksCompletion(p, 'billing/payments'), true);
      ledger.appendEvent(p, {
        id: 'x1',
        type: ledger.EVENT_TYPES.CORRECTION_RESOLVED,
        target: 'c1',
        verified_fix: 'idempotency key added',
      });
      assert.equal(ledger.blocksCompletion(p, 'billing/payments'), false);
    },
  },
  {
    name: 'bounded retrieval truncates and reports omission',
    run() {
      const p = freshLedger();
      for (let i = 0; i < 60; i += 1) {
        // Long summaries push the serialized view well past 8000 chars.
        ledger.appendEvent(p, recorded(`d${i}`, {
          summary: `decision number ${i} with a long summary ${'x'.repeat(200)}`,
          evidence: 'e'.repeat(200),
        }));
      }
      const bounded = ledger.retrieve(p, { budgetChars: 8000 });
      assert.equal(bounded.truncated, true);
      assert.ok(bounded.omitted > 0);
      assert.equal(bounded.activeDecisions, 60);
      const full = ledger.retrieve(p, { budgetChars: 1_000_000 });
      assert.equal(full.truncated, false);
      assert.equal(full.omitted, 0);
    },
  },
  {
    name: 'absent ledger is empty valid memory',
    run() {
      const p = path.join(fs.mkdtempSync(path.join(suiteRoot, 'absent-')), 'missing.jsonl');
      const view = ledger.replay(p);
      assert.equal(view.events.length, 0);
      assert.equal(view.activeDecisions.length, 0);
      assert.equal(view.openCorrections.length, 0);
    },
  },
];

test('decision ledger: table-driven coverage', async (t) => {
  suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-ledger-suite-'));
  try {
    for (const tc of TABLE) {
      await t.test(tc.name, () => tc.run());
    }
  } finally {
    fs.rmSync(suiteRoot, { recursive: true, force: true });
  }
});
