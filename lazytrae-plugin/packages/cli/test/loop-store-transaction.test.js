const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const STORE = path.resolve(__dirname, '../src/lib/loop-store.js');
const CLI = path.resolve(__dirname, '../src/index.js');
const {
  appendEvent,
  defaultLoop,
  loadLoop,
  persistBrief,
  saveLoop,
} = require(STORE);

const CHILD = String.raw`
const fs = require('node:fs');
const [storePath, root, action, value] = process.argv.slice(1);
const { appendEvent, loadLoop, persistBrief, saveLoop } = require(storePath);
const loop = loadLoop(root);
if (action === 'save') {
  loop.generation = value;
  loop.goals = [{ id: value }];
  saveLoop(root, loop);
} else if (action === 'event') {
  appendEvent(root, loop, 'checkpoint', { value }, {
    eventId: process.env.EVENT_ID,
    timestamp: '2026-08-27T12:00:00.000Z',
  });
} else if (action === 'brief') {
  persistBrief(root, loop, value);
}
`;

function fixture(t, prefix = 'lazytrae-transaction-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const loop = defaultLoop();
  loop.run_id = 'run-transaction';
  loop.generation = 'old';
  loop.goals = [{ id: 'old' }];
  saveLoop(root, loop);
  persistBrief(root, loop, 'old');
  return { root, loop };
}

function runChild(root, action, value, env = {}) {
  return spawnSync(process.execPath, ['-e', CHILD, STORE, root, action, value], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function spawnChild(root, action, value, env = {}) {
  const child = spawn(process.execPath, ['-e', CHILD, STORE, root, action, value], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  return new Promise(resolve => {
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stderr }));
  });
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function eventFiles(root) {
  return [
    path.join(root, '.lazytrae', 'loop', 'run-transaction', 'canonical-events.jsonl'),
    path.join(root, '.lazytrae', 'logs', 'loop-events.ndjson'),
    path.join(root, '.lazytrae', 'loop', 'run-transaction', 'ledger.jsonl'),
  ];
}

for (const boundary of ['stage:1', 'stage:2', 'journal', 'commit', 'install:1', 'install:2']) {
  test(`saveLoop recovery is all-old or all-new after crash at ${boundary}`, t => {
    const { root } = fixture(t, `lazytrae-save-${boundary.replace(':', '-')}-`);
    const result = runChild(root, 'save', 'new', { LAZYTRAE_TRANSACTION_CRASH_AT: boundary });
    assert.equal(result.status, 86, result.stderr);

    const recovered = loadLoop(root);
    const goals = JSON.parse(fs.readFileSync(path.join(root, recovered.goals_path), 'utf8'));
    const expected = boundary === 'commit' || boundary.startsWith('install:') ? 'new' : 'old';
    assert.equal(recovered.generation, expected);
    assert.equal(goals[0].id, expected);
  });
}

for (const boundary of ['stage:1', 'stage:2', 'stage:3', 'journal', 'commit', 'install:1', 'install:2', 'install:3']) {
  test(`appendEvent recovery has three matching generations after crash at ${boundary}`, t => {
    const { root } = fixture(t, `lazytrae-event-${boundary.replace(':', '-')}-`);
    const eventId = `evt:transaction:${boundary.replace(':', '-')}`;
    const result = runChild(root, 'event', 'new', {
      EVENT_ID: eventId,
      LAZYTRAE_TRANSACTION_CRASH_AT: boundary,
    });
    assert.equal(result.status, 86, result.stderr);

    loadLoop(root);
    const committed = boundary === 'commit' || boundary.startsWith('install:');
    assert.deepEqual(eventFiles(root).map(filePath => fs.existsSync(filePath)), [committed, committed, committed]);
    if (committed) {
      const hashes = eventFiles(root).map(filePath => sha256(filePath));
      const ids = eventFiles(root).map(filePath => JSON.parse(fs.readFileSync(filePath, 'utf8')).event_id);
      assert.deepEqual(ids, [eventId, eventId, eventId]);
      assert.equal(hashes.every(hash => /^[a-f0-9]{64}$/.test(hash)), true);
    }
  });
}

for (const boundary of ['stage:1', 'journal', 'commit', 'install:1']) {
  test(`persistBrief recovers the correct generation after crash at ${boundary}`, t => {
    const { root, loop } = fixture(t, `lazytrae-brief-${boundary.replace(':', '-')}-`);
    const briefPath = path.join(root, loop.brief_path);
    assert.equal(runChild(root, 'brief', 'new', {
      LAZYTRAE_TRANSACTION_CRASH_AT: boundary,
    }).status, 86);
    loadLoop(root);
    const expected = boundary === 'commit' || boundary.startsWith('install:') ? 'new' : 'old';
    assert.equal(fs.readFileSync(briefPath, 'utf8'), expected);
  });
}

test('two writers serialize identical replay and reject a conflicting event collision', async t => {
  const { root } = fixture(t);
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const id = `evt:transaction:collision-${iteration}`;
    const identical = await Promise.all([
      spawnChild(root, 'event', 'same', { EVENT_ID: id }),
      spawnChild(root, 'event', 'same', { EVENT_ID: id }),
    ]);
    assert.deepEqual(identical.map(result => result.status).sort(), [0, 0]);

    const conflictId = `evt:transaction:conflict-${iteration}`;
    const conflicting = await Promise.all([
      spawnChild(root, 'event', 'left', { EVENT_ID: conflictId }),
      spawnChild(root, 'event', 'right', { EVENT_ID: conflictId }),
    ]);
    assert.deepEqual(conflicting.map(result => result.status).sort(), [0, 1]);
    for (const filePath of eventFiles(root)) {
      const events = fs.readFileSync(filePath, 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(events.filter(event => event.event_id === id).length, 1);
      assert.equal(events.filter(event => event.event_id === conflictId).length, 1);
    }
  }
});

test('committed journal with an unexpected target hash fails closed', t => {
  const { root } = fixture(t);
  const result = runChild(root, 'save', 'new', { LAZYTRAE_TRANSACTION_CRASH_AT: 'commit' });
  assert.equal(result.status, 86, result.stderr);
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'), '{"tampered":true}\n');

  assert.throws(() => loadLoop(root), /hash-inconsistent committed transaction journal/i);
});

test('unreadable transaction journal fails closed on a normal state read', t => {
  const { root } = fixture(t);
  const journalDir = path.join(root, '.lazytrae', 'state', 'transactions', 'journals', 'bad');
  fs.mkdirSync(journalDir, { recursive: true });
  fs.writeFileSync(path.join(journalDir, 'journal.json'), '{not-json');

  assert.throws(() => loadLoop(root), /transaction journal/i);

  const completion = spawnSync(process.execPath, [CLI, 'completion-status'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(completion.status, 0);
  assert.match(completion.stderr, /transaction journal/i);
});
