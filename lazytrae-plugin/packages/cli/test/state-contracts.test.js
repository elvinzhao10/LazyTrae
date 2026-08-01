const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { HANDLERS } = require('../../mcp/src/tools');
const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { validateStateFile } = require('../src/lib/validator');
const { REPO_ROOT, makeFixture, runCli } = require('./test-helpers');

const HAS_AJV = (() => {
  try {
    require('ajv');
    require('ajv-formats');
    return true;
  } catch (_) {
    return false;
  }
})();

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

test('sessions state rejects malformed required values while allowing omitted recovery details', () => {
  // Given: an initialized project whose optional recovery details are absent.
  const fixture = makeFixture('lazytrae-sessions-contract-');
  const sessionsPath = path.join(fixture, '.lazytrae', 'state', 'sessions.json');
  const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
  delete sessions.compaction_state.recovery_reason;
  delete sessions.compaction_state.recovery_detected_at;
  delete sessions.compaction_state.post_compact_recovered_at;
  delete sessions.compaction_state.last_injected_rules_hash;
  delete sessions.compaction_state.recovery_events;
  fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2) + '\n');

  // When: the schema validator validates the partial optional state.
  const optionalFieldsAbsent = validateStateFile(fixture, 'sessions.json', 'sessions.schema.json');

  // Then: the optional details remain compatible, but malformed required values are rejected.
  assert.equal(optionalFieldsAbsent.valid, true, optionalFieldsAbsent.errors.join('; '));

  sessions.current_session_id = '';
  sessions.compaction_state.last_compaction_at = 'not-a-timestamp';
  fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2) + '\n');
  const malformed = validateStateFile(fixture, 'sessions.json', 'sessions.schema.json');
  if (HAS_AJV) {
    assert.equal(malformed.valid, false);
    assert.equal(malformed.structuralValidation, undefined);
    assert.match(malformed.errors.join('; '), /current_session_id/);
    assert.match(malformed.errors.join('; '), /last_compaction_at/);
  } else {
    assert.equal(malformed.valid, true);
    assert.equal(malformed.structuralValidation, 'unchecked');
  }
});

test('every checked-in state schema remains aligned with the installed template', () => {
  // Given: the package's checked-in schema mirror and installation source templates.
  const checkedInDirectory = path.join(REPO_ROOT, '.lazytrae', 'schemas');
  const templateDirectory = path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'schemas');
  const checkedInFiles = fs.readdirSync(checkedInDirectory).filter(file => file.endsWith('.schema.json')).sort();
  const templateFiles = fs.readdirSync(templateDirectory).filter(file => file.endsWith('.schema.json')).sort();

  // When: the complete release inventories and their content are compared.
  // Then: source-tree users and fresh installs share every state-schema contract.
  assert.deepEqual(checkedInFiles, templateFiles);
  for (const schemaFile of templateFiles) {
    assert.equal(
      fs.readFileSync(path.join(checkedInDirectory, schemaFile), 'utf8'),
      fs.readFileSync(path.join(templateDirectory, schemaFile), 'utf8'),
      `${schemaFile} differs between the checked-in mirror and installation template`,
    );
  }
});

test('doctor accepts the idle loop and rejects strict values for source and installed schemas', () => {
  // Given: one fixture with checked-in schemas and one initialized by the installation templates.
  const sourceFixture = makeFixture('lazytrae-source-schema-doctor-');
  const installedFixture = makeFixture('lazytrae-installed-schema-doctor-');
  fs.cpSync(
    path.join(REPO_ROOT, '.lazytrae', 'schemas'),
    path.join(sourceFixture, '.lazytrae', 'schemas'),
    { recursive: true, force: true },
  );

  // When: doctor validates the shared idle state, then a strict active-loop value.
  for (const fixture of [sourceFixture, installedFixture]) {
    const idle = runCli(['doctor'], { cwd: fixture });
    assert.equal(idle.status, 0, idle.stdout);

    const activeLoopPath = path.join(fixture, '.lazytrae', 'state', 'active-loop.json');
    const activeLoop = JSON.parse(fs.readFileSync(activeLoopPath, 'utf8'));
    activeLoop.run_id = 42;
    fs.writeFileSync(activeLoopPath, JSON.stringify(activeLoop, null, 2) + '\n');

    const strict = runCli(['doctor'], { cwd: fixture });
    if (HAS_AJV) {
      assert.equal(strict.status, 1, strict.stdout);
      assert.match(strict.stdout, /Schema validation: active-loop\.json[\s\S]*\/run_id/);
      assert.doesNotMatch(strict.stdout, /Structural validation unchecked/);
    } else {
      assert.equal(strict.status, 0, strict.stdout);
      assert.match(strict.stdout, /Schema validation: active-loop\.json[\s\S]*WARN/);
      assert.match(strict.stdout, /Structural validation unchecked/);
    }
  }
});

test('source and installed schemas accept only the closed canonical adaptive snapshot', () => {
  const sourceFixture = makeFixture('lazytrae-source-adaptive-schema-');
  const installedFixture = makeFixture('lazytrae-installed-adaptive-schema-');
  try {
    fs.copyFileSync(
      path.join(REPO_ROOT, '.lazytrae', 'schemas', 'active-loop.schema.json'),
      path.join(sourceFixture, '.lazytrae', 'schemas', 'active-loop.schema.json'),
    );
    const canonical = classifyAdaptiveDecision('Fix one typo in one file.').snapshot;

    for (const fixture of [sourceFixture, installedFixture]) {
      const activeLoopPath = path.join(fixture, '.lazytrae', 'state', 'active-loop.json');
      const activeLoop = JSON.parse(fs.readFileSync(activeLoopPath, 'utf8'));
      activeLoop.adaptive = canonical;
      fs.writeFileSync(activeLoopPath, JSON.stringify(activeLoop, null, 2) + '\n');
      const valid = validateStateFile(fixture, 'active-loop.json', 'active-loop.schema.json');
      assert.equal(valid.valid, true, valid.errors.join('; '));

      for (const corrupt of [
        { ...canonical, escalation_count: 0 },
        { ...canonical, capabilityClasses: ['unknown-capability'] },
        { ...canonical, approval: { ...canonical.approval, extra: true } },
        { ...canonical, currentStage: 'plan' },
        { ...canonical, escalationCount: 1 },
        {
          ...canonical,
          escalationCount: 1,
          escalationHistory: [{
            fromMode: 'direct',
            sequence: 2,
            stageAdded: 'debug',
            toMode: 'assisted',
            trigger: 'verification-failure',
          }],
        },
        Object.fromEntries(Object.entries(canonical).filter(([key]) => key !== 'requestDigest')),
      ]) {
        activeLoop.adaptive = corrupt;
        fs.writeFileSync(activeLoopPath, JSON.stringify(activeLoop, null, 2) + '\n');
        const invalid = validateStateFile(fixture, 'active-loop.json', 'active-loop.schema.json');
        if (HAS_AJV) {
          assert.equal(invalid.valid, false, JSON.stringify(corrupt));
          assert.equal(invalid.structuralValidation, undefined);
        } else {
          assert.equal(invalid.valid, true);
          assert.equal(invalid.structuralValidation, 'unchecked');
        }
      }
    }
  } finally {
    fs.rmSync(sourceFixture, { recursive: true, force: true });
    fs.rmSync(installedFixture, { recursive: true, force: true });
  }
});

test('dependency-free validation keeps JSON and version failures blocking', () => {
  const fixture = makeFixture('lazytrae-validator-dependency-free-');
  const statePath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const schemaPath = path.join(fixture, '.lazytrae', 'schemas', 'boulder.schema.json');
  const state = fs.readFileSync(statePath, 'utf8');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const clean = validateStateFile(fixture, 'boulder.json', 'boulder.schema.json');
  assert.equal(clean.valid, true, clean.errors.join('; '));
  if (HAS_AJV) {
    assert.equal(clean.structuralValidation, 'validated');
    assert.deepEqual(clean.warnings, []);
  } else {
    assert.match(clean.warnings.join('; '), /Structural validation unchecked/);
  }
  assert.equal(runCli(['verify', '--must-pass'], { cwd: fixture }).status, 0);

  fs.writeFileSync(statePath, '{\n');
  const malformedState = validateStateFile(fixture, 'boulder.json', 'boulder.schema.json');
  assert.equal(malformedState.valid, false);
  assert.match(malformedState.errors.join('; '), /Invalid JSON in boulder\.json/);

  fs.writeFileSync(statePath, state);
  fs.writeFileSync(schemaPath, '{\n');
  const malformedSchema = validateStateFile(fixture, 'boulder.json', 'boulder.schema.json');
  assert.equal(malformedSchema.valid, false);
  assert.match(malformedSchema.errors.join('; '), /Invalid JSON schema boulder\.schema\.json/);

  fs.writeFileSync(schemaPath, schema);
  const withoutVersion = JSON.parse(state);
  delete withoutVersion.schema_version;
  fs.writeFileSync(statePath, JSON.stringify(withoutVersion, null, 2) + '\n');
  const missingVersion = validateStateFile(fixture, 'boulder.json', 'boulder.schema.json');
  assert.equal(missingVersion.valid, false);
  assert.match(missingVersion.errors.join('; '), /Invalid schema_version in boulder\.json/);

  withoutVersion.schema_version = 99;
  fs.writeFileSync(statePath, JSON.stringify(withoutVersion, null, 2) + '\n');
  const wrongVersion = validateStateFile(fixture, 'boulder.json', 'boulder.schema.json');
  assert.equal(wrongVersion.valid, false);
  assert.match(wrongVersion.errors.join('; '), /Invalid schema_version in boulder\.json/);

  const verify = runCli(['verify', '--must-pass'], { cwd: fixture });
  assert.equal(verify.status, 1, verify.stdout);
  assert.match(verify.stdout, /Invalid schema_version in boulder\.json/);
});
