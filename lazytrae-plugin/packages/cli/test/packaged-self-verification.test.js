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

test('packaged handoff JSON redacts every caller-controlled free-text field', () => {
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
          active_plan: 'token=plan-secret',
          tasks: [{
            id: 'task-1',
            status: 'in_progress',
            description: 'Authorization: Bearer bearer-secret',
            criteria: ['api_key=criteria-secret'],
            commands: ['API_KEY=environment-secret node --test'],
            authority: '-----BEGIN PRIVATE KEY-----\nprivate-key-secret\n-----END PRIVATE KEY-----',
          }],
          blockers: [{ task_id: 'task-1', reason: 'client_secret=blocker-secret' }],
        },
      },
    }));

    // When: the packaged public CLI serializes the handoff report.
    const result = runCli(['--root', project, 'handoff', '--json']);

    // Then: structural report data remains, while none of the source secrets cross stdout.
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.currentState.currentTask.id, 'task-1');
    assert.match(result.stdout, /\[REDACTED\]/);
    assert.doesNotMatch(result.stdout, /plan-secret|bearer-secret|criteria-secret|environment-secret|private-key-secret|blocker-secret/);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
