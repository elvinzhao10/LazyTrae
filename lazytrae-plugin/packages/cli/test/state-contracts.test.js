const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { HANDLERS } = require('../../mcp/src/tools');
const { REPO_ROOT, makeFixture, runCli } = require('./test-helpers');

function writeActiveWork(root, activePlan) {
  const now = '2026-07-09T00:00:00Z';
  const boulderPath = path.join(root, '.lazytrae', 'state', 'boulder.json');
  fs.writeFileSync(boulderPath, JSON.stringify({
    schema_version: 2,
    active_work_id: 'work-1',
    works: {
      'work-1': {
        work_id: 'work-1',
        active_plan: activePlan,
        plan_name: 'demo',
        session_ids: [],
        status: 'active',
        worktree_path: null,
        tasks: [],
        blockers: [],
        created_at: now,
        updated_at: now,
      },
    },
  }, null, 2) + '\n');
}

test('fresh init installs the team schema so team create passes doctor', () => {
  const fixture = makeFixture('lazytrae-team-schema-');

  assert.equal(fs.existsSync(path.join(fixture, '.lazytrae', 'schemas', 'team.schema.json')), true);
  assert.equal(runCli(['team', 'create', '--name', 'contract'], { cwd: fixture }).status, 0);

  const doctor = runCli(['doctor'], { cwd: fixture });
  assert.equal(doctor.status, 0, doctor.stdout);
  assert.match(doctor.stdout, /Team mode[\s\S]*PASS/);
});

test('doctor and active-plan reads reject dangling and escaping active plans', () => {
  const fixture = makeFixture('lazytrae-active-plan-contract-');

  writeActiveWork(fixture, '.lazytrae/plans/missing.md');
  const danglingDoctor = runCli(['doctor'], { cwd: fixture });
  assert.equal(danglingDoctor.status, 1);
  assert.match(danglingDoctor.stdout, /Active plan validation[\s\S]*missing\.md/);
  assert.equal(HANDLERS['lazytrae.get_active_plan'](fixture, {}).error, 'INVALID_ACTIVE_PLAN');

  writeActiveWork(fixture, '../outside.md');
  const escapingDoctor = runCli(['doctor'], { cwd: fixture });
  assert.equal(escapingDoctor.status, 1);
  assert.match(escapingDoctor.stdout, /Active plan validation[\s\S]*inside \.lazytrae\/plans/);
});

test('idle state templates make no dangling artifact or sample-plan claims', () => {
  const activeLoop = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'state', 'active-loop.json'),
    'utf8',
  ));
  assert.equal(activeLoop.run_id, null);
  assert.equal(activeLoop.brief_path, null);
  assert.equal(activeLoop.goals_path, null);
  assert.equal(activeLoop.ledger_path, null);

  for (const stateFile of ['boulder.json', 'sessions.json']) {
    const state = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'state', stateFile),
      'utf8',
    ));
    assert.equal(Object.hasOwn(state, '_example'), false, `${stateFile} must not claim a missing sample artifact`);
  }

  const templateRoot = path.join(REPO_ROOT, 'packages', 'cli', 'templates');
  const pending = [templateRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else assert.doesNotMatch(fs.readFileSync(entryPath, 'utf8'), /\.omo\//, `${entryPath} retains an obsolete operational path`);
    }
  }
});
