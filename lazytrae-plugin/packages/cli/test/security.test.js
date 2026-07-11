const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { HANDLERS } = require('../../mcp/src/tools');
const { defaultLoop, saveLoop } = require('../src/lib/loop-store');
const { CLI, makeCompletionFixture, makeFixture, makeLoopFixture, runCli } = require('./test-helpers');

test('hook dispatcher does not shell-expand hook script paths', () => {
  const fixture = makeFixture('lazytrae-hook-$(touch pwned-hook)-');

  const result = runCli(['hook', 'session-start'], { cwd: fixture });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(fixture, 'pwned-hook')), false);
});

test('post-tool-use hook does not eval JSON-derived file paths', () => {
  const fixture = makeFixture('lazytrae-post-tool-injection-');
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: { filePath: '$(touch pwned-post)' },
    tool_response: { exitCode: 0 },
  });

  const result = runCli(['hook', 'post-tool-use'], { cwd: fixture, input });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(fixture, 'pwned-post')), false);
});

test('session-start hook treats Boulder active_work_id as data', () => {
  const fixture = makeFixture('lazytrae-session-id-injection-');
  const boulderPath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const boulder = JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
  boulder.active_work_id = "x'];require('fs').writeFileSync('pwned-session','x');//";
  boulder.works = {};
  fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');

  const result = runCli(['hook', 'session-start'], { cwd: fixture });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(fixture, 'pwned-session')), false);
});

test('run command passes prompt to trae-agent as argv', () => {
  const fixture = makeFixture('lazytrae-run-prompt-injection-');
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-fake-bin-'));
  const marker = path.join(fixture, 'pwned-run');
  const argsFile = path.join(fixture, 'trae-agent-args.json');
  const fakeAgent = path.join(binDir, 'trae-agent');
  fs.writeFileSync(fakeAgent, `#!/usr/bin/env node\nrequire('fs').writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2))); process.exit(0);\n`, { mode: 0o755 });

  const result = spawnSync(process.execPath, [CLI, 'run', '$(touch pwned-run)'], {
    cwd: fixture,
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` },
    encoding: 'utf-8',
  });

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(JSON.parse(fs.readFileSync(argsFile, 'utf-8')).includes('$(touch pwned-run)'), true);
});

test('MCP dependency graph rejects symlinks that resolve outside the repo', () => {
  const fixture = makeFixture('lazytrae-mcp-symlink-');
  const outside = path.join(os.tmpdir(), `lazytrae-outside-${process.pid}.js`);
  fs.writeFileSync(outside, "const secret = require('fs');\n");
  fs.symlinkSync(outside, path.join(fixture, 'outside-link.js'));

  const graph = HANDLERS['lazytrae.dependency_graph'](fixture, { path: 'outside-link.js' });

  assert.equal(graph.missing, true);
  assert.match(graph.error, /outside the repo root/);
  assert.deepEqual(graph.imports, []);
  fs.rmSync(outside, { force: true });
});

test('completion and loop evidence reject absolute paths outside the repo', () => {
  const outside = path.join(os.tmpdir(), `lazytrae-outside-proof-${process.pid}.txt`);
  fs.writeFileSync(outside, 'outside proof\n');

  const completion = makeCompletionFixture('lazytrae-absolute-evidence-', false);
  const done = HANDLERS['lazytrae.mark_task_done'](completion, {
    task_id: 'task-1',
    evidence_summary: 'proof',
    evidence_paths: [outside],
  });
  assert.equal(done.error, 'EVIDENCE_REQUIRED');
  assert.match(done.evidence_errors.join('\n'), /repo-relative/);

  const loop = makeLoopFixture('lazytrae-loop-absolute-evidence-');
  assert.equal(runCli(['loop', 'create-goals', '--brief', outside, '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: loop }).status, 1);
  assert.equal(runCli(['loop', 'create-goals', '--brief', '.lazytrae/evidence/brief.md', '--goal-id', 'goal-1', '--criterion-id', 'crit-1'], { cwd: loop }).status, 0);
  assert.equal(runCli(['loop', 'complete-goals'], { cwd: loop }).status, 0);
  assert.match(runCli(['loop', 'record-evidence', 'goal-1', 'crit-1', outside], { cwd: loop }).stderr, /repo-relative/);
  assert.match(runCli(['loop', 'checkpoint', '--quality-gate-json', outside], { cwd: loop }).stderr, /repo-relative/);

  fs.rmSync(outside, { force: true });
});

test('persistent CLI and hook writers reject a symlinked .lazytrae directory', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-symlink-writers-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-symlink-target-'));
  const snapshots = new Map();
  try {
    fs.mkdirSync(path.join(fixture, '.git'));
    fs.cpSync(path.join(__dirname, '..', '..', '..', '.trae'), path.join(fixture, '.trae'), { recursive: true });
    fs.cpSync(path.join(__dirname, '..', '..', '..', 'packages'), path.join(fixture, 'packages'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'brief.md'), 'brief\n');
    fs.mkdirSync(path.join(outside, 'state'), { recursive: true });
    fs.mkdirSync(path.join(outside, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(outside, 'state', 'active-loop.json'), JSON.stringify({ loop_state: 'idle', goals: [] }));
    fs.writeFileSync(path.join(outside, 'state', 'sessions.json'), JSON.stringify({ current_session_id: null, sessions: {} }));
    fs.writeFileSync(path.join(outside, 'logs', 'loop-events.ndjson'), 'outside log sentinel\n');
    fs.writeFileSync(path.join(outside, 'evidence-sentinel.md'), 'outside evidence sentinel\n');
    for (const relative of ['state/active-loop.json', 'state/sessions.json', 'logs/loop-events.ndjson', 'evidence-sentinel.md']) {
      snapshots.set(relative, fs.readFileSync(path.join(outside, relative), 'utf-8'));
    }
    fs.symlinkSync(outside, path.join(fixture, '.lazytrae'));

    const init = runCli(['init'], { cwd: fixture });
    const loop = runCli(['loop', 'create-goals', '--brief', 'brief.md', '--goal-id', 'g', '--criterion-id', 'c'], { cwd: fixture });
    const hook = runCli(['hook', 'user-prompt-submit'], {
      cwd: fixture,
      input: JSON.stringify({ prompt: 'context compacted' }),
    });
    const directHook = spawnSync('bash', [path.join(fixture, '.trae', 'hooks', 'context-recovery.sh'), 'mark'], {
      cwd: fixture,
      encoding: 'utf-8',
    });

    assert.equal(init.status, 1, `init unexpectedly succeeded: ${init.stdout}${init.stderr}`);
    assert.equal(loop.status, 1, `loop unexpectedly succeeded: ${loop.stdout}${loop.stderr}`);
    assert.equal(hook.status, 0, `hook should remain advisory: ${hook.stdout}${hook.stderr}`);
    assert.match(hook.stderr, /outside the repo root/);
    assert.equal(directHook.status, 1, `direct hook unexpectedly succeeded: ${directHook.stdout}${directHook.stderr}`);
    assert.match(directHook.stderr, /(?:outside|inside).*repo root/);
    for (const [relative, before] of snapshots) {
      assert.equal(fs.readFileSync(path.join(outside, relative), 'utf-8'), before, `${relative} was written outside the fixture`);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('init and sync reject a symlinked .trae directory without touching its target', () => {
  const fixture = makeFixture('lazytrae-trae-symlink-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-trae-target-'));
  const sentinel = path.join(outside, 'sentinel.txt');
  try {
    fs.rmSync(path.join(fixture, '.trae'), { recursive: true, force: true });
    fs.writeFileSync(sentinel, 'outside .trae sentinel\n');
    fs.symlinkSync(outside, path.join(fixture, '.trae'));

    for (const command of ['init', 'sync']) {
      const result = runCli([command], { cwd: fixture });
      assert.equal(result.status, 1, `${command} unexpectedly succeeded: ${result.stdout}${result.stderr}`);
      assert.match(result.stderr, /outside the repo root/);
      assert.equal(fs.readFileSync(sentinel, 'utf-8'), 'outside .trae sentinel\n');
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('init rejects a dangling .lazytrae config symlink before it can create its target', () => {
  const fixture = makeFixture('lazytrae-dangling-config-');
  const outside = path.join(os.tmpdir(), `${path.basename(fixture)}-outside-config.json`);
  const configPath = path.join(fixture, '.lazytrae', 'config.json');
  try {
    fs.rmSync(configPath, { force: true });
    fs.symlinkSync(outside, configPath);

    const result = runCli(['init'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /symlink/);
    assert.equal(fs.existsSync(outside), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});

test('sync rejects a dangling .trae mcp template target before it can create its target', () => {
  const fixture = makeFixture('lazytrae-dangling-mcp-');
  const outside = path.join(os.tmpdir(), `${path.basename(fixture)}-outside-mcp.json`);
  const mcpPath = path.join(fixture, '.trae', 'mcp.json');
  try {
    fs.rmSync(mcpPath, { force: true });
    fs.symlinkSync(outside, mcpPath);

    const result = runCli(['sync'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /symlink/);
    assert.equal(fs.existsSync(outside), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});

test('loop JSON writes reject a predictable dangling atomic temporary symlink', () => {
  const fixture = makeLoopFixture('lazytrae-loop-temp-symlink-');
  const statePath = path.join(fixture, '.lazytrae', 'state', 'active-loop.json');
  const tempPath = `${statePath}.${process.pid}.tmp`;
  const outside = path.join(os.tmpdir(), `${path.basename(fixture)}-outside-loop.json`);
  try {
    fs.writeFileSync(outside, 'outside loop sentinel\n');
    fs.symlinkSync(outside, tempPath);

    assert.throws(() => saveLoop(fixture, defaultLoop()));

    assert.equal(fs.readFileSync(outside, 'utf-8'), 'outside loop sentinel\n');
    assert.equal(fs.lstatSync(statePath).isSymbolicLink(), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});

test('public MCP state writes reject a predictable atomic temporary symlink without touching its target', () => {
  const fixture = makeCompletionFixture('lazytrae-mcp-temp-symlink-', false);
  const statePath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const frozenPid = 4242;
  const frozenNow = 1700000000000;
  const tempPath = `${statePath}.${frozenPid}.${frozenNow}.tmp`;
  const outside = path.join(os.tmpdir(), `${path.basename(fixture)}-outside-mcp.json`);
  const sentinel = 'outside MCP sentinel\n';
  const pidDescriptor = Object.getOwnPropertyDescriptor(process, 'pid');
  const originalNow = Date.now;
  const initialState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  try {
    fs.writeFileSync(outside, sentinel);
    fs.symlinkSync(outside, tempPath);
    Object.defineProperty(process, 'pid', { ...pidDescriptor, value: frozenPid });
    Date.now = () => frozenNow;

    let outcome;
    try {
      outcome = { kind: 'success', value: HANDLERS['lazytrae.add_blocker'](fixture, { reason: 'symlink attack' }) };
    } catch (error) {
      outcome = { kind: 'error', value: error };
    }

    assert.equal(fs.readFileSync(outside, 'utf-8'), sentinel);
    assert.equal(outcome.kind, 'error');
    assert.match(outcome.value.message, /symlink|EEXIST|exist/);

    fs.unlinkSync(tempPath);
    const ordinary = HANDLERS['lazytrae.add_blocker'](fixture, { reason: 'ordinary write' });
    assert.equal(ordinary.blocker_added, true);
    assert.equal(ordinary.blocker.reason, 'ordinary write');
    assert.equal(fs.lstatSync(statePath).isSymbolicLink(), false);
    assert.notEqual(JSON.parse(fs.readFileSync(statePath, 'utf-8')).updated_at, initialState.updated_at);
  } finally {
    Date.now = originalNow;
    Object.defineProperty(process, 'pid', pidDescriptor);
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});

test('sync rejects an existing hard-linked template target without changing its peer', () => {
  const fixture = makeFixture('lazytrae-hard-linked-mcp-');
  const outside = path.join(os.tmpdir(), `${path.basename(fixture)}-outside-mcp.json`);
  const mcpPath = path.join(fixture, '.trae', 'mcp.json');
  try {
    fs.writeFileSync(outside, 'outside hard-link sentinel\n');
    fs.rmSync(mcpPath, { force: true });
    fs.linkSync(outside, mcpPath);

    const result = runCli(['sync'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /hard-linked/);
    assert.equal(fs.readFileSync(outside, 'utf-8'), 'outside hard-link sentinel\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});

test('doctor and default verify reject completed task evidence outside the repo or blank', () => {
  const fixture = makeCompletionFixture('lazytrae-doctor-evidence-boundary-', true);
  const boulderPath = path.join(fixture, '.lazytrae', 'state', 'boulder.json');
  const outside = path.join(path.dirname(fixture), `${path.basename(fixture)}-outside.md`);
  try {
    fs.writeFileSync(outside, 'outside proof\n');
    const boulder = JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
    const task = boulder.works['work-1'].tasks[0];

    task.evidence_paths = ['../' + path.basename(outside)];
    fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');
    const escapedDoctor = runCli(['doctor'], { cwd: fixture });
    const escapedVerify = runCli(['verify'], { cwd: fixture });
    assert.equal(escapedDoctor.status, 1, escapedDoctor.stdout);
    assert.equal(escapedVerify.status, 1, escapedVerify.stdout);
    assert.match(escapedDoctor.stdout, /path must stay inside the repo root/);

    task.evidence_paths = [''];
    fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');
    const blankDoctor = runCli(['doctor'], { cwd: fixture });
    assert.equal(blankDoctor.status, 1, blankDoctor.stdout);
    assert.match(blankDoctor.stdout, /path must be a non-empty string/);

    task.evidence_paths = ['.lazytrae/evidence/task-1.md'];
    fs.writeFileSync(boulderPath, JSON.stringify(boulder, null, 2) + '\n');
    const inRootDoctor = runCli(['doctor'], { cwd: fixture });
    assert.equal(inRootDoctor.status, 0, inRootDoctor.stdout);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});
