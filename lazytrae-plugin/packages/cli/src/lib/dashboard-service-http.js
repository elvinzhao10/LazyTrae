'use strict';
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { portable, execute, read: readRun, state: runState } = require('./dashboard-state');
const { read: readProject, readSource: readProjectSource, execute: executeProjectCommand } = require('./project-state');
const { authentication, checkRequest, readBody } = require('./dashboard-service-auth');
const { capture: nativeCapture, evidence: nativeEvidence } = require('./dashboard-snapshot');
const { hash, safeRead, DashboardError: ServiceError } = require('./dashboard-files');
const capture = (options, cursor) => nativeCapture(options.projectRoot, cursor, options.runId);
const evidence = (options, id) => nativeEvidence(options.projectRoot, id, options.runId);
const projectPortable = name => import(pathToFileURL(resolve(__dirname, '../../shared/project', name)).href);
const dashboardPortable = name => import(pathToFileURL(resolve(__dirname, '../../shared/dashboard/ui', name)).href);
async function projectHealth() {
  const { collectPackageHealth } = await import(pathToFileURL(resolve(__dirname, '../../shared/dashboard/adapters/package-health.mjs')).href);
  return collectPackageHealth({ runtime: 'LazyTrae', pluginRoot: resolve(__dirname, '../../../..'), packageVersion: require('../../package.json').version,
    capabilities: { browser: 'available', project_platform: 'available', project_source_editing: 'available', project_telemetry: 'available', context_copy: 'available' } });
}
async function projectTelemetry(options) {
  const { runtimeTelemetry, attachCostHistory } = await import(pathToFileURL(resolve(__dirname, '../../shared/dashboard/adapters/telemetry.mjs')).href);
  const project = requireInitialized(await readProject(options.projectRoot, options.projectId)).snapshot;
  let run = null; let error = null;
  try { if (options.runId) run = (await capture(options)).snapshot; }
  catch (failure) { error = failure.code ?? 'RUN_READ_FAILED'; }
  return attachCostHistory(runtimeTelemetry(project, run, error), { runtime: 'LazyTrae',
    readFile: (reference, limit) => safeRead(options.projectRoot, reference, limit) });
}
function decodeCursor(value) {
 if (value === undefined) return null;
 if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new ServiceError('RESYNC_REQUIRED', 409);
 try { return JSON.parse(Buffer.from(value, 'base64url')); } catch { throw new ServiceError('RESYNC_REQUIRED', 409); }
}

const assetManifest = JSON.parse(readFileSync(join(__dirname, '../../shared/dashboard/ui/asset-manifest.json'), 'utf8'));
const assets = new Map(assetManifest.assets.map(asset => [asset.route, [asset.file, asset.type]]));
const projectSourceRoute = /^\/api\/project\/sources\/((?:[A-Za-z0-9._:@-]|%[0-9A-Fa-f]{2}){1,768})$/;
const security = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'", connection: 'close' };
function send(response, value, status = 200) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  if (bytes.length > 8 * 1024 * 1024) throw new ServiceError('RESPONSE_LIMIT', 503);
  response.writeHead(status, { ...security, 'content-type': 'application/json', 'content-length': bytes.length });
  response.end(bytes);
}
function projectFailure(error) {
  if (error?.code === 'PROJECT_NOT_INITIALIZED' || error?.code === 'UNKNOWN_SOURCE' || error?.code === 'UNKNOWN_ARTIFACT') {
    return new ServiceError(error.code, 404);
  }
  if (error instanceof ServiceError && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) return error;
  if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(error.code)) {
    return new ServiceError(error.code, 422);
  }
  return error;
}
function requireInitialized(result) {
  if (result?.initialized === false) throw new ServiceError('PROJECT_NOT_INITIALIZED', 404);
  return result;
}
async function projectArchitecture(options) {
  const project = requireInitialized(await readProject(options.projectRoot, options.projectId));
  const { architectureFixture } = await dashboardPortable('architecture-model.mjs');
  return architectureFixture({ snapshot: project.snapshot });
}
async function projectGit(options) {
  const project = requireInitialized(await readProject(options.projectRoot, options.projectId));
  const { collectLocalGitFacts } = await projectPortable('git-observation/local.mjs');
  const { gitDetailModel, metricsDetailModel } = await dashboardPortable('git-metrics-model.mjs');
  const local = await collectLocalGitFacts({ repositoryRoot: options.projectRoot,
    sourceScope: project.snapshot.sources.map(source => source.path) });
  const git = gitDetailModel({ local });
  return { git, metrics: metricsDetailModel({ scope: 'project', asOf: local.observed_at,
    projectionRevision: project.snapshot.revision, git }) };
}
async function projectEvidence(options) {
  const project = requireInitialized(await readProject(options.projectRoot, options.projectId));
  const { buildArtifactIndex } = await projectPortable('artifacts/index.mjs');
  const { evidenceFixture } = await dashboardPortable('evidence-model.mjs');
  const index = await buildArtifactIndex(options.projectRoot, { snapshot: project.snapshot });
  return evidenceFixture({ index, snapshot: project.snapshot });
}
async function projectEvidencePreview(options, artifactId) {
  const project = requireInitialized(await readProject(options.projectRoot, options.projectId));
  const { buildArtifactIndex } = await projectPortable('artifacts/index.mjs');
  const { renderArtifactPreview } = await projectPortable('artifacts/preview.mjs');
  const index = await buildArtifactIndex(options.projectRoot, { snapshot: project.snapshot });
  const entry = index.entries.find(candidate => candidate.id === artifactId);
  if (!entry) throw new ServiceError('UNKNOWN_ARTIFACT', 404);
  return renderArtifactPreview(options.projectRoot, entry, { readFile: async (_root, relative, limit) => {
    const bytes = safeRead(options.projectRoot, relative, limit);
    if (entry.sha256 && hash(bytes) !== entry.sha256) throw new ServiceError('ARTIFACT_CHANGED', 409);
    return { bytes };
  } });
}
async function assessProjectTransition(options, request) {
  const project = requireInitialized(await readProject(options.projectRoot, options.projectId));
  const { assessPlanTransition } = await projectPortable('plans/lifecycle.mjs');
  return assessPlanTransition(project.snapshot, request.plan_id, request.to_lifecycle, request.payload ?? {});
}
async function listen(options, control) {
  const { parseContract } = await portable('contracts/parse.mjs');
  const auth = authentication(control.credential); const sockets = new Set(); let active = 0; let closing = false;
  let origin;
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    const deadline = setTimeout(() => response.destroy(), 48000);
    response.on('close', () => clearTimeout(deadline));
    response.setTimeout(5000, () => response.destroy());
    try {
      checkRequest(request, origin);
      if (closing || active >= 8) throw new ServiceError('SERVICE_BUSY', 503);
      active += 1;
      try {
        if (request.method === 'GET' && assets.has(request.url)) {
          if (!options.assetRoot) throw new ServiceError('UI_UNAVAILABLE', 503);
          const [name, type] = assets.get(request.url); const bytes = await safeRead(options.assetRoot, name, 1024 * 1024);
          response.writeHead(200, { ...security, 'content-type': type, 'content-length': bytes.length }); response.end(bytes); return;
        }
        if (request.method === 'POST' && request.url === '/api/session') {
          auth.bootstrap(request); const body = await readBody(request);
          if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new ServiceError('EMPTY_OBJECT_REQUIRED');
          send(response, auth.create()); return;
        }
        if (request.method === 'POST' && ['/internal/challenge', '/internal/stop'].includes(request.url)) {
          auth.bootstrap(request); const body = await readBody(request);
          if (body.instance !== control.identity.instance || typeof body.challenge !== 'string' || !/^[a-f0-9]{64}$/.test(body.challenge) || Object.keys(body).sort().join(',') !== 'challenge,instance') throw new ServiceError('IDENTITY_MISMATCH', 409);
          send(response, { identity: control.identity, challenge: body.challenge });
          if (request.url === '/internal/stop') { closing = true; setImmediate(() => close()); }
          return;
        }
        const actor = auth.session(request);
        if (request.method === 'POST' && request.url === '/api/history/query') {
          if (options.runId === null) throw new ServiceError('RUN_NOT_BOUND', 409);
          const { loop, input } = await readRun(options.projectRoot);
          if (input.run_id !== options.runId || input.project_id !== options.projectId) throw new ServiceError('RUN_BINDING_MISMATCH', 409);
          const { queryCheckpointHistory } = await dashboardPortable('checkpoint-history.mjs');
          try {
            send(response, await queryCheckpointHistory(input, await readBody(request), async id => {
              const old = (loop.dashboard_history ?? []).find(entry => entry.revision === id - 1);
              if (!old) throw new Error('HISTORY_UNAVAILABLE');
              return runState({ ...loop, run_id: old.run_id ?? loop.run_id, goals: old.goals,
                plan_revision: old.plan_revision ?? null, decisions: old.decisions ?? [] });
            }));
          } catch (error) { throw new ServiceError(/^[A-Z_]+$/.test(error.message) ? error.message : 'HISTORY_UNAVAILABLE', 422); }
          return;
        }
        if (request.method === 'GET' && request.url === '/api/project') {
          try {
            const native = requireInitialized(await readProject(options.projectRoot, options.projectId));
            send(response, { project: native.snapshot, native_loop: native.native_loop });
          }
          catch (error) { throw projectFailure(error); }
          return;
        }
        const detailRoute = { '/api/project/architecture': projectArchitecture,
          '/api/project/git': projectGit, '/api/project/evidence': projectEvidence, '/api/project/health': projectHealth,
          '/api/project/telemetry': projectTelemetry }[request.url];
        if (request.method === 'GET' && detailRoute) {
          try { send(response, await detailRoute(options, actor)); }
          catch (error) { throw projectFailure(error); }
          return;
        }
        const sourceRoute = projectSourceRoute.exec(request.url);
        if (request.method === 'GET' && sourceRoute) {
          let sourceId;
          try { sourceId = decodeURIComponent(sourceRoute[1]); } catch { throw new ServiceError('INVALID_SOURCE_ID'); }
          if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/.test(sourceId)) throw new ServiceError('INVALID_SOURCE_ID');
          try { send(response, await readProjectSource(options.projectRoot, sourceId, options.projectId)); }
          catch (error) { throw projectFailure(error); }
          return;
        }
        if (request.method === 'POST' && request.url === '/api/project/commands') {
          const command = await readBody(request);
          if (!command || typeof command !== 'object' || Array.isArray(command)
            || command.project_id !== options.projectId) throw new ServiceError('COMMAND_BINDING_MISMATCH', 409);
          try {
            const result = requireInitialized(await executeProjectCommand(options.projectRoot, command, actor, options.projectId));
            const query = ['project.read', 'project.change.preview', 'source.map', 'source.edit.preview'].includes(command.operation);
            send(response, query ? { result } : result, result.receipt?.status === 'conflict' ? 409 : 200);
          } catch (error) { throw projectFailure(error); }
          return;
        }
        if (request.method === 'POST' && request.url === '/api/project/plan-transition-assessment') {
          const requestBody = await readBody(request);
          if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)
            || typeof requestBody.plan_id !== 'string' || typeof requestBody.to_lifecycle !== 'string'
            || (requestBody.payload !== undefined && (typeof requestBody.payload !== 'object' || Array.isArray(requestBody.payload)))) {
            throw new ServiceError('INVALID_TRANSITION_ASSESSMENT');
          }
          try { send(response, await assessProjectTransition(options, requestBody)); }
          catch (error) { throw projectFailure(error); }
          return;
        }
        if (request.method === 'POST' && request.url === '/api/project/evidence/preview') {
          const requestBody = await readBody(request);
          if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)
            || Object.keys(requestBody).length !== 1 || typeof requestBody.artifact_id !== 'string'
            || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/.test(requestBody.artifact_id)) {
            throw new ServiceError('INVALID_ARTIFACT_ID');
          }
          try { send(response, await projectEvidencePreview(options, requestBody.artifact_id)); }
          catch (error) { throw projectFailure(error); }
          return;
        }
        if (request.method === 'GET' && ['/api/snapshot', '/api/updates'].includes(request.url)) {
          if (options.runId === null) throw new ServiceError('RUN_NOT_BOUND', 409);
          send(response, await capture(options, decodeCursor(request.headers['x-dashboard-cursor']))); return;
        }
        if (request.method === 'GET' && /^\/api\/evidence\/[a-f0-9]{64}$/.test(request.url)) {
          if (options.runId === null) throw new ServiceError('RUN_NOT_BOUND', 409);
          const bytes = await evidence(options, request.url.slice('/api/evidence/'.length));
          response.writeHead(200, { ...security, 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="evidence.txt"', 'content-length': bytes.length }); response.end(bytes); return;
        }
        if (request.method === 'POST' && request.url === '/api/commands') {
          if (options.runId === null) throw new ServiceError('RUN_NOT_BOUND', 409);
          const command = parseContract('command', await readBody(request));
          const queued = command.operation.endsWith('_queued_plan');
          const runId = queued ? null : options.runId;
          if (command.target.project_id !== options.projectId || command.target.run_id !== runId) throw new ServiceError('COMMAND_BINDING_MISMATCH', 409);
          try {
            const result = await execute(options.projectRoot, command, actor);
            send(response, result, result.status === 'conflict' ? 409 : 200);
          } catch (error) {
            const current = (await capture(options)).snapshot;
            const reason = !queued && current.editability?.supported === false ? current.editability.reason :
              /^(?:(?:dashboard|queue): )?([A-Z_]+)(?: at \$.*)?$/.exec(error.code ?? '')?.[1] ?? 'AUTHORITY_REJECTED';
            send(response, { status: 'rejected', reason, revision: queued ? current.queue_revision : current.revision,
              plan_revision: queued ? 0 : current.plan_revision }, 422);
          }
          return;
        }
        throw new ServiceError('UNKNOWN_ROUTE', 404);
      } finally { active -= 1; }
    } catch (error) {
      const code = error instanceof ServiceError ? error.code : (typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'AUTHORITY_REJECTED');
      if (!response.headersSent && !response.destroyed) send(response, { status: 'rejected', code }, error instanceof ServiceError ? error.status : 422);
    }
  });
  server.maxConnections = 32; server.headersTimeout = 3000; server.requestTimeout = 3000; server.keepAliveTimeout = 1;
  server.on('connection', socket => { sockets.add(socket); socket.setTimeout(5000, () => socket.destroy()); socket.on('close', () => sockets.delete(socket)); });
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  control.identity.port = server.address().port;
  async function close() {
    closing = true;
    const forced = setTimeout(() => { for (const socket of sockets) socket.destroy(); }, 2000);
    await new Promise(resolve => server.close(resolve)); clearTimeout(forced);
    while (active) await new Promise(resolve => setTimeout(resolve, 50));
    control.closed?.();
  }
  return { origin, close };
}

module.exports = { listen };
