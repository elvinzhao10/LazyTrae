'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY = path.join(CLI_ROOT, 'src', 'index.js');
const MCP_ROOT = path.resolve(CLI_ROOT, '..', 'mcp');
const VENDORED_PROJECT = path.join(CLI_ROOT, 'shared', 'project');
const VENDOR_SIDECAR = path.join(CLI_ROOT, 'shared', 'project.vendor.json');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const resources = { roots: [], packs: [], preservedPackedDependency: null, packedDependencyInstalled: false };
process.on('exit', () => {
  process.stdout.write(`PROJECT_ADAPTER_CLEANUP ${JSON.stringify(resources)}\n`);
});

function tempRoot(prefix) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `lazytrae-project-${prefix}-`)));
  resources.roots.push(root);
  return root;
}
function dispose(root) {
  fs.rmSync(root, { recursive: true, force: true });
  const index = resources.roots.indexOf(root);
  if (index !== -1) resources.roots.splice(index, 1);
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function inventory(root, prefix = '') {
  const output = {};
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(root, relative);
    if (entry.isDirectory()) output[relative] = { type: 'directory' };
    else output[relative] = { type: 'file', sha256: sha256(fs.readFileSync(absolute)) };
    if (entry.isDirectory()) Object.assign(output, inventory(root, relative));
  }
  return output;
}
function cli(root, args, options = {}) {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: root, encoding: 'utf8', timeout: 90000,
    input: options.input, maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
function projectCommand(root, command, actor = 'local:adapter-test') {
  return cli(root, ['project', 'command', '--actor', actor], { input: JSON.stringify(command) });
}
function projectIdOf(root) {
  return `trae:${sha256(fs.realpathSync(root))}`;
}
function commandEnvelope(root, commandId, revision, operation, payload) {
  return { schema_version: 1, command_id: commandId, project_id: projectIdOf(root),
    expected_revision: revision, operation, payload };
}
function seedNativeLoop(root, runId = 'run-project-adapter') {
  const goal = {
    id: 'goal-1', title: 'Search goal', objective: 'Deliver offline search', status: 'pending',
    priority: 0, depends_on: [],
    successCriteria: [{ id: 'goal-1-c1', scenario: 'Search works offline', essential: true }],
  };
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.lazytrae', 'loop', runId), { recursive: true });
  const loop = { version: 1, run_id: runId, loop_state: 'active', revision: 1, goals: [goal],
    brief_path: `.lazytrae/loop/${runId}/brief.md`, goals_path: `.lazytrae/loop/${runId}/goals.json`,
    ledger_path: `.lazytrae/loop/${runId}/ledger.jsonl` };
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'), `${JSON.stringify(loop, null, 2)}\n`);
  fs.writeFileSync(path.join(root, '.lazytrae', 'loop', runId, 'goals.json'), `${JSON.stringify([goal], null, 2)}\n`);
  return loop;
}
const REQUIREMENTS = '# Requirements\n\n## feature:notes — Personal notes\n\nOriginal source content.\n\n## requirement:offline — Work without a network\n\nAll primary workflows run offline.\n';
const PLAN_DOCUMENT = '# Search plan\n\nDeliver search over the stored notes.\n';

function registerProjectFixture(root) {
  fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'requirements.md'), REQUIREMENTS);
  fs.writeFileSync(path.join(root, 'docs', 'plans', 'search.md'), PLAN_DOCUMENT);
}

// The full accepted round trip every later test builds on. Returns the
// command results for assertions and the final revision.
function driveAcceptedRoundTrip(root) {
  const results = {};
  const requirementsHash = sha256(REQUIREMENTS);
  const planHash = sha256(PLAN_DOCUMENT);
  const steps = [
    ['cmd:register-requirements', 0, 'register_source',
      { id: 'source:requirements', path: 'docs/requirements.md', role: 'requirements' }],
    ['cmd:record-baseline', 1, 'record_baseline_items',
      { items: [
        { id: 'feature:notes', kind: 'feature', state: 'accepted',
          source: { source_id: 'source:requirements', sha256: requirementsHash, anchor_id: 'heading:feature:notes — Personal notes' } },
        { id: 'requirement:offline', kind: 'requirement', state: 'accepted', strength: 'binding',
          source: { source_id: 'source:requirements', sha256: requirementsHash, anchor_id: 'heading:requirement:offline — Work without a network' } },
      ] }],
    ['cmd:register-plan-source', 2, 'register_source',
      { id: 'source:search', path: 'docs/plans/search.md', role: 'plan' }],
    ['cmd:register-plan', 3, 'register_plan',
      { id: 'plan:search',
        source: { source_id: 'source:search', sha256: planHash, anchor_id: 'document' },
        declared_lifecycle: 'planned',
        baseline_refs: [
          { item_id: 'feature:notes', item_revision: 1 },
          { item_id: 'requirement:offline', item_revision: 1 },
        ] }],
  ];
  let revision = 0;
  for (const [commandId, expectedRevision, operation, payload] of steps) {
    assert.equal(expectedRevision, revision, `fixture step ordering for ${commandId}`);
    const result = projectCommand(root, commandEnvelope(root, commandId, expectedRevision, operation, payload));
    assert.equal(result.status, 0, `${commandId} failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.receipt.status, 'saved', `${commandId} receipt: ${result.stdout.slice(0, 400)}`);
    revision = parsed.receipt.revision;
    results[commandId] = parsed;
  }
  return { results, revision, requirementsHash, planHash };
}

test('vendored project tree matches the pinned vendor manifest byte for byte', () => {
  assert.equal(fs.existsSync(VENDOR_SIDECAR), true, 'shared/project.vendor.json sidecar must exist');
  const manifest = JSON.parse(fs.readFileSync(VENDOR_SIDECAR, 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source.repository, 'https://github.com/elvinzhao10/LazyBuddy');
  assert.match(manifest.source.revision, /^[a-f0-9]{40}$/);
  assert.equal(manifest.source.path, 'lazybuddy-plugin/shared/project');
  for (const entrypoint of ['contract.mjs', 'model.mjs', 'history.mjs', 'projection.mjs', 'cli.mjs']) {
    assert.equal(manifest.boundary.entrypoints.includes(entrypoint), true, `boundary entrypoint ${entrypoint}`);
  }
  const records = manifest.files.map(record => `${record.path}\0${record.bytes}\0${record.sha256}\n`).join('');
  assert.equal(sha256(Buffer.from(records)), manifest.source.treeSha256, 'manifest tree hash must match its own records');
  const onDisk = inventory(VENDORED_PROJECT);
  for (const record of manifest.files) {
    const absolute = path.join(VENDORED_PROJECT, record.path);
    assert.equal(fs.existsSync(absolute), true, `missing vendored file ${record.path}`);
    const bytes = fs.readFileSync(absolute);
    assert.equal(bytes.length, record.bytes, `byte length drift at ${record.path}`);
    assert.equal(sha256(bytes), record.sha256, `sha256 drift at ${record.path}`);
  }
  const manifestPaths = new Set(manifest.files.map(record => record.path));
  const directories = new Set(manifest.files.map(record => path.posix.dirname(record.path)));
  for (const [relative, described] of Object.entries(onDisk)) {
    if (described.type === 'file') {
      assert.equal(manifestPaths.has(relative), true, `unpinned extra vendored file at ${relative}`);
    } else {
      assert.equal(directories.has(relative), true, `unpinned extra vendored directory at ${relative}`);
    }
  }
});

test('real CLI init/read/command round trip in a temp fixture with replay and conflict semantics', () => {
  const root = tempRoot('round-trip');
  try {
    registerProjectFixture(root);
    const initialized = cli(root, ['project', 'init', '--actor', 'local:adapter-test']);
    assert.equal(initialized.status, 0, initialized.stderr);
    const initResult = JSON.parse(initialized.stdout);
    assert.equal(initResult.initialized, true);
    assert.equal(initResult.project_id, projectIdOf(root));
    assert.equal(initResult.revision, 0);
    assert.equal(fs.existsSync(path.join(root, '.lazyseries/project.json')), true, 'explicit init creates the neutral registry');
    const registry = JSON.parse(fs.readFileSync(path.join(root, '.lazyseries/project.json'), 'utf8'));
    assert.equal(registry.project_id, projectIdOf(root));
    assert.equal(registry.runtime, 'LazyTrae');
    assert.deepEqual(registry.sources, []);

    const { results, revision, requirementsHash } = driveAcceptedRoundTrip(root);
    assert.equal(revision, 4);
    assert.equal(results['cmd:record-baseline'].snapshot.baseline_revision, 1);

    const read = cli(root, ['project', 'read']);
    assert.equal(read.status, 0, read.stderr);
    const readResult = JSON.parse(read.stdout);
    assert.equal(readResult.initialized, true);
    assert.equal(readResult.project_id, projectIdOf(root));
    const snapshot = readResult.snapshot;
    assert.equal(snapshot.runtime, 'LazyTrae');
    assert.equal(snapshot.revision, 4);
    assert.deepEqual(snapshot.sources.map(source => [source.id, source.observation.status]),
      [['source:requirements', 'current'], ['source:search', 'current']]);
    assert.deepEqual(snapshot.items.map(item => [item.id, item.kind, item.state, item.revision]),
      [['feature:notes', 'feature', 'accepted', 1], ['requirement:offline', 'requirement', 'accepted', 1]]);
    assert.equal(snapshot.plans.length, 1);
    const plan = snapshot.plans[0];
    assert.equal(plan.id, 'plan:search');
    assert.equal(plan.title, 'Search plan');
    assert.equal(plan.declared_lifecycle, 'planned');
    assert.equal(plan.alignment, 'unassessed');
    assert.equal(plan.baseline_reference_status, 'current');
    assert.deepEqual(snapshot.summary.unassigned_item_ids, [], 'both accepted items have a contributing plan');
    assert.deepEqual(snapshot.identity, { repository_key: registry.repository_key, basis: 'registry', legacy_repository_key: null });

    // Replay of an accepted command returns the retained receipt byte-equal.
    const replay = projectCommand(root, commandEnvelope(root, 'cmd:register-plan', 3, 'register_plan', {
      id: 'plan:search',
      source: { source_id: 'source:search', sha256: sha256(PLAN_DOCUMENT), anchor_id: 'document' },
      declared_lifecycle: 'planned',
      baseline_refs: [
        { item_id: 'feature:notes', item_revision: 1 },
        { item_id: 'requirement:offline', item_revision: 1 },
      ],
    }));
    assert.equal(replay.status, 0, replay.stderr);
    assert.equal(JSON.stringify(JSON.parse(replay.stdout).receipt), JSON.stringify(results['cmd:register-plan'].receipt));

    // A stale expected_revision yields a typed conflict receipt and no new revision.
    const conflict = projectCommand(root, commandEnvelope(root, 'cmd:stale-write', 0, 'register_source',
      { id: 'source:requirements', path: 'docs/requirements.md', role: 'requirements' }));
    assert.equal(conflict.status, 0, conflict.stderr);
    const conflictResult = JSON.parse(conflict.stdout);
    assert.equal(conflictResult.receipt.status, 'conflict');
    assert.equal(conflictResult.receipt.reason, 'REVISION_CONFLICT');
    assert.equal(conflictResult.snapshot.revision, 4);

    // A colliding command identity with different content is refused.
    const collision = projectCommand(root, commandEnvelope(root, 'cmd:register-plan', 4, 'register_plan',
      { id: 'plan:search', source: { source_id: 'source:search', sha256: sha256(PLAN_DOCUMENT), anchor_id: 'document' },
        declared_lifecycle: 'draft', baseline_refs: [] }));
    assert.equal(collision.status, 1);
    assert.equal(JSON.parse(collision.stderr).code, 'IDEMPOTENCY_CONFLICT');

    // The durable store keeps the contract invariants the vendored model demands.
    const state = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae/state/project.json'), 'utf8'));
    assert.equal(state.revision, 4);
    assert.equal(state.receipts.length, 4);
    assert.deepEqual(state.receipts.map(entry => entry.command.command_id),
      ['cmd:register-requirements', 'cmd:record-baseline', 'cmd:register-plan-source', 'cmd:register-plan']);
    assert.equal(requirementsHash.length, 64);

    // An external source edit is observed as changed, never silently adopted.
    fs.writeFileSync(path.join(root, 'docs', 'requirements.md'), REQUIREMENTS.replace('Original source content.', 'Edited content.'));
    const afterEdit = JSON.parse(cli(root, ['project', 'read']).stdout);
    const edited = afterEdit.snapshot.sources.find(source => source.id === 'source:requirements');
    assert.equal(edited.observation.status, 'changed');
    assert.equal(afterEdit.snapshot.plans[0].source_freshness, 'current', 'the plan binds its own registered document');
  } finally { dispose(root); }
});

test('a registered plan links to the native loop goal identity through Trae conventions', () => {
  const root = tempRoot('native-goal-map');
  try {
    registerProjectFixture(root);
    seedNativeLoop(root);
    assert.equal(cli(root, ['project', 'init', '--actor', 'local:adapter-test']).status, 0);
    const { revision } = driveAcceptedRoundTrip(root);

    // Trae's own identity source: the dashboard snapshot over the native loop.
    const dashboard = cli(root, ['dashboard', 'snapshot']);
    assert.equal(dashboard.status, 0, dashboard.stderr);
    const dashboardSnapshot = JSON.parse(dashboard.stdout).snapshot;
    assert.equal(dashboardSnapshot.project_id, projectIdOf(root));
    assert.equal(dashboardSnapshot.run_id, 'run-project-adapter');
    assert.equal(dashboardSnapshot.tasks[0].id, 'goal-1');

    // A foreign native identity cannot borrow the link; no run is invented.
    const foreign = projectCommand(root, commandEnvelope(root, 'cmd:link-foreign', revision, 'link_native_run',
      { plan_id: 'plan:search', native_project_id: `trae:${'a'.repeat(64)}`, run_id: 'run-project-adapter' }));
    assert.equal(foreign.status, 1);
    assert.equal(JSON.parse(foreign.stderr).code, 'RUN_CAPTURE_REQUIRED');

    // The inspected link maps plan -> native run under the shared Trae identity.
    const linked = projectCommand(root, commandEnvelope(root, 'cmd:link-native', revision, 'link_native_run',
      { plan_id: 'plan:search', native_project_id: dashboardSnapshot.project_id, run_id: dashboardSnapshot.run_id }));
    assert.equal(linked.status, 0, linked.stderr);
    const linkedResult = JSON.parse(linked.stdout);
    assert.equal(linkedResult.receipt.status, 'saved');
    const nativeRun = linkedResult.snapshot.plans[0].native_runs[0];
    assert.equal(nativeRun.runtime, 'LazyTrae');
    assert.equal(nativeRun.native_project_id, dashboardSnapshot.project_id);
    assert.equal(nativeRun.run_id, dashboardSnapshot.run_id);

    // The read surface carries the native goal mapping of that loop.
    const read = JSON.parse(cli(root, ['project', 'read']).stdout);
    assert.equal(read.native_loop.project_id, dashboardSnapshot.project_id);
    assert.equal(read.native_loop.run_id, dashboardSnapshot.run_id);
    assert.equal(read.native_loop.loop_state, 'active');
    assert.deepEqual(read.native_loop.goals,
      [{ id: 'goal-1', title: 'Search goal', status: 'pending', criteria: ['goal-1-c1'] }]);
    assert.equal(read.native_loop.goals[0].id, dashboardSnapshot.tasks[0].id, 'goal identity is the dashboard task identity');
    // The link is an inspection: the native loop store is byte-identical.
    const loopOnDisk = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json'), 'utf8'));
    assert.equal(loopOnDisk.revision, 1);
    assert.deepEqual(loopOnDisk.goals[0].successCriteria.map(item => item.id), ['goal-1-c1']);
  } finally { dispose(root); }
});

test('MCP project tool parity: the same command through the handler returns a byte-equal receipt', { timeout: 180000 }, () => {
  const root = tempRoot('mcp-parity');
  const packedDependency = path.join(MCP_ROOT, 'node_modules', 'lazytrae-ai');
  const packRoot = tempRoot('mcp-parity-pack');
  try {
    registerProjectFixture(root);
    const initialized = cli(root, ['project', 'init', '--actor', 'local:adapter-test']);
    assert.equal(initialized.status, 0, initialized.stderr);
    const command = commandEnvelope(root, 'cmd:parity-register', 0, 'register_source',
      { id: 'source:requirements', path: 'docs/requirements.md', role: 'requirements' });
    const viaCli = projectCommand(root, command);
    assert.equal(viaCli.status, 0, viaCli.stderr);
    const cliReceipt = JSON.parse(viaCli.stdout).receipt;
    assert.equal(cliReceipt.status, 'saved');

    // Documented local packed route: pack this repository's CLI and extract it
    // as the mcp package's version-pinned dependency (lazytrae-ai unpublished).
    const packOutput = spawnSync(npm, ['pack', '--json', '--pack-destination', packRoot],
      { cwd: CLI_ROOT, encoding: 'utf8', timeout: 120000, env: { ...process.env, npm_config_update_notifier: 'false' } });
    assert.equal(packOutput.status, 0, packOutput.stderr || packOutput.stdout);
    const archive = JSON.parse(packOutput.stdout)[0].filename;
    resources.packs.push(path.join(packRoot, archive));
    if (fs.existsSync(packedDependency)) {
      const preserved = `${packedDependency}.preserved-by-project-adapter-test`;
      fs.renameSync(packedDependency, preserved);
      resources.preservedPackedDependency = preserved;
    }
    fs.mkdirSync(packedDependency, { recursive: true });
    resources.packedDependencyInstalled = true;
    const extract = spawnSync('tar', ['-xzf', path.join(packRoot, archive), '-C', packedDependency, '--strip-components=1'],
      { encoding: 'utf8', timeout: 60000 });
    assert.equal(extract.status, 0, extract.stderr);
    const { tool, handleProject } = require('../../mcp/src/handlers-project');
    assert.equal(tool.name, 'lazytrae.project');

    // Argument boundary mirrors the dashboard handler conventions.
    assert.throws(() => handleProject(root, { action: 'reboot' }), /INVALID_PROJECT_ARGUMENTS/);
    assert.throws(() => handleProject(root, { action: 'command', command: 'inject' }), /INVALID_PROJECT_ARGUMENTS/);
    assert.throws(() => handleProject(root, { action: 'read', command: {} }), /INVALID_PROJECT_ARGUMENTS/);

    // Not-initialized inertness through the MCP route on a fresh repository.
    const freshRoot = tempRoot('mcp-parity-fresh');
    resources.roots.push(freshRoot);
    try {
      const before = inventory(freshRoot);
      const hint = handleProject(freshRoot, { action: 'read' });
      assert.equal(hint.status, 'not_initialized');
      assert.equal(hint.hint, 'PROJECT_NOT_INITIALIZED');
      assert.equal(hint.init_offer.kind, 'question');
      const commandHint = handleProject(freshRoot, { action: 'command', command });
      assert.equal(commandHint.status, 'not_initialized');
      assert.deepEqual(inventory(freshRoot), before, 'MCP project calls create nothing before init');
    } finally { dispose(freshRoot); }

    // Same command via the MCP handler: idempotent replay through the same
    // installed CLI route returns the retained receipt byte-equal.
    const viaMcp = handleProject(root, { action: 'command', command });
    assert.equal(viaMcp.receipt.status, 'saved');
    assert.equal(JSON.stringify(viaMcp.receipt), JSON.stringify(cliReceipt), 'byte-equal receipt through the MCP route');
    assert.equal(viaMcp.snapshot.revision, 1);

    const readViaMcp = handleProject(root, { action: 'read' });
    assert.equal(readViaMcp.initialized, true);
    assert.equal(readViaMcp.project_id, projectIdOf(root));
    assert.equal(readViaMcp.snapshot.revision, 1);
  } finally {
    if (resources.packedDependencyInstalled) {
      fs.rmSync(packedDependency, { recursive: true, force: true });
      resources.packedDependencyInstalled = false;
    }
    if (resources.preservedPackedDependency) {
      fs.renameSync(resources.preservedPackedDependency, packedDependency);
      resources.preservedPackedDependency = null;
    }
    dispose(packRoot);
  }
});

test('not-initialized inertness: reads, commands, the dashboard and MCP leave the repository unchanged', () => {
  const root = tempRoot('not-initialized');
  try {
    seedNativeLoop(root);
    registerProjectFixture(root);
    const before = inventory(root);
    const beforeLoop = fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json'));

    const read = cli(root, ['project', 'read']);
    assert.equal(read.status, 0, read.stderr);
    const readResult = JSON.parse(read.stdout);
    assert.equal(readResult.status, 'not_initialized');
    assert.equal(readResult.hint, 'PROJECT_NOT_INITIALIZED');
    assert.equal(readResult.init_offer.kind, 'question');

    const command = projectCommand(root, commandEnvelope(root, 'cmd:pre-init', 0, 'register_source',
      { id: 'source:requirements', path: 'docs/requirements.md', role: 'requirements' }));
    assert.equal(command.status, 0, command.stderr);
    assert.equal(JSON.parse(command.stdout).status, 'not_initialized');

    const garbage = cli(root, ['project', 'command', '--actor', 'local:adapter-test'], { input: '{not json' });
    assert.equal(garbage.status, 0, 'a pre-init repository stays inert even for malformed input');
    assert.equal(JSON.parse(garbage.stdout).status, 'not_initialized');

    // The project routes themselves create nothing: identical tree after reads,
    // typed commands and malformed input, before any dashboard traffic.
    assert.deepEqual(inventory(root), before, 'the whole fixture tree is byte-identical after pre-init project reads');
    assert.equal(fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json')).equals(beforeLoop), true);

    // Trae's not-initialized dashboard behavior is unchanged by the project
    // layer: the snapshot stays green and its only footprint is the loop
    // transaction lock namespace the dashboard itself has always created.
    const dashboard = cli(root, ['dashboard', 'snapshot']);
    assert.equal(dashboard.status, 0, dashboard.stderr);
    const dashboardSnapshot = JSON.parse(dashboard.stdout).snapshot;
    assert.equal(dashboardSnapshot.tasks[0].id, 'goal-1');
    assert.deepEqual(dashboardSnapshot.issues, []);
    assert.equal(dashboardSnapshot.queue_revision, 0);
    const afterDashboard = inventory(root);
    const allowedDashboardSideFootprint = new Set(['.lazytrae/state/transactions', '.lazytrae/state/transactions/locks']);
    for (const [relative, described] of Object.entries(afterDashboard)) {
      if (before[relative] !== undefined) {
        assert.deepEqual(before[relative], described, `dashboard-side entry changed at ${relative}`);
      } else {
        assert.equal(allowedDashboardSideFootprint.has(relative), true, `unexpected dashboard-side footprint at ${relative}`);
      }
    }

    assert.equal(fs.existsSync(path.join(root, '.lazyseries')), false, 'no registry before explicit init');
    assert.equal(fs.existsSync(path.join(root, '.lazytrae/state/project.json')), false, 'no project store before explicit init');
    assert.equal(fs.existsSync(path.join(root, '.lazytrae/state/dashboard-queue.json')), false, 'no queue store created by reads');

    // Init and project commands never touch the native loop or dashboard queue.
    const initialized = cli(root, ['project', 'init', '--actor', 'local:adapter-test']);
    assert.equal(initialized.status, 0, initialized.stderr);
    fs.writeFileSync(path.join(root, 'docs', 'requirements.md'), REQUIREMENTS);
    const after = driveAcceptedRoundTrip(root);
    assert.equal(after.revision, 4);
    assert.equal(fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json')).equals(beforeLoop), true,
      'native loop state is untouched by project commands');
    assert.equal(fs.existsSync(path.join(root, '.lazytrae/state/dashboard-queue.json')), false,
      'the project layer never creates or mutates the dashboard queue');
    const dashboardAfter = JSON.parse(cli(root, ['dashboard', 'snapshot']).stdout).snapshot;
    assert.equal(dashboardAfter.revision, dashboardSnapshot.revision);
    assert.equal(dashboardAfter.queue_revision, 0);
    assert.equal(dashboardAfter.tasks[0].execution, 'not_started');
  } finally { dispose(root); }
});

test('project command boundary rejects malformed argv, unsafe sources and missing actors without mutation', () => {
  const root = tempRoot('boundary');
  try {
    registerProjectFixture(root);
    seedNativeLoop(root);
    assert.equal(cli(root, ['project', 'init', '--actor', 'local:adapter-test']).status, 0);
    const before = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae/state/project.json'), 'utf8'));

    const noActor = cli(root, ['project', 'init']);
    assert.equal(noActor.status, 1);
    assert.equal(JSON.parse(noActor.stderr).code, 'INVALID_ARGV');
    const unknownAction = cli(root, ['project', 'reboot']);
    assert.equal(unknownAction.status, 1);
    assert.equal(JSON.parse(unknownAction.stderr).code, 'INVALID_ARGV');

    const protectedStore = projectCommand(root, commandEnvelope(root, 'cmd:protected', 0, 'register_source',
      { id: 'source:state', path: '.lazytrae/state/project.json.md', role: 'requirements' }));
    assert.equal(protectedStore.status, 1);
    assert.equal(JSON.parse(protectedStore.stderr).code, 'PROTECTED_NATIVE_STORAGE');

    const registryPath = projectCommand(root, commandEnvelope(root, 'cmd:registry', 0, 'register_source',
      { id: 'source:registry', path: '.lazyseries/project.json', role: 'requirements' }));
    assert.equal(registryPath.status, 1);
    assert.equal(JSON.parse(registryPath.stderr).code, 'PROTECTED_REGISTRY_PATH');

    const outside = projectCommand(root, commandEnvelope(root, 'cmd:escape', 0, 'register_source',
      { id: 'source:escape', path: '../outside.md', role: 'requirements' }));
    assert.equal(outside.status, 1);
    assert.equal(JSON.parse(outside.stderr).code, 'UNSAFE_SOURCE_PATH');

    const nonMarkdown = projectCommand(root, commandEnvelope(root, 'cmd:txt', 0, 'register_source',
      { id: 'source:txt', path: 'docs/requirements.md.txt', role: 'requirements' }));
    assert.equal(nonMarkdown.status, 1);
    assert.equal(JSON.parse(nonMarkdown.stderr).code, 'UNSUPPORTED_SOURCE_TYPE');

    const missing = projectCommand(root, commandEnvelope(root, 'cmd:missing', 0, 'register_source',
      { id: 'source:missing', path: 'docs/absent.md', role: 'requirements' }));
    assert.equal(missing.status, 1);
    assert.equal(JSON.parse(missing.stderr).code, 'SOURCE_CAPTURE_REQUIRED');

    const malformed = cli(root, ['project', 'command', '--actor', 'local:adapter-test'], { input: '[]' });
    assert.equal(malformed.status, 1);

    const after = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae/state/project.json'), 'utf8'));
    assert.deepEqual(after, before, 'rejected commands never mutate the accepted state');
  } finally { dispose(root); }
});
