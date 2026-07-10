const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validateStateFile } = require('../src/lib/validator');
const {
  CLI,
  REPO_ROOT,
  makeFixture,
  runCli,
} = require('./test-helpers');

test('CLI command routing shows help and rejects unknown commands', () => {
  const help = runCli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Commands:/);
  assert.match(help.stdout, /doctor/);

  const unknown = runCli(['does-not-exist']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown command 'does-not-exist'/);
});

test('hook fixtures execute through the CLI dispatcher', () => {
  const fixture = makeFixture('lazytrae-hook-dispatch-');
  const preToolFixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'pre-tool-use-git.json'), 'utf-8');
  const preTool = runCli(['hook', 'pre-tool-use'], { cwd: fixture, input: preToolFixture });
  assert.equal(preTool.status, 0);
  assert.match(preTool.stdout, /Destructive git command detected/);

  const promptFixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'user-prompt-submit.json'), 'utf-8');
  const prompt = runCli(['hook', 'user-prompt-submit'], { cwd: fixture, input: promptFixture });
  assert.equal(prompt.status, 0);
  assert.match(prompt.stdout, /ULTRAWORK MODE ENABLED/);
});

test('hook user-prompt-submit records context recovery state when compaction markers appear', () => {
  const fixture = makeFixture('lazytrae-context-marker-');
  const prompt = runCli(['hook', 'user-prompt-submit'], {
    cwd: fixture,
    input: JSON.stringify({ prompt: 'The context_length_exceeded marker appeared.' }),
  });

  assert.equal(prompt.status, 0);
  assert.match(prompt.stdout, /Context pressure detected/);
  const sessions = JSON.parse(fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'sessions.json'), 'utf-8'));
  const state = sessions.compaction_state;
  assert.equal(state.post_compact_recovery_needed, true);
  assert.equal(state.recovery_reason, 'context-pressure marker in UserPromptSubmit');
  assert.equal(typeof state.recovery_detected_at, 'string');
  assert.match(state.last_injected_rules_hash, /^[a-f0-9]{64}$/);
  assert.equal(state.recovery_events.at(-1).action, 'marked');
});

test('hook recover-context emits recovery text and clears pending context state', () => {
  const fixture = makeFixture('lazytrae-context-recover-');
  assert.equal(runCli(['hook', 'user-prompt-submit'], {
    cwd: fixture,
    input: JSON.stringify({ prompt: 'Context compacted while working.' }),
  }).status, 0);

  const recovered = runCli(['hook', 'recover-context'], { cwd: fixture });

  assert.equal(recovered.status, 0);
  assert.match(recovered.stdout, /Post-compact recovery needed/);
  assert.match(recovered.stdout, /re-read AGENTS\.md/);
  const sessions = JSON.parse(fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'sessions.json'), 'utf-8'));
  const state = sessions.compaction_state;
  assert.equal(state.post_compact_recovery_needed, false);
  assert.equal(typeof state.post_compact_recovered_at, 'string');
  assert.equal(state.recovery_events.at(-1).action, 'recovered');
});

test('hook session-start clears pending context recovery after emitting recovery text', () => {
  const fixture = makeFixture('lazytrae-session-recover-');
  assert.equal(runCli(['hook', 'user-prompt-submit'], {
    cwd: fixture,
    input: JSON.stringify({ prompt: 'skill descriptions were shortened after compaction' }),
  }).status, 0);

  const sessionStart = runCli(['hook', 'session-start'], { cwd: fixture });

  assert.equal(sessionStart.status, 0);
  assert.match(sessionStart.stdout, /Post-compact recovery needed/);
  const sessions = JSON.parse(fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'sessions.json'), 'utf-8'));
  assert.equal(sessions.compaction_state.post_compact_recovery_needed, false);
});

test('doctor reports stale pending context recovery with manual recovery command', () => {
  const fixture = makeFixture('lazytrae-stale-recovery-');
  const sessionsPath = path.join(fixture, '.lazytrae', 'state', 'sessions.json');
  const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
  sessions.compaction_state.post_compact_recovery_needed = true;
  sessions.compaction_state.recovery_detected_at = '2026-01-01T00:00:00.000Z';
  sessions.compaction_state.recovery_reason = 'test stale recovery';
  fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2) + '\n');

  const doctor = runCli(['doctor'], { cwd: fixture });

  assert.equal(doctor.status, 0);
  assert.match(doctor.stdout, /Post-compact recovery state/);
  assert.match(doctor.stdout, /run lazytrae hook recover-context/);
});

test('MCP smoke imports the intentional packages/mcp tool surface', () => {
  const { TOOLS, HANDLERS } = require('../../mcp/src/tools');
  assert.equal(TOOLS.length, 15);
  assert.equal(typeof HANDLERS['lazytrae.get_active_plan'], 'function');
  assert.equal(typeof HANDLERS['lazytrae.record_evidence'], 'function');
  assert.equal(typeof HANDLERS['lazytrae.symbol_search'], 'function');
});

test('lazytrae mcp wrapper starts the packages/mcp server', async () => {
  const child = spawn(process.execPath, [CLI, 'mcp'], { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });

  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) + '\n');

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`mcp wrapper did not respond; stderr=${stderr}`)), 2000);
    child.stdout.on('data', () => {
      if (stdout.includes('lazytrae-mcp')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', code => {
      if (!stdout.includes('lazytrae-mcp')) {
        clearTimeout(timer);
        reject(new Error(`mcp wrapper exited ${code}; stderr=${stderr}`));
      }
    });
  });

  child.kill();
  assert.match(stdout, /lazytrae-mcp/);
});

test('doctor reports broken hook syntax with an actionable fix', () => {
  const fixture = makeFixture('lazytrae-broken-hook-');
  const hookPath = path.join(fixture, '.trae', 'hooks', 'stop.sh');
  fs.writeFileSync(hookPath, '#!/usr/bin/env bash\nif then\n', { mode: 0o755 });

  const result = runCli(['doctor'], { cwd: fixture });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\.trae\/hooks\/stop\.sh syntax/);
  assert.match(result.stdout, /Run `bash -n \.trae\/hooks\/stop\.sh` to diagnose/);
});

test('doctor fails completed Boulder tasks that do not have evidence paths', () => {
  const fixture = makeFixture('lazytrae-missing-evidence-');
  const boulderPath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const boulder = JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
  boulder.active_work_id = 'work-1';
  boulder.works = {
    'work-1': {
      work_id: 'work-1',
      active_plan: '.omo/plans/demo.md',
      plan_name: 'demo',
      session_ids: [],
      status: 'active',
      worktree_path: null,
      tasks: [{ id: 'task-1', description: 'Done without proof', status: 'complete', evidence_paths: [] }],
      blockers: [],
      created_at: '2026-07-09T00:00:00Z',
      updated_at: '2026-07-09T00:00:00Z',
    },
  };
  fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');

  const result = runCli(['doctor'], { cwd: fixture });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Completed task evidence gate/);
  assert.match(result.stdout, /task-1/);
});

test('validator rejects malformed state against schemas', () => {
  const fixture = makeFixture('lazytrae-invalid-state-');
  const boulderPath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const boulder = JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
  boulder.schema_version = 99;
  fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');

  const result = runCli(['doctor'], { cwd: fixture });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Schema validation: boulder\.json/);
});

test('validator accepts nullable active-loop lifecycle timestamps', () => {
  const fixture = makeFixture('lazytrae-nullable-active-loop-');

  const valid = validateStateFile(fixture, 'active-loop.json', 'active-loop.schema.json');
  assert.equal(valid.valid, true, valid.errors.join('; '));

  const activeLoopPath = path.join(fixture, '.lazytrae', 'state', 'active-loop.json');
  const activeLoop = JSON.parse(fs.readFileSync(activeLoopPath, 'utf-8'));
  activeLoop.started_at = 42;
  fs.writeFileSync(activeLoopPath, JSON.stringify(activeLoop, null, 2) + '\n');

  const invalid = validateStateFile(fixture, 'active-loop.json', 'active-loop.schema.json');
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('; '), /started_at/);
});

test('doctor and verify expose expected health-check behavior', () => {
  const fixture = makeFixture('lazytrae-doctor-verify-');
  const doctor = runCli(['doctor'], { cwd: fixture });
  assert.equal(doctor.status, 0);
  assert.match(doctor.stdout, /LazyTrae Doctor/);
  assert.match(doctor.stdout, /0 FAIL/);

  const verifyHelp = runCli(['verify', '--help'], { cwd: fixture });
  assert.equal(verifyHelp.status, 0);
  assert.match(verifyHelp.stdout, /lazytrae verify/);

  const verify = runCli(['verify'], { cwd: fixture });
  assert.equal(verify.status, 0);
  assert.match(verify.stdout, /0 FAIL/);

  const strictVerify = runCli(['verify', '--strict'], { cwd: fixture });
  assert.equal(strictVerify.status, 1);
  assert.match(strictVerify.stdout, /\d+ WARN, 0 FAIL/);
});
