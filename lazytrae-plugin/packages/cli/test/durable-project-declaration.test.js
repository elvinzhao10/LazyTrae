'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { prepareProductRoot, promoteRelease } = require('../src/lib/lifecycle');
const { runCli } = require('./test-helpers');

const CLI_ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://github.com/elvinzhao10/LazyTrae.git';

function durableFixture(sandbox, name, fill) {
  const installRoot = path.join(sandbox, name);
  const paths = prepareProductRoot({ installRoot, product: 'LazyTrae' });
  const source = path.join(sandbox, `${name} source checkout`);
  const staging = path.join(paths.staging, `${name}-stage`);
  const sha = fill.repeat(40);
  fs.cpSync(CLI_ROOT, source, { recursive: true });
  fs.cpSync(source, staging, { recursive: true });
  promoteRelease(paths, {
    commitSha: sha,
    entrypoint: 'bin/lazytrae.js',
    manifestRelativePath: 'package.json',
    origin: ORIGIN,
    releaseId: `1.1.0-${sha.slice(0, 12)}`,
    runtimePath: process.execPath,
    stagingPath: staging,
    version: '1.1.0',
  });
  return { paths, sha, source };
}

function runStable(fixture, project, args) {
  return childProcess.spawnSync(process.execPath, [
    fixture.paths.launcher, '--root', project, ...args,
  ], { cwd: project, encoding: 'utf8' });
}

function projectFixture(sandbox) {
  const project = path.join(sandbox, 'project with spaces');
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  return project;
}

function declaration(project) {
  return JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'))
    .mcpServers.lazytrae;
}

test('durable init records the absolute runtime and stable launcher after source deletion', (t) => {
  // Given: a promoted durable release and a separate source checkout.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae durable declaration '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const fixture = durableFixture(sandbox, 'durable root', 'a');
  const project = projectFixture(sandbox);
  fs.rmSync(fixture.source, { recursive: true });

  // When: the durable launcher initializes the project and its declaration starts MCP.
  const initialized = runStable(fixture, project, ['init', '--host', 'ide']);
  const server = declaration(project);
  const started = childProcess.spawnSync(server.command, server.args, {
    cwd: project,
    encoding: 'utf8',
    input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`,
  });

  // Then: no source or PATH launcher is needed and provenance is independently checkable.
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  assert.equal(fs.existsSync(fixture.source), false);
  assert.equal(server.command, process.execPath);
  assert.deepEqual(server.args, [fs.realpathSync(fixture.paths.launcher), '--root', fs.realpathSync(project), 'mcp']);
  assert.deepEqual(server._lazytrae.runtime, {
    path: process.execPath,
    fingerprint: {
      realpath: fs.realpathSync(process.execPath),
      version: process.version,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'),
    },
  });
  assert.equal(server._lazytrae.release_sha, fixture.sha);
  assert.match(server._lazytrae.managed_entry_sha256, /^[a-f0-9]{64}$/);
  assert.equal(started.status, 0, started.stderr);
  assert.equal(JSON.parse(started.stdout.trim()).result.serverInfo.version, '1.1.0');
});

test('durable init rejects tampered provenance before writing project assets', async (t) => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae durable provenance '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

  for (const [name, expectedError, tamper] of [
    ['receipt commit SHA', /lifecycle receipt/, (fixture) => {
      const receiptPath = path.join(fixture.paths.receipts, fs.readdirSync(fixture.paths.receipts)[0]);
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      receipt.commit_sha = 'MISLEADING';
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    }],
    ['stable launcher bytes', /Durable LazyTrae/, (fixture) => fs.appendFileSync(fixture.paths.launcher, '// modified\n')],
  ]) {
    await t.test(name, () => {
      // Given: a promoted durable release whose provenance was modified in place.
      const fixture = durableFixture(sandbox, name, name === 'receipt commit SHA' ? '2' : '3');
      const project = projectFixture(path.join(sandbox, name));
      tamper(fixture);

      // When: the durable launcher attempts to initialize the project.
      const initialized = runStable(fixture, project, ['init', '--host', 'ide']);

      // Then: provenance is rejected before any project asset or declaration is written.
      assert.notEqual(initialized.status, 0);
      assert.match(`${initialized.stdout}${initialized.stderr}`, expectedError);
      assert.deepEqual(fs.readdirSync(project), ['.git']);
    });
  }
});

test('durable sync changes only the exact managed entry and preserves caller bytes and mode', (t) => {
  // Given: two durable roots and a project declaration managed by the first.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae durable reconcile '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const first = durableFixture(sandbox, 'first root', 'b');
  const second = durableFixture(sandbox, 'second root', 'c');
  const project = projectFixture(sandbox);
  assert.equal(runStable(first, project, ['init', '--host', 'ide']).status, 0);
  const target = path.join(project, '.trae', 'mcp.json');
  const beforeServer = declaration(project);
  const prefix = '{\n  "callerTop": { "spacing" : "keep" },\n  "mcpServers": {\n    "caller": { "command" : "keep-me" },\n    "lazytrae": ';
  const suffix = '\n  },\n  "callerTail" : [ 1, 2 ]\n}\n';
  fs.writeFileSync(target, `${prefix}${JSON.stringify(beforeServer)}${suffix}`);
  fs.chmodSync(target, 0o640);

  // When: the second durable installation reconciles the project.
  const synced = runStable(second, project, ['sync']);
  const after = fs.readFileSync(target, 'utf8');

  // Then: only the exact managed value changes; caller bytes and mode survive.
  assert.equal(synced.status, 0, synced.stderr || synced.stdout);
  assert.equal(after.startsWith(prefix), true);
  assert.equal(after.endsWith(suffix), true);
  assert.equal(declaration(project).args[0], fs.realpathSync(second.paths.launcher));
  assert.equal(fs.statSync(target).mode & 0o777, 0o640);
});

test('active release replacement changes stable launcher behavior without editing the declaration', (t) => {
  // Given: a project initialized from the first active durable release.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae durable active switch '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const fixture = durableFixture(sandbox, 'durable root', 'f');
  const project = projectFixture(sandbox);
  assert.equal(runStable(fixture, project, ['init', '--host', 'ide']).status, 0);
  const target = path.join(project, '.trae', 'mcp.json');
  const before = fs.readFileSync(target);
  const nextSha = '1'.repeat(40);
  const staging = path.join(fixture.paths.staging, 'next-stage');
  fs.cpSync(CLI_ROOT, staging, { recursive: true });
  const entry = path.join(staging, 'bin', 'lazytrae.js');
  const source = fs.readFileSync(entry, 'utf8');
  fs.writeFileSync(entry, source.replace(
    '#!/usr/bin/env node\n',
    "#!/usr/bin/env node\nif (process.argv[2] === 'release-probe') { process.stdout.write('second-release\\n'); process.exit(0); }\n",
  ));

  // When: the second release becomes active and the stable launcher is invoked and synced.
  promoteRelease(fixture.paths, {
    commitSha: nextSha,
    entrypoint: 'bin/lazytrae.js',
    manifestRelativePath: 'package.json',
    origin: ORIGIN,
    releaseId: `1.1.0-${nextSha.slice(0, 12)}`,
    runtimePath: process.execPath,
    stagingPath: staging,
    version: '1.1.0',
  });
  const probed = childProcess.spawnSync(process.execPath, [fixture.paths.launcher, 'release-probe'], {
    encoding: 'utf8',
  });
  const synced = runStable(fixture, project, ['sync']);

  // Then: dispatch follows active state while the stable project declaration remains byte-identical.
  assert.equal(probed.status, 0, probed.stderr);
  assert.equal(probed.stdout.trim(), 'second-release');
  assert.equal(synced.status, 0, synced.stderr || synced.stdout);
  assert.deepEqual(fs.readFileSync(target), before);
});

test('durable sync refuses ambiguous or unsafe declarations without mutation', async (t) => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae durable refusal '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const fixture = durableFixture(sandbox, 'durable root', 'd');

  await t.test('modified managed entry', () => {
    const project = projectFixture(path.join(sandbox, 'modified'));
    assert.equal(runStable(fixture, project, ['init', '--host', 'ide']).status, 0);
    const target = path.join(project, '.trae', 'mcp.json');
    const config = JSON.parse(fs.readFileSync(target, 'utf8'));
    config.mcpServers.lazytrae.args.push('--caller-edit');
    const before = `${JSON.stringify(config, null, 2)}\n`;
    fs.writeFileSync(target, before);

    const synced = runStable(fixture, project, ['sync']);

    assert.notEqual(synced.status, 0);
    assert.match(`${synced.stdout}${synced.stderr}`, /modified.*preserved/i);
    assert.equal(fs.readFileSync(target, 'utf8'), before);
  });

  await t.test('duplicate managed key', () => {
    const project = projectFixture(path.join(sandbox, 'duplicate'));
    assert.equal(runStable(fixture, project, ['init', '--host', 'ide']).status, 0);
    const target = path.join(project, '.trae', 'mcp.json');
    const server = declaration(project);
    const before = `{"mcpServers":{"lazytrae":${JSON.stringify(server)},"lazytrae":${JSON.stringify(server)}}}\n`;
    fs.writeFileSync(target, before);

    const synced = runStable(fixture, project, ['sync']);

    assert.notEqual(synced.status, 0);
    assert.match(`${synced.stdout}${synced.stderr}`, /duplicate/i);
    assert.equal(fs.readFileSync(target, 'utf8'), before);
  });

  await t.test('JSONC comment', () => {
    const project = projectFixture(path.join(sandbox, 'jsonc'));
    const target = path.join(project, '.trae', 'mcp.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const before = '{\n  // caller comment\n  "mcpServers": {}\n}\n';
    fs.writeFileSync(target, before);

    const synced = runStable(fixture, project, ['sync']);

    assert.notEqual(synced.status, 0);
    assert.match(`${synced.stdout}${synced.stderr}`, /invalid.*mcp\.json/i);
    assert.equal(fs.readFileSync(target, 'utf8'), before);
  });

  await t.test('symlinked config', () => {
    const project = projectFixture(path.join(sandbox, 'symlink'));
    const target = path.join(project, '.trae', 'mcp.json');
    const outside = path.join(sandbox, 'outside.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(outside, '{"mcpServers":{}}\n');
    fs.symlinkSync(outside, target);

    const synced = runStable(fixture, project, ['sync']);

    assert.notEqual(synced.status, 0);
    assert.equal(fs.readFileSync(outside, 'utf8'), '{"mcpServers":{}}\n');
  });
});

test('lifecycle status reports a removed recorded runtime as stale without substitution', (t) => {
  // Given: a ready durable bundle whose recorded runtime path is removed from active state.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae stale runtime '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const fixture = durableFixture(sandbox, 'durable root', 'e');
  const project = projectFixture(sandbox);
  const active = JSON.parse(fs.readFileSync(fixture.paths.active, 'utf8'));
  active.runtime_path = path.join(sandbox, 'removed-node');
  fs.writeFileSync(fixture.paths.active, `${JSON.stringify(active, null, 2)}\n`);

  // When: project-scoped lifecycle status inspects the installation.
  const status = runCli([
    'lifecycle', 'status', '--install-root', path.dirname(fixture.paths.productRoot),
    '--project', project, '--json',
  ], { cwd: project });
  const report = JSON.parse(status.stdout);

  // Then: status fails closed and never substitutes a PATH runtime.
  assert.equal(status.status, 1);
  assert.equal(report.package_readiness.status, 'blocked');
  assert.equal(report.package_readiness.issues.some(issue => issue.code === 'STALE_RUNTIME'), true);
});
