const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeFixture, runCli } = require('./test-helpers');

test('doctor enforces RFC3339 date-time formats in installed state schemas', () => {
  const fixture = makeFixture('lazytrae-date-time-state-');
  const boulderPath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const activeLoopPath = path.join(fixture, '.lazytrae', 'state', 'active-loop.json');
  const boulder = JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
  const activeLoop = JSON.parse(fs.readFileSync(activeLoopPath, 'utf-8'));

  // Given valid UTC and offset RFC3339 timestamps in real initialized state.
  boulder.active_work_id = 'work-1';
  boulder.works = {
    'work-1': {
      work_id: 'work-1',
      active_plan: '.lazytrae/plans/demo.md',
      plan_name: 'demo',
      session_ids: [],
      status: 'active',
      tasks: [],
      created_at: '2026-07-16T12:34:56Z',
      updated_at: '2026-07-16T20:34:56+08:00',
    },
  };
  activeLoop.started_at = null;
  activeLoop.completed_at = null;
  activeLoop.cancelled_at = null;
  fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');
  fs.writeFileSync(activeLoopPath, JSON.stringify(activeLoop, null, 2) + '\n');

  // When doctor validates the installed state.
  const valid = runCli(['doctor'], { cwd: fixture });

  // Then valid timestamps and nullable lifecycle fields pass without warnings.
  assert.equal(valid.status, 0, valid.stdout);
  assert.doesNotMatch(valid.stderr, /unknown format \"date-time\" ignored/i);

  // Given invalid date-time values, when doctor validates them, then it reports their property path.
  for (const createdAt of ['not-a-timestamp', '2026-02-30T12:34:56Z']) {
    boulder.works['work-1'].created_at = createdAt;
    fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');
    const invalid = runCli(['doctor'], { cwd: fixture });
    if (valid.stdout.includes('Structural validation unchecked')) {
      assert.equal(invalid.status, 0, invalid.stdout);
      assert.match(invalid.stdout, /Schema validation: boulder\.json[\s\S]*WARN/);
      assert.match(invalid.stdout, /Structural validation unchecked/);
    } else {
      assert.equal(invalid.status, 1, invalid.stdout);
      assert.match(invalid.stdout, /Schema validation: boulder\.json[\s\S]*\/created_at.*date-time/);
    }
  }
});
