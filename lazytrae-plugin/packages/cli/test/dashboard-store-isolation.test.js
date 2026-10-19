'use strict';
// T3a: one dashboard per repository, isolated per `.lazytrae` store. The
// runtime-neutral `.lazyseries/project.json` registry is the only shared
// surface, so a foreign runtime (LazyBuddy, LazyQoder) reaching for this root
// must refuse typed without touching Trae's store bytes, and Trae's own
// dashboard surfaces must resolve their store roots only inside `.lazytrae`.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY = path.join(CLI_ROOT, 'src', 'index.js');
const PROJECT_STATE = require('../src/lib/project-state');

// The sibling plugins share one worktrees checkout layout
// (<worktrees>/<Name>/1.4.0-completion/<name>-plugin); when present the real
// foreign CLIs are exercised against the same root. In a standalone clone the
// cross-runtime half skips and the hand-authored foreign-identity half below
// still proves the refusal.
const WORKTREES = path.resolve(CLI_ROOT, '../../../../..');
const BUDDY_CLI = path.join(WORKTREES, 'LazyBuddy/1.4.0-completion/lazybuddy-plugin/shared/project/cli.mjs');
const QODER_CLI = path.join(WORKTREES, 'LazyQoder/1.4.0-completion/lazyqoder-plugin/shared/dashboard-host/project.mjs');
const buddyAvailable = fs.existsSync(BUDDY_CLI);
const qoderAvailable = fs.existsSync(QODER_CLI);

const ACTOR = 'local:store-isolation-test';
const resources = { roots: [] };
process.on('exit', () => {
  for (const root of resources.roots) fs.rmSync(root, { recursive: true, force: true });
  process.stdout.write(`STORE_ISOLATION_CLEANUP ${JSON.stringify({ roots: resources.roots.length })}\n`);
});

function tempRoot(prefix) {
  // mkdtemp already yields a private 0700 root on the real (realpath'd) tmpdir,
  // which the sibling bridges require before they will even inspect a root.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `lazytrae-store-isolation-${prefix}-`)));
  resources.roots.push(root);
  return root;
}
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const projectIdOf = root => `trae:${sha256(fs.realpathSync(root))}`;
const repositoryKeyOf = root => `repo:${sha256(fs.realpathSync(root))}`;

function run(argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd: options.cwd, shell: false,
      stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
    const output = []; const errors = [];
    child.stdout.on('data', chunk => output.push(chunk));
    child.stderr.on('data', chunk => errors.push(chunk));
    child.on('error', reject);
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.on('close', (code, signal) => resolve({
      code, signal,
      stdout: Buffer.concat(output).toString('utf8'),
      stderr: Buffer.concat(errors).toString('utf8'),
    }));
    child.stdin.end(options.input === undefined ? '' : options.input);
  });
}
const trae = (root, args, input) => run([process.execPath, CLI_ENTRY, ...args], { cwd: root, input });

function storeInventory(root) {
  const files = {};
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else files[path.relative(root, target)] = sha256(fs.readFileSync(target));
    }
  };
  for (const namespace of ['.lazytrae', '.lazyseries']) {
    const store = path.join(root, namespace);
    if (fs.existsSync(store)) visit(store);
  }
  return files;
}

test('own init owns one store; sibling foreign-runtime CLIs refuse and leave every store byte unchanged', async t => {
  const root = tempRoot('matrix');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/requirements.md'), '# Requirements\n\n## feature:iso — Isolation\n\nSource.\n');

  const initialized = await trae(root, ['project', 'init', '--actor', ACTOR]);
  assert.equal(initialized.code, 0, initialized.stderr);
  assert.equal(JSON.parse(initialized.stdout).initialized, true);
  assert.equal(fs.existsSync(path.join(root, '.lazytrae/state/project.json')), true,
    'Trae init creates its own state document');
  const registry = JSON.parse(fs.readFileSync(path.join(root, '.lazyseries/project.json'), 'utf8'));
  assert.equal(registry.runtime, 'LazyTrae');
  assert.equal(registry.project_id, projectIdOf(root));
  const owned = storeInventory(root);
  assert.ok(Object.keys(owned).length >= 2, 'the snapshot covers registry and state bytes');

  // Foreign runtime: the real Buddy CLI, carrying the registry's own project id
  // so the only foreign fact is the owning runtime.
  if (!buddyAvailable) t.skip(`LazyBuddy worktree CLI not found at ${BUDDY_CLI}`);
  else {
    const refused = await run([process.execPath, BUDDY_CLI, 'init', '--project-root', root,
      '--project-id', registry.project_id, '--actor', 'cross:buddy'], { cwd: root });
    assert.notEqual(refused.code, 0, 'Buddy init must fail closed');
    assert.equal(refused.stderr.trim(), 'REGISTRY_FOREIGN_RUNTIME');
    assert.equal(fs.existsSync(path.join(root, '.lazybuddy')), false,
      'a refused Buddy init creates no second native store directory');
  }
  // Foreign runtime: the real LazyQoder CLI against the same root.
  if (!qoderAvailable) t.skip(`LazyQoder worktree CLI not found at ${QODER_CLI}`);
  else {
    const refused = await run([process.execPath, QODER_CLI, 'init', '--project-root', root,
      '--project-id', registry.project_id, '--actor', 'cross:qoder'], { cwd: root });
    assert.notEqual(refused.code, 0, 'Qoder init must fail closed');
    assert.equal(refused.stderr.trim(), 'REGISTRY_FOREIGN_RUNTIME');
    assert.equal(fs.existsSync(path.join(root, '.lazyqoder')), false,
      'a refused Qoder init creates no second native store directory');
  }
  // No cross-store mutation: every Trae and registry byte is unchanged after
  // the foreign attempts, whatever scaffolding the foreign runtime left in its
  // own namespace.
  assert.deepEqual(storeInventory(root), owned,
    'foreign-runtime init attempts must leave the owning store byte-identical');
  // The owning runtime keeps full service after the refusals.
  const reread = await trae(root, ['project', 'read']);
  assert.equal(reread.code, 0, reread.stderr);
  assert.equal(JSON.parse(reread.stdout).project_id, projectIdOf(root));
  t.diagnostic(JSON.stringify({ buddy_cli_exercised: buddyAvailable, qoder_cli_exercised: qoderAvailable,
    refusal: 'REGISTRY_FOREIGN_RUNTIME', store_bytes_unchanged: true }));
});

// F-04 portable half: a registry whose only foreign fact is the owning runtime
// refuses init typed, repeatedly, and Trae never writes its state document.
test('init refuses a foreign-runtime registry repeatedly without creating a Trae store', async t => {
  const root = tempRoot('foreign-registry');
  fs.mkdirSync(path.join(root, '.lazyseries'), { recursive: true, mode: 0o700 });
  const foreign = { schema_version: 1, project_id: projectIdOf(root),
    repository_key: repositoryKeyOf(root), runtime: 'LazyBuddy',
    created_at: '2026-10-01T00:00:00.000Z', sources: [] };
  const registryPath = path.join(root, '.lazyseries/project.json');
  fs.writeFileSync(registryPath, `${JSON.stringify(foreign)}\n`, { mode: 0o600 });
  const owned = fs.readFileSync(registryPath);

  for (let attempt = 1; attempt <= 2; attempt++) {
    const refused = await trae(root, ['project', 'init', '--actor', ACTOR]);
    assert.equal(refused.code, 1, `foreign-runtime init attempt ${attempt} must fail closed`);
    assert.equal(JSON.parse(refused.stderr).code, 'REGISTRY_FOREIGN_RUNTIME');
    assert.equal(fs.readFileSync(registryPath).equals(owned), true,
      'a refused init must leave the foreign registry byte-identical');
  }
  assert.equal(fs.existsSync(path.join(root, '.lazytrae/state/project.json')), false,
    'a refused init creates no Trae state document');
  // A not-initialized read stays inert: it answers typed and writes nothing.
  const inert = await trae(root, ['project', 'read']);
  assert.equal(inert.code, 0, inert.stderr);
  assert.equal(JSON.parse(inert.stdout).initialized, false);
  assert.equal(fs.readFileSync(registryPath).equals(owned), true);
  t.diagnostic(JSON.stringify({ refusal: 'REGISTRY_FOREIGN_RUNTIME', registry_bytes_stable: true,
    no_trae_state_created: true, inert_read: true }));
});

test('the dashboard service resolves its store root only inside .lazytrae', async t => {
  // The resolved store-root contract: Trae's project record, its queue and the
  // shared registry each have exactly one path, and only the registry is not
  // Trae-owned namespace.
  assert.equal(PROJECT_STATE.STATE_PATH, '.lazytrae/state/project.json');
  assert.equal(PROJECT_STATE.REGISTRY_PATH, '.lazyseries/project.json');
  assert.equal(PROJECT_STATE.RUNTIME, 'LazyTrae');

  const root = tempRoot('namespace');
  const initialized = await trae(root, ['project', 'init', '--actor', ACTOR]);
  assert.equal(initialized.code, 0, initialized.stderr);
  const registryBytes = fs.readFileSync(path.join(root, '.lazyseries/project.json'));
  const stateBytes = fs.readFileSync(path.join(root, '.lazytrae/state/project.json'));

  // The dashboard lifecycle answers for this project while anchoring its
  // service state (locks, receipts, credentials) under `.lazytrae/dashboard`.
  const status = await trae(root, ['dashboard', 'status']);
  assert.equal(status.code, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).status, 'stopped');
  assert.equal(fs.existsSync(path.join(root, '.lazytrae/dashboard')), true,
    'the dashboard service state lives in its own namespace');
  assert.equal(fs.readdirSync(path.join(root, '.lazytrae/dashboard')).length, 1,
    'exactly one per-project dashboard directory is anchored');
  const anchored = fs.readdirSync(path.join(root, '.lazytrae/dashboard'))[0];
  assert.match(anchored, /^[0-9a-f]{64}$/);
  // Dashboard traffic touched neither the project record nor the registry.
  assert.equal(fs.readFileSync(path.join(root, '.lazytrae/state/project.json')).compare(stateBytes), 0);
  assert.equal(fs.readFileSync(path.join(root, '.lazyseries/project.json')).compare(registryBytes), 0);
  assert.equal(fs.existsSync(path.join(root, '.lazybuddy')), false);
  assert.equal(fs.existsSync(path.join(root, '.lazyqoder')), false);
  t.diagnostic(JSON.stringify({ service_store_root: `.lazytrae/dashboard/${anchored}`,
    state_bytes_stable: true, registry_bytes_stable: true }));
});

// Adversarial: a tampered state document and a moved-away state document must
// refuse typed without ever rewriting the shared registry.
test('tampered or missing state documents refuse typed without mutation', async t => {
  const root = tempRoot('tampered');
  const initialized = await trae(root, ['project', 'init', '--actor', ACTOR]);
  assert.equal(initialized.code, 0, initialized.stderr);
  const registryPath = path.join(root, '.lazyseries/project.json');
  const statePath = path.join(root, '.lazytrae/state/project.json');
  const registry = fs.readFileSync(registryPath);
  const state = fs.readFileSync(statePath);

  // Malformed state: typed parse refusal, registry bytes untouched.
  fs.writeFileSync(statePath, '{broken state\n');
  const corrupt = await trae(root, ['project', 'read']);
  assert.equal(corrupt.code, 1, 'a corrupt state document must fail closed');
  assert.equal(JSON.parse(corrupt.stderr).code, 'INVALID_PROJECT_STATE');
  assert.equal(fs.readFileSync(registryPath).compare(registry), 0,
    'a corrupt state document must not touch the shared registry');
  fs.writeFileSync(statePath, state);

  // Stale store: the state document is moved away; reads answer inert.
  const movedAway = path.join(root, 'project.json.moved');
  fs.renameSync(statePath, movedAway);
  const missing = await trae(root, ['project', 'read']);
  assert.equal(missing.code, 0, missing.stderr);
  assert.equal(JSON.parse(missing.stdout).initialized, false);
  assert.equal(fs.existsSync(statePath), false, 'the refused read must not recreate a state document');
  fs.renameSync(movedAway, statePath);
  const resumed = await trae(root, ['project', 'read']);
  assert.equal(JSON.parse(resumed.stdout).initialized, true, 'service resumes after the state returns');
  t.diagnostic(JSON.stringify({ corrupt_state: 'INVALID_PROJECT_STATE', missing_state: 'inert not_initialized',
    registry_bytes_stable: true, no_state_recreated: true }));
});
