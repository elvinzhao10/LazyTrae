'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const DASHBOARD = require('../src/commands/dashboard');
const SERVICE = require('../src/lib/dashboard-service-lifecycle');
const NATIVE_STATE = require('../src/lib/dashboard-state');
const LOOP_STORE = require('../src/lib/loop-store');
const PROJECT = require('../src/lib/project-state');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-http-')));
  const loop = LOOP_STORE.defaultLoop();
  loop.run_id = 'run-project-http';
  loop.loop_state = 'active';
  loop.goals = [{ id: 'goal-1', title: 'HTTP route fixture', objective: 'Exercise project routes', status: 'pending',
    priority: 0, depends_on: [], successCriteria: [{ id: 'goal-1-c1', scenario: 'Routes are bound', essential: true }] }];
  LOOP_STORE.saveLoop(root, loop);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'plan.md'), '# HTTP plan\n\nRegistered source bytes.\n');
  fs.writeFileSync(path.join(root, 'docs', 'unregistered.md'), 'FOREIGN-BYTES-MUST-NOT-CROSS\n');
  fs.writeFileSync(path.join(root, 'evidence', 'native-report.md'),
    '# Native report\n\nTrae-owned registered artifact.\n<script>FOREIGN-PREVIEW-SCRIPT</script>\n');
  return root;
}

function request(url, route, options = {}) {
  const parsed = new URL(url);
  const payload = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body));
  return new Promise((resolve, reject) => {
    const call = http.request({ hostname: parsed.hostname, port: parsed.port, method: options.method ?? 'GET', path: route,
      headers: { ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(payload ? { origin: url, 'content-type': 'application/json', 'content-length': payload.length } : {}),
        ...(options.headers ?? {}) } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: response.statusCode, text, value: text ? JSON.parse(text) : null });
      });
    });
    call.on('error', reject);
    call.setTimeout(10000, () => call.destroy(new Error('HTTP_TIMEOUT')));
    if (payload) call.end(payload); else call.end();
  });
}

test('native project HTTP routes preserve Trae identity, source boundaries and command semantics', async t => {
  const root = fixture();
  let live;
  try {
    live = await DASHBOARD.invoke(root, ['start']);
    const credential = fs.readFileSync(live.credential_file, 'utf8');
    const session = await request(live.url, '/api/session', { method: 'POST', body: {},
      headers: { 'x-dashboard-bootstrap': credential } });
    assert.equal(session.status, 200);
    const token = session.value.token;
    const projectId = NATIVE_STATE.projectId(root);

    await t.test('package health is authenticated and does not initialize a project', async () => {
      assert.equal((await request(live.url, '/api/project/health')).status, 401);
      const response = await request(live.url, '/api/project/health', { token });
      assert.equal(response.status, 200, response.text);
      assert.equal(response.value.schema, 'lazybuddy/plugin-health@1');
      assert.equal(response.value.sections[0].items[0].observed, 'LazyTrae');
      assert.equal(response.value.sections.find(section => section.id === 'host').items[0].status, 'unavailable');
      assert.equal(fs.existsSync(path.join(root, PROJECT.STATE_PATH)), false);
      assert.ok(!response.text.includes(credential) && !response.text.includes(token));
    });

    await t.test('read before explicit init is authenticated, inert and not found', async () => {
      const statePath = path.join(root, PROJECT.STATE_PATH);
      const registryPath = path.join(root, PROJECT.REGISTRY_PATH);
      assert.equal(fs.existsSync(statePath), false);
      assert.equal(fs.existsSync(registryPath), false);
      assert.equal((await request(live.url, '/api/project')).status, 401);
      const response = await request(live.url, '/api/project', { token });
      assert.equal(response.status, 404);
      assert.equal(response.value.code, 'PROJECT_NOT_INITIALIZED');
      assert.equal(fs.existsSync(statePath), false);
      assert.equal(fs.existsSync(registryPath), false);
    });

    await t.test('initialized read is bound to Trae native project and run identities', async () => {
      const initialized = await PROJECT.init(root, { projectId });
      assert.equal(initialized.project_id, projectId);
      const response = await request(live.url, '/api/project', { token });
      assert.equal(response.status, 200);
      assert.equal(response.value.project.project_id, projectId);
      assert.ok(Array.isArray(response.value.project.plans), 'HTTP project is the shared snapshot, not the native helper envelope');
      assert.equal(response.value.native_loop.project_id, projectId);
      assert.equal(response.value.native_loop.run_id, 'run-project-http');
      assert.equal((await request(live.url, '/api/project/telemetry')).status, 401);
      const telemetry = await request(live.url, '/api/project/telemetry', { token });
      assert.equal(telemetry.status, 200, telemetry.text);
      assert.equal(telemetry.value.schema, 'lazyseries/runtime-telemetry@1');
      assert.equal(telemetry.value.project_id, projectId);
      assert.equal(telemetry.value.usage, null);
      const uiRoot = path.resolve(__dirname, '../shared/dashboard/ui');
      const { createLiveProjectAdapter } = await import(pathToFileURL(path.join(uiRoot, 'live-project-adapter.mjs')).href);
      const { overviewFixture } = await import(pathToFileURL(path.join(uiRoot, 'overview-fixture.mjs')).href);
      const adapter = createLiveProjectAdapter({ connection: {
        project: async () => response.value,
        projectSource: async () => { throw new Error('not used'); },
      } });
      const consumed = await adapter.read();
      assert.equal(consumed.project_id, projectId);
      const overview = overviewFixture(adapter.bundle());
      assert.equal(overview.projection.project_id, projectId);
      assert.equal(overview.docId, `overview:${projectId}`);
    });

    const source = '# HTTP plan\n\nRegistered source bytes.\n';
    const register = { schema_version: 1, command_id: 'http:register', project_id: projectId,
      expected_revision: 0, operation: 'register_source',
      payload: { id: 'source:group/plan', path: 'docs/plan.md', role: 'plan' } };

    await t.test('command route assigns the session actor and replays byte-equivalent receipt data', async () => {
      const accepted = await request(live.url, '/api/project/commands', { method: 'POST', token, body: register });
      assert.equal(accepted.status, 200);
      assert.equal(accepted.value.receipt.status, 'saved');
      assert.match(accepted.value.receipt.actor, /^dashboard:[a-f0-9]{24}$/);
      assert.equal(accepted.value.snapshot.project_id, projectId);
      assert.ok(Array.isArray(accepted.value.snapshot.sources));
      const uiRoot = path.resolve(__dirname, '../shared/dashboard/ui');
      const { createLiveProjectAdapter, overviewBundle } = await import(pathToFileURL(path.join(uiRoot, 'live-project-adapter.mjs')).href);
      const { overviewFixture } = await import(pathToFileURL(path.join(uiRoot, 'overview-fixture.mjs')).href);
      const adapter = createLiveProjectAdapter({ connection: {
        project: async () => ({ project: accepted.value.snapshot }),
        projectSource: async () => { throw new Error('not used'); },
        projectCommand: async () => accepted.value,
      } });
      const editorOutcome = await adapter.command(register);
      const commandOverview = overviewFixture(overviewBundle(editorOutcome.snapshot));
      assert.equal(commandOverview.projection.project_id, projectId,
        'the real HTTP command response exposes the snapshot shape consumed after an editor save');
      const replay = await request(live.url, '/api/project/commands', { method: 'POST', token, body: register });
      assert.equal(replay.status, 200);
      assert.equal(JSON.stringify(replay.value.receipt), JSON.stringify(accepted.value.receipt));
      const stale = { ...register, command_id: 'http:stale' };
      const conflict = await request(live.url, '/api/project/commands', { method: 'POST', token, body: stale });
      assert.equal(conflict.status, 409);
      assert.equal(conflict.value.receipt.reason, 'REVISION_CONFLICT');
    });

    await t.test('encoded source identity resolves only its registered Markdown file', async () => {
      const response = await request(live.url, '/api/project/sources/source:group%2Fplan', { token });
      assert.equal(response.status, 200);
      assert.deepEqual(response.value, { source_id: 'source:group/plan', path: 'docs/plan.md', sha256: sha256(source), content: source });
      assert.equal((await request(live.url, '/api/project/sources/source:group/plan', { token })).status, 404);
      const unregistered = await request(live.url, '/api/project/sources/source:unregistered', { token });
      assert.equal(unregistered.status, 404);
      assert.equal(unregistered.value.code, 'UNKNOWN_SOURCE');
      assert.equal(unregistered.text.includes('FOREIGN-BYTES-MUST-NOT-CROSS'), false);
      const encodedNonSource = await request(live.url, '/api/project%2Fgit', { token });
      assert.equal(encodedNonSource.status, 422);
      assert.equal(encodedNonSource.value.code, 'INVALID_ROUTE');
    });

    await t.test('transition assessment uses the accepted plan without changing it', async () => {
      const command = { schema_version: 1, command_id: 'http:plan', project_id: projectId,
        expected_revision: 1, operation: 'register_plan', payload: { id: 'plan:http',
          source: { source_id: 'source:group/plan', sha256: sha256(source), anchor_id: 'document' },
          declared_lifecycle: 'planned', baseline_refs: [] } };
      assert.equal((await request(live.url, '/api/project/commands', { method: 'POST', token, body: command })).status, 200);
      const assessment = await request(live.url, '/api/project/plan-transition-assessment', { method: 'POST', token,
        body: { plan_id: 'plan:http', to_lifecycle: 'active', payload: {} } });
      assert.equal(assessment.status, 200);
      assert.equal(assessment.value.allowed, false);
      assert.ok(assessment.value.reasons.some(reason => reason.code === 'NATIVE_RUN_REQUIRED'));
      const project = await request(live.url, '/api/project', { token });
      assert.equal(project.value.project.plans[0].declared_lifecycle, 'planned');
    });

    await t.test('architecture, Git and evidence details use recorded project facts without protected scans', async () => {
      const artifact = '# Native report\n\nTrae-owned registered artifact.\n<script>FOREIGN-PREVIEW-SCRIPT</script>\n';
      const command = { schema_version: 1, command_id: 'http:artifact', project_id: projectId,
        expected_revision: 2, operation: 'artifact.register', payload: { id: 'artifact:http-report',
          type: 'design_note', producer: 'native:http-test', path: 'evidence/native-report.md', sha256: sha256(artifact) } };
      assert.equal((await request(live.url, '/api/project/commands', { method: 'POST', token, body: command })).status, 200);
      fs.writeFileSync(path.join(root, '.lazytrae', 'dashboard', 'route-canary.txt'), 'TRAE-DASHBOARD-CANARY');
      fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'route-canary.txt'), 'TRAE-STATE-CANARY');
      fs.mkdirSync(path.join(root, '.lazybuddy', 'runs', 'foreign', 'evidence'), { recursive: true });
      fs.writeFileSync(path.join(root, '.lazybuddy', 'runs', 'foreign', 'evidence', 'route-canary.txt'), 'BUDDY-FOREIGN-CANARY');
      const architecture = await request(live.url, '/api/project/architecture', { token });
      assert.equal(architecture.status, 200);
      assert.equal(architecture.value.docId, `architecture:${projectId}`);
      const git = await request(live.url, '/api/project/git', { token });
      assert.equal(git.status, 200);
      assert.ok(['observed', 'unavailable'].includes(git.value.git.status));
      const evidence = await request(live.url, '/api/project/evidence', { token });
      assert.equal(evidence.status, 200);
      assert.equal(evidence.value.docId, `evidence:${projectId}`);
      assert.equal(evidence.value.scan.runs_indexed, 0, 'no unsupported Trae loop parser is fabricated');
      assert.ok(evidence.value.entries.some(entry => entry.registered?.id === 'artifact:http-report'
        && entry.path === 'evidence/native-report.md' && entry.status === 'available'));
      const previewEntry = evidence.value.entries.find(entry => entry.registered?.id === 'artifact:http-report');
      assert.equal((await request(live.url, '/api/project/evidence/preview', { method: 'POST', body: { artifact_id: previewEntry.id } })).status, 401);
      const malformed = await request(live.url, '/api/project/evidence/preview', { method: 'POST', token, body: {} });
      assert.equal(malformed.status, 422); assert.equal(malformed.value.code, 'INVALID_ARTIFACT_ID');
      const unknown = await request(live.url, '/api/project/evidence/preview', { method: 'POST', token,
        body: { artifact_id: 'artifact:unknown' } });
      assert.equal(unknown.status, 404); assert.equal(unknown.value.code, 'UNKNOWN_ARTIFACT');
      const preview = await request(live.url, '/api/project/evidence/preview', { method: 'POST', token,
        body: { artifact_id: previewEntry.id } });
      assert.equal(preview.status, 200);
      assert.equal(preview.value.artifact_id, previewEntry.id);
      assert.equal(preview.value.kind, 'markdown');
      assert.equal(preview.value.available, true);
      assert.ok(preview.value.blocks.some(block => block.type === 'heading' && block.text === 'Native report'));
      assert.equal(preview.text.includes('FOREIGN-PREVIEW-SCRIPT'), false);
      assert.ok(preview.value.sanitization.removed_script_blocks >= 1);
      fs.appendFileSync(path.join(root, 'evidence', 'native-report.md'), '\nchanged after registration\n');
      const changed = await request(live.url, '/api/project/evidence/preview', { method: 'POST', token,
        body: { artifact_id: previewEntry.id } });
      assert.equal(changed.status, 200);
      assert.equal(changed.value.available, false);
      assert.equal(changed.value.reason, 'artifact_redacted');
      fs.unlinkSync(path.join(root, 'evidence', 'native-report.md'));
      fs.symlinkSync('/etc/passwd', path.join(root, 'evidence', 'native-report.md'));
      const linked = await request(live.url, '/api/project/evidence/preview', { method: 'POST', token,
        body: { artifact_id: previewEntry.id } });
      assert.equal(linked.status, 200);
      assert.equal(linked.value.available, false);
      assert.equal(linked.value.reason, 'artifact_inaccessible');
      assert.equal(linked.text.includes('root:'), false);
      assert.equal(evidence.text.includes('TRAE-DASHBOARD-CANARY'), false);
      assert.equal(evidence.text.includes('TRAE-STATE-CANARY'), false);
      assert.equal(evidence.text.includes('BUDDY-FOREIGN-CANARY'), false);
      assert.equal(evidence.value.entries.some(entry => /^\.lazy(?:trae\/(?:dashboard|state)|buddy)\//.test(entry.path)), false);
    });

    await t.test('foreign command and unsafe registered-source replacement fail closed', async () => {
      const foreign = await request(live.url, '/api/project/commands', { method: 'POST', token,
        body: { ...register, command_id: 'http:foreign', project_id: `trae:${'f'.repeat(64)}` } });
      assert.equal(foreign.status, 409);
      assert.equal(foreign.value.code, 'COMMAND_BINDING_MISMATCH');
      fs.unlinkSync(path.join(root, 'docs', 'plan.md'));
      fs.symlinkSync('/etc/passwd', path.join(root, 'docs', 'plan.md'));
      const refused = await request(live.url, '/api/project/sources/source:group%2Fplan', { token });
      assert.equal(refused.status, 422);
      assert.equal(refused.value.code, 'SOURCE_UNAVAILABLE');
      assert.equal(refused.text.includes('root:'), false);
    });
  } finally {
    if (live) await DASHBOARD.invoke(root, ['stop', '--port', String(live.identity.port)]);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('initialized project starts its signed dashboard before a native loop exists', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-only-http-')));
  let live;
  try {
    const projectId = NATIVE_STATE.projectId(root);
    const initialized = await PROJECT.init(root, { projectId });
    assert.equal(initialized.project_id, projectId);
    live = await DASHBOARD.invoke(root, ['start']);
    assert.equal(live.identity.runId, null);
    const status = await DASHBOARD.invoke(root, ['status', '--port', String(live.identity.port)]);
    assert.equal(status.status, 'running');
    assert.equal(status.identity.runId, null);
    const credential = fs.readFileSync(live.credential_file, 'utf8');
    const session = await request(live.url, '/api/session', { method: 'POST', body: {},
      headers: { 'x-dashboard-bootstrap': credential } });
    const token = session.value.token;
    const project = await request(live.url, '/api/project', { token });
    assert.equal(project.status, 200);
    assert.equal(project.value.project.project_id, projectId);
    const run = await request(live.url, '/api/snapshot', { token });
    assert.equal(run.status, 409);
    assert.equal(run.value.code, 'RUN_NOT_BOUND');
    const command = await request(live.url, '/api/commands', { method: 'POST', token, body: {} });
    assert.equal(command.status, 409);
    assert.equal(command.value.code, 'RUN_NOT_BOUND');
    const proof = await request(live.url, `/api/evidence/${'a'.repeat(64)}`, { token });
    assert.equal(proof.status, 409);
    assert.equal(proof.value.code, 'RUN_NOT_BOUND');
  } finally {
    if (live) await DASHBOARD.invoke(root, ['stop', '--port', String(live.identity.port)]);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('project-only and a native run named project-only retain separate signed service identities', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-binding-')));
  const projectId = NATIVE_STATE.projectId(root);
  const assetRoot = path.resolve(__dirname, '../shared/dashboard/ui');
  const projectOptions = { projectRoot: root, projectId, runId: null, assetRoot };
  const runOptions = { projectRoot: root, projectId, runId: 'project-only', assetRoot };
  let projectLive; let runLive;
  try {
    await PROJECT.init(root, { projectId });
    projectLive = await SERVICE.lifecycle('start', projectOptions);
    const loop = LOOP_STORE.defaultLoop();
    loop.run_id = 'project-only';
    loop.loop_state = 'active';
    loop.goals = [{ id: 'goal-1', title: 'Namespace regression', objective: 'Keep receipt identities separate',
      status: 'pending', priority: 0, depends_on: [], successCriteria: [] }];
    LOOP_STORE.saveLoop(root, loop);
    runLive = await SERVICE.lifecycle('start', runOptions);
    assert.notEqual(projectLive.credential_file, runLive.credential_file);
    assert.notEqual(projectLive.identity.instance, runLive.identity.instance);
    assert.notEqual(projectLive.identity.port, runLive.identity.port);
    assert.equal(projectLive.identity.runId, null);
    assert.equal(runLive.identity.runId, 'project-only');
  } finally {
    if (runLive) await SERVICE.lifecycle('stop', { ...runOptions, port: runLive.identity.port });
    if (projectLive) await SERVICE.lifecycle('stop', { ...projectOptions, port: projectLive.identity.port });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('project-only dashboard start refuses to initialize an empty repository', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-only-empty-')));
  try {
    await assert.rejects(DASHBOARD.invoke(root, ['start']), error => error.code === 'PROJECT_NOT_INITIALIZED');
    assert.equal(fs.existsSync(path.join(root, PROJECT.STATE_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, PROJECT.REGISTRY_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, '.lazytrae', 'dashboard')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('run-bound service refuses a replacement native loop', async () => {
  const root = fixture();
  const projectId = NATIVE_STATE.projectId(root);
  const options = { projectRoot: root, projectId, runId: 'run-project-http', assetRoot: path.resolve(__dirname, '../shared/dashboard/ui') };
  let live; let unexpected;
  try {
    await PROJECT.init(root, { projectId });
    await assert.rejects(async () => { unexpected = await SERVICE.lifecycle('start', { ...options, runId: 'other-run' }); },
      error => error.code === 'RUN_BINDING_MISMATCH');
    live = await SERVICE.lifecycle('start', options);
    const credential = fs.readFileSync(live.credential_file, 'utf8');
    const session = await request(live.url, '/api/session', { method: 'POST', body: {}, headers: { 'x-dashboard-bootstrap': credential } });
    const token = session.value.token;
    assert.equal((await request(live.url, '/api/snapshot', { token })).value.snapshot.run_id, options.runId);
    const loopPath = path.join(root, '.lazytrae/state/active-loop.json');
    const loop = JSON.parse(fs.readFileSync(loopPath, 'utf8'));
    loop.run_id = 'replacement-run';
    fs.writeFileSync(loopPath, JSON.stringify(loop));
    for (const route of ['/api/snapshot', '/api/updates', `/api/evidence/${'a'.repeat(64)}`]) {
      const response = await request(live.url, route, { token });
      assert.equal(response.status, 409, route);
      assert.equal(response.value.code, 'RUN_BINDING_MISMATCH', route);
    }
    const telemetry = await request(live.url, '/api/project/telemetry', { token });
    assert.equal(telemetry.status, 200);
    assert.equal(telemetry.value.run_id, null);
    assert.equal(telemetry.value.monitor.available, false);
    assert.ok(telemetry.value.problems.some(problem => problem.detail === 'RUN_BINDING_MISMATCH'));
  } finally {
    if (live) await SERVICE.lifecycle('stop', { ...options, port: live.identity.port });
    if (unexpected) await SERVICE.lifecycle('stop', { ...options, runId: 'other-run', port: unexpected.identity.port });
    fs.rmSync(root, { recursive: true, force: true });
  }
});
