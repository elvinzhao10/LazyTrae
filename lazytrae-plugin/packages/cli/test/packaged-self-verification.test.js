const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(PACKAGE_ROOT, 'bin', 'lazytrae.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: options.cwd || PACKAGE_ROOT,
    encoding: 'utf8',
  });
}

test('package self-verification uses only the extracted CLI runtime', () => {
  // Given: an npm package root with no source-monorepo sibling.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-packaged-self-test-'));
  fs.mkdirSync(path.join(project, '.git'));
  try {
    // When: the shipped CLI is used for its help and an IDE project initialization.
    const runtime = fs.realpathSync(CLI);
    const relativeRuntime = path.relative(PACKAGE_ROOT, runtime);
    const help = runCli(['--help']);
    const init = runCli(['--root', project, 'init', '--host', 'ide']);
    const doctor = runCli(['--root', project, 'doctor']);

    // Then: every executed runtime path is package-local and the package works without checkout files.
    assert.equal(relativeRuntime.startsWith(`..${path.sep}`) || path.isAbsolute(relativeRuntime), false);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /lazytrae/);
    assert.equal(init.status, 0, init.stderr);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.equal(fs.existsSync(path.join(project, '.trae', 'mcp.json')), true);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('packaged handoff JSON and Markdown redact every caller-controlled free-text field', () => {
  // Given: initialized package state containing representative secret forms in every handoff projection.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-packaged-handoff-redaction-'));
  fs.mkdirSync(path.join(project, '.git'));
  try {
    assert.equal(runCli(['--root', project, 'init', '--host', 'ide']).status, 0);
    const stateRoot = path.join(project, '.lazytrae', 'state');
    fs.writeFileSync(path.join(stateRoot, 'boulder.json'), JSON.stringify({
      active_work_id: 'work-1',
      works: {
        'work-1': {
          work_id: 'work-1',
          objective: 'password=objective-secret',
          active_plan: 'token=plan-secret',
          plan_revision: `sha256:${'a'.repeat(64)}`,
          tasks: [{
            id: 'task-1',
            status: 'in_progress',
            description: 'Authorization: Bearer bearer-secret',
            criteria: ['api_key=criteria-secret'],
            commands: ['API_KEY=environment-secret node --test'],
            authority: '-----BEGIN PRIVATE KEY-----\nprivate-key-secret\n-----END PRIVATE KEY-----',
            'password=key-name-secret': 'unknown task metadata',
          }],
          blockers: [{ task_id: 'task-1', reason: 'client_secret=blocker-secret' }],
        },
      },
    }));
    fs.writeFileSync(path.join(stateRoot, 'active-loop.json'), JSON.stringify({
      run_id: 'run-1',
      adaptive: {
        requestDigest: `sha256:${'b'.repeat(64)}`,
        revisionFingerprint: { status: 'available', digest: `sha256:${'c'.repeat(64)}` },
        scopeFingerprint: `sha256:${'d'.repeat(64)}`,
      },
    }));
    fs.writeFileSync(path.join(stateRoot, 'sessions.json'), JSON.stringify({ current_session_id: 'session-1' }));

    // When: both packaged public renderers serialize the handoff report.
    const json = runCli(['--root', project, 'handoff', '--json']);
    const markdown = runCli(['--root', project, 'handoff']);

    // Then: structural report data remains, while none of the source secrets cross either stdout.
    assert.equal(json.status, 0, json.stderr);
    assert.equal(markdown.status, 0, markdown.stderr);
    const report = JSON.parse(json.stdout);
    assert.equal(report.currentState.currentTask.id, 'task-1');
    assert.deepEqual(Object.keys(report.currentState.currentTask), ['id', 'description', 'status']);
    assert.match(markdown.stdout, /task-1/);
    assert.match(markdown.stdout, /next_action/);
    for (const output of [json.stdout, markdown.stdout]) {
      assert.match(output, /\[REDACTED\]/);
      assert.doesNotMatch(output, /objective-secret|plan-secret|bearer-secret|criteria-secret|environment-secret|private-key-secret|blocker-secret|key-name-secret/);
    }
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
