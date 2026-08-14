'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { appendEvent } = require('../src/lib/loop-store');

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function runtimeFingerprints() {
  const available = (name) => ({ status: 'available', digest: digest(name) });
  return {
    selected_host: 'trae-ide',
    runtime_fingerprints: {
      'trae-ide': {
        host: 'trae-ide',
        profile: available('profile'),
        probe: available('probe'),
        binary: available('binary'),
        session: available('session'),
        worktree: available('worktree'),
        mcp: available('mcp'),
        generated_asset: available('generated-asset'),
        marketplace: available('marketplace'),
      },
    },
  };
}

test('Todo28 PIN compatible continuation preserves the exact decision and stage', () => {
  // Given: the current compatible continuation identity and an advanced stage.
  const prompt = 'Continue the bounded native host alignment.';
  const identity = {
    revisionFingerprint: { status: 'available', digest: digest('revision:4925aca') },
    scopeFingerprint: digest('scope:todo28'),
    hostFingerprint: digest('host:trae-ide'),
  };
  const first = classifyAdaptiveDecision(prompt, {
    ...identity,
    decisionId: 'decision-todo28-pin',
    scope: 'bounded',
  });
  const priorSnapshot = { ...first.snapshot, currentStage: 'verify' };

  // When: the same exact input and fingerprints are classified for resume.
  const resumed = classifyAdaptiveDecision(prompt, {
    ...identity,
    priorSnapshot,
    scope: 'bounded',
  });

  // Then: current behavior preserves both the decision and advanced stage.
  assert.equal(resumed.snapshot.decisionId, 'decision-todo28-pin');
  assert.equal(resumed.snapshot.currentStage, 'verify');
  assert.equal(resumed.snapshot.mode, first.snapshot.mode);
});

test('Todo28 each native host material mutation reclassifies continuation', () => {
  // Given: a continuation snapshot bound to all nine native host materials.
  const prompt = 'Continue the bounded native host alignment.';
  const identity = {
    revisionFingerprint: { status: 'available', digest: digest('revision') },
    scopeFingerprint: digest('scope'),
    ...runtimeFingerprints(),
  };
  const first = classifyAdaptiveDecision(prompt, {
    ...identity,
    decisionId: 'decision-native-material',
    scope: 'bounded',
  });

  // When: each selected material is changed independently.
  for (const field of [
    'host', 'profile', 'probe', 'binary', 'session', 'worktree', 'mcp',
    'generated_asset', 'marketplace',
  ]) {
    const changed = runtimeFingerprints();
    changed.runtime_fingerprints['trae-ide'][field] = field === 'host'
      ? 'trae-cli'
      : { status: 'available', digest: digest(`changed:${field}`) };
    const resumed = classifyAdaptiveDecision(prompt, {
      revisionFingerprint: identity.revisionFingerprint,
      scopeFingerprint: identity.scopeFingerprint,
      ...changed,
      priorSnapshot: first.snapshot,
      scope: 'bounded',
    });

    // Then: no changed material may reuse prior completion evidence.
    assert.notEqual(resumed.snapshot.decisionId, 'decision-native-material', field);
  }
});

test('Todo28 unavailable native probe fails closed', () => {
  // Given: a prior decision bound to an available native probe.
  const prompt = 'Continue the bounded native host alignment.';
  const identity = {
    revisionFingerprint: { status: 'available', digest: digest('revision') },
    scopeFingerprint: digest('scope'),
    ...runtimeFingerprints(),
  };
  const first = classifyAdaptiveDecision(prompt, {
    ...identity,
    decisionId: 'decision-native-probe',
    scope: 'bounded',
  });
  const unavailable = runtimeFingerprints();
  unavailable.runtime_fingerprints['trae-ide'].probe = { status: 'unavailable', digest: null };

  // When: the current native probe is unavailable.
  const resumed = classifyAdaptiveDecision(prompt, {
    revisionFingerprint: identity.revisionFingerprint,
    scopeFingerprint: identity.scopeFingerprint,
    ...unavailable,
    priorSnapshot: first.snapshot,
    scope: 'bounded',
  });

  // Then: the prior decision cannot resume.
  assert.notEqual(resumed.snapshot.decisionId, 'decision-native-probe');
});

test('Todo28 canonical event is durable first and duplicate replay is idempotent', (t) => {
  // Given: one active run and a stable event identity.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-todo28-event-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const loop = {
    run_id: 'run-todo28',
    loop_state: 'active',
    active_goal_id: 'goal-todo28',
  };
  const options = {
    eventId: 'evt:todo28:001',
    timestamp: '2026-08-14T12:00:00.000Z',
  };

  // When: the same package event is delivered twice.
  const first = appendEvent(root, loop, 'native_checkpoint_linked', {
    checkpoint_id: 'native:checkpoint:001',
    effect: 'reference-only',
  }, options);
  const duplicate = appendEvent(root, loop, 'native_checkpoint_linked', {
    checkpoint_id: 'native:checkpoint:001',
    effect: 'reference-only',
  }, options);
  const ledgerPath = path.join(root, '.lazytrae', 'loop', 'run-todo28', 'ledger.jsonl');
  fs.writeFileSync(ledgerPath, '');
  const recovered = appendEvent(root, loop, 'native_checkpoint_linked', {
    checkpoint_id: 'native:checkpoint:001',
    effect: 'reference-only',
  }, options);

  // Then: one canonical record precedes exactly one copy in each existing mirror.
  const canonicalPath = path.join(root, '.lazytrae', 'loop', 'run-todo28', 'canonical-events.jsonl');
  const canonical = fs.readFileSync(canonicalPath, 'utf8').trim().split('\n').map(JSON.parse);
  const product = fs.readFileSync(path.join(root, '.lazytrae', 'logs', 'loop-events.ndjson'), 'utf8')
    .trim().split('\n').map(JSON.parse);
  const ledger = fs.readFileSync(ledgerPath, 'utf8')
    .trim().split('\n').map(JSON.parse);
  assert.equal(first.outcome, 'recorded');
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal(recovered.outcome, 'duplicate');
  assert.equal(canonical.length, 1);
  assert.equal(product.length, 1);
  assert.equal(ledger.length, 1);
  assert.equal(canonical[0].event_id, 'evt:todo28:001');
  assert.equal(product[0].event_id, canonical[0].event_id);
  assert.equal(ledger[0].event_id, canonical[0].event_id);
  assert.equal(loop.loop_state, 'active');
  assert.equal(loop.active_goal_id, 'goal-todo28');
});

test('Todo28 malformed or colliding canonical events fail closed', (t) => {
  // Given: one isolated active run.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-todo28-malformed-event-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const loop = { run_id: 'run-todo28', loop_state: 'active', active_goal_id: null };

  // When: a malformed event is refused and a stable identity is replayed with changed content.
  assert.throws(
    () => appendEvent(root, loop, 'checkpoint', {}, { eventId: '!' }),
    /malformed/,
  );
  appendEvent(root, loop, 'checkpoint', { effect: 'reference-only' }, {
    eventId: 'evt:todo28:collision',
    timestamp: '2026-08-14T12:00:00.000Z',
  });

  // Then: the collision is refused without a second canonical or mirrored record.
  assert.throws(
    () => appendEvent(root, loop, 'checkpoint', { effect: 'advance' }, {
      eventId: 'evt:todo28:collision',
      timestamp: '2026-08-14T12:00:00.000Z',
    }),
    /collision/,
  );
  for (const filePath of [
    path.join(root, '.lazytrae', 'loop', 'run-todo28', 'canonical-events.jsonl'),
    path.join(root, '.lazytrae', 'logs', 'loop-events.ndjson'),
    path.join(root, '.lazytrae', 'loop', 'run-todo28', 'ledger.jsonl'),
  ]) assert.equal(fs.readFileSync(filePath, 'utf8').trim().split('\n').length, 1);
});
