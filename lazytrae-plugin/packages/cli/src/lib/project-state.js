'use strict';
// Native Trae binding for the vendored persistent project core (T21). The
// vendored shared/project modules own the typed contract, reduction and
// projection; this module owns Trae's native authority only: the store
// location (.lazytrae/state/project.json), Trae's journaled state
// transactions, read-only inspection of the native loop for identity
// mapping, and the runtime-neutral .lazyseries/project.json registry that
// only an explicit init creates. The vendored cli.mjs bridge route
// (scripts/state/project-dashboard-bridge.py) is the Buddy-owned native
// bridge; Trae's owning adapter is this Node store, per the family boundary
// that keeps native bridges in their owning adapter areas. Trae's capability
// declaration is distinct from the siblings' dashboard-host capabilities.mjs
// record: this package declares per-surface readiness through the
// host-capability-matrix (src/lib/host-capability-matrix.js), where host
// adoption is claimed only by a fresh current-session probe. The vendored
// git-observation collectors (shared/project/git-observation/*) are
// byte-pinned but wired into no Trae project route: this surface exposes no
// git view, and commit links stay on the producer side (attempt
// source_revision).
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { detectRepoRoot } = require('./loop-store');
const { readTransaction, runTransaction } = require('./state-transaction');
const { DashboardError, hash, json, safeRead } = require('./dashboard-files');
const { projectId } = require('./dashboard-state');

const STATE_PATH = '.lazytrae/state/project.json';
const REGISTRY_PATH = '.lazyseries/project.json';
const SOURCE_LIMIT = 1024 * 1024;
const RUNTIME = 'LazyTrae';
const portable = name => import(pathToFileURL(path.resolve(__dirname, '../../shared/project', name)).href);

// Native storage, the neutral registry and git metadata are never registrable
// project sources: a source document is authored repository content only.
const nativeStorage = relative => /^(?:\.lazytrae(?:\/|$)|\.lazyseries(?:\/|$)|\.git(?:\/|$))/i.test(relative);

function now() {
  return new Date().toISOString();
}

function repositoryKey(root) {
  return `repo:${hash(fs.realpathSync(root))}`;
}

function stateFile(root) {
  return path.join(root, STATE_PATH);
}

function registryFile(root) {
  return path.join(root, REGISTRY_PATH);
}

function notInitialized(action) {
  return { schema_version: 1, status: 'not_initialized', operation: action, hint: 'PROJECT_NOT_INITIALIZED',
    initialized: false,
    init_offer: { kind: 'question',
      question: 'No project record is initialized for this repository. Ask the user whether to run the explicit project init command; this route never creates or initializes a project.' } };
}

// Read-only store access: pre-init reads never create directories, locks or
// files, so the not-initialized path leaves the repository byte-identical.
function loadState(root) {
  let bytes;
  try { bytes = fs.readFileSync(stateFile(root), 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return null; throw error;
  }
  try { return JSON.parse(bytes); } catch { throw new DashboardError('INVALID_PROJECT_STATE'); }
}

async function assertState(state) {
  const { assertProjectState } = await portable('contract.mjs');
  assertProjectState(state);
  return state;
}

function sourceCapture(root, sourceId, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\')
    || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new DashboardError('UNSAFE_SOURCE_PATH');
  }
  if (nativeStorage(relative)) throw new DashboardError('PROTECTED_NATIVE_STORAGE');
  if (!/\.(md|markdown)$/i.test(relative)) throw new DashboardError('UNSUPPORTED_SOURCE_TYPE');
  let bytes;
  try { bytes = safeRead(root, relative, SOURCE_LIMIT); } catch (error) {
    const code = error.code ?? error.message;
    if (code === 'ENOENT') throw new DashboardError('SOURCE_CAPTURE_REQUIRED');
    if (code === 'UNSAFE_REFERENCE' || code === 'REFERENCE_CHANGED' || code === 'ELOOP') throw new DashboardError('UNSAFE_SOURCE_PATH');
    throw new DashboardError('SOURCE_UNAVAILABLE');
  }
  return { source_id: sourceId, path: relative, sha256: hash(bytes), content: bytes.toString('utf8') };
}

function referencedSourceIds(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'source_id' && typeof entry === 'string' && !found.includes(entry)) found.push(entry);
    else if (entry && typeof entry === 'object') referencedSourceIds(entry, found);
  }
  return found;
}

// The host supplies trusted source captures: registration and every
// item/plan/edit binding read the actual file bytes at command time.
function captureSources(root, state, command) {
  const captures = [];
  const payload = command.payload ?? {};
  if (command.operation === 'register_source' && typeof payload.path === 'string') {
    captures.push(sourceCapture(root, payload.id, payload.path));
  }
  for (const sourceId of referencedSourceIds(payload)) {
    if (captures.some(capture => capture.source_id === sourceId)) continue;
    const source = state.sources.find(entry => entry.id === sourceId);
    if (source) captures.push(sourceCapture(root, source.id, source.path));
  }
  return captures;
}

// Read-only inspection of the native active loop (the dashboard's own store):
// a link_native_run command may reference only a real loop run of this
// repository under the shared Trae project identity. No run is created.
function nativeLoop(root) {
  let loop;
  try { loop = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae/state/active-loop.json'), 'utf8')); } catch {
    return null;
  }
  if (!loop || typeof loop !== 'object' || !Array.isArray(loop.goals) || typeof loop.run_id !== 'string') return null;
  return loop;
}

function captureRuns(root, command) {
  const payload = command.payload ?? {};
  if (command.operation !== 'link_native_run') return [];
  const loop = nativeLoop(root);
  if (!loop || loop.run_id !== payload.run_id || projectId(root) !== payload.native_project_id) return [];
  return [{ runtime: RUNTIME, native_project_id: payload.native_project_id, run_id: payload.run_id }];
}

// Native goal mapping: the project record, the dashboard and the loop share
// one Trae repository identity (trae:<sha256>), and a linked plan carries the
// inspected loop run whose goals are the native goals of that repository.
function nativeGoalMap(root) {
  const loop = nativeLoop(root);
  if (!loop) return null;
  return { project_id: projectId(root), run_id: loop.run_id, loop_state: loop.loop_state ?? null,
    goals: loop.goals.map(goal => ({ id: goal.id, title: goal.title ?? null, status: goal.status ?? null,
      criteria: Array.isArray(goal.successCriteria) ? goal.successCriteria.map(item => item.id) : [] })) };
}

function identityObservation(root, state) {
  let registry;
  try { registry = JSON.parse(fs.readFileSync(registryFile(root), 'utf8')); } catch { registry = null; }
  if (!registry || typeof registry !== 'object' || typeof registry.repository_key !== 'string') {
    return { repository_key: state.repository_key, basis: 'canonical-path' };
  }
  const identity = { repository_key: registry.repository_key, basis: 'registry' };
  if (registry.repository_key !== state.repository_key) identity.legacy_repository_key = state.repository_key;
  return identity;
}

function observeSources(root, state) {
  const observations = [];
  for (const source of state.sources) {
    const observedAt = now();
    try {
      const digest = hash(safeRead(root, source.path, SOURCE_LIMIT));
      observations.push({ source_id: source.id, status: 'available', sha256: digest, path: source.path, observed_at: observedAt });
    } catch (error) {
      const code = error.code ?? error.message;
      if (code === 'ENOENT' || code === 'UNSAFE_REFERENCE' || code === 'REFERENCE_CHANGED' || code === 'ELOOP') {
        observations.push({ source_id: source.id, status: 'missing', observed_at: observedAt });
      } else {
        observations.push({ source_id: source.id, status: 'unavailable', observed_at: observedAt });
      }
    }
  }
  return observations;
}

async function projectionOptions(root, state) {
  const { assertProjectionOptions } = await portable('contract.mjs');
  return assertProjectionOptions({ sourceObservations: observeSources(root, state),
    identity: identityObservation(root, state) });
}

async function snapshotOf(root, state) {
  const { projectSnapshot } = await portable('projection.mjs');
  return projectSnapshot(state, await projectionOptions(root, state));
}

async function init(root, options = {}) {
  const existing = loadState(root);
  if (existing) {
    await assertState(existing);
    if (options.projectId && options.projectId !== existing.project_id) throw new DashboardError('FOREIGN_PROJECT');
    return { initialized: true, project_id: existing.project_id, revision: existing.revision,
      snapshot: await snapshotOf(root, existing) };
  }
  const identity = projectId(root);
  if (options.projectId && options.projectId !== identity) throw new DashboardError('FOREIGN_PROJECT');
  const { createProject } = await portable('model.mjs');
  const { assertProjectState, assertProjectRegistry } = await portable('contract.mjs');
  const { projectSnapshot } = await portable('projection.mjs');
  const prepare = () => {
    if (loadState(root)) throw new DashboardError('PROJECT_ALREADY_INITIALIZED');
    const createdAt = now();
    const state = createProject({ projectId: identity, runtime: RUNTIME, repositoryKey: repositoryKey(root), createdAt });
    const registry = { schema_version: 1, project_id: identity, repository_key: state.repository_key,
      runtime: RUNTIME, created_at: createdAt, sources: [] };
    assertProjectState(state);
    assertProjectRegistry(registry);
    return { members: [
      { path: stateFile(root), content: json(state) },
      { path: registryFile(root), content: json(registry) },
    ], result: { initialized: true, project_id: identity, revision: 0,
      snapshot: projectSnapshot(state, { sourceObservations: [], identity: identityObservation(root, state) }) } };
  };
  return runTransaction(root, 'project-record', prepare);
}

async function read(root) {
  const state = loadState(root);
  if (!state) return notInitialized('project.read');
  await assertState(state);
  return { initialized: true, project_id: state.project_id, revision: state.revision,
    snapshot: await snapshotOf(root, state), native_loop: nativeGoalMap(root) };
}

async function execute(root, command, actor) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new DashboardError('INVALID_PROJECT_COMMAND');
  const state = loadState(root);
  if (!state) return notInitialized(typeof command.operation === 'string' ? command.operation : 'project.command');
  if (typeof actor !== 'string' || !actor || actor.length > 256) throw new DashboardError('TRUSTED_ACTOR_REQUIRED');
  const { assertProjectState, assertProjectCommand, assertProjectionOptions } = await portable('contract.mjs');
  const { applyProjectCommand } = await portable('model.mjs');
  const { projectSnapshot } = await portable('projection.mjs');
  assertProjectCommand(command);
  // Every command reduces against the current published state under the
  // project-record store lock, with the host-supplied trusted captures.
  const commandUnderLock = () => {
    const current = loadState(root);
    if (!current) throw new DashboardError('PROJECT_NOT_INITIALIZED');
    assertProjectState(current);
    const context = { actor, occurredAt: now(),
      capturedSources: captureSources(root, current, command), capturedRuns: captureRuns(root, command) };
    return { current, context };
  };
  // The vendored model answers the non-mutating operations (project.read,
  // project.change.preview, source.map, source.edit.preview) with a bare
  // typed query result that has no receipt or state envelope: it passes
  // through read-only under the same lock, so the accepted state, its file
  // and the journaled transaction machinery all stay untouched.
  if (['project.read', 'project.change.preview', 'source.map', 'source.edit.preview'].includes(command.operation)) {
    return readTransaction(root, 'project-record', () => {
      const { current, context } = commandUnderLock();
      return applyProjectCommand(current, command, context);
    });
  }
  const prepare = () => {
    // Reduce inside the journaled transaction: the revision-checked command
    // always applies to the current published state under the store lock.
    const { current, context } = commandUnderLock();
    const outcome = applyProjectCommand(current, command, context);
    const options = assertProjectionOptions({ sourceObservations: observeSources(root, outcome.state),
      identity: identityObservation(root, outcome.state) });
    const result = { receipt: outcome.receipt, snapshot: projectSnapshot(outcome.state, options),
      native_loop: nativeGoalMap(root) };
    const members = [{ path: stateFile(root), content: json(outcome.state) }];
    for (const write of outcome.writes ?? []) members.push({ path: path.join(root, write.path), content: write.content });
    return { members, result };
  };
  return runTransaction(root, 'project-record', prepare);
}

module.exports = { detectRepoRoot, notInitialized, init, read, execute, isInitialized: root => loadState(root) !== null,
  STATE_PATH, REGISTRY_PATH, RUNTIME, nativeGoalMap, repositoryKey };
