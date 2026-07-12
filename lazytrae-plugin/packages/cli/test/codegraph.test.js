const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');
const { listOwnedEntries, writeReceipt } = require('../src/lib/tooling-root');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function writeOwnedCodeGraph(root) {
  const binary = path.join(root, 'node_modules', '@colbymchenry', 'codegraph', 'npm-shim.js');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, `#!/usr/bin/env node
if (process.argv.slice(2).join(' ') !== 'serve --mcp') process.exit(9);
if (process.env.CODEGRAPH_NO_DOWNLOAD !== '1') process.exit(10);
let buffer = '';
process.stdin.on('data', chunk => { buffer += chunk; });
process.stdin.on('end', () => {
  for (const line of buffer.trim().split('\\n')) {
    if (!line) continue;
    const request = JSON.parse(line);
    if (request.method === 'initialize') console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { serverInfo: { name: 'codegraph-fixture' } } }));
  }
});
`);
  fs.chmodSync(binary, 0o755);
  const bin = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.symlinkSync('../@colbymchenry/codegraph/npm-shim.js', path.join(bin, 'codegraph'));
  writeReceipt(root, listOwnedEntries(root), ['codegraph']);
}

test('CodeGraph remains disabled and non-mutating until an explicitly initialized project is enabled', () => {
  const root = makeRepo('lazytrae-codegraph-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: a fresh LazyTrae project with a small source tree and no CodeGraph installation or index.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    fs.writeFileSync(path.join(root, 'source.js'), 'export const answer = 42;\n');
    const mcpPath = path.join(root, '.trae', 'mcp.json');
    const beforeMcp = fs.readFileSync(mcpPath, 'utf8');

    // When: CodeGraph doctor and enable are requested before the explicit prerequisites exist.
    const doctor = runCli(['tooling', 'codegraph-doctor', '--target', root, '--tooling-root', toolingRoot], { cwd: root });
    const enable = runCli(['tooling', 'codegraph-enable', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: doctor is non-blocking, no index/process/config is created, and enable explains the unavailable prerequisite.
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /STATE: missing/);
    assert.match(doctor.stdout, /RECOMMENDATION: not recommended/);
    assert.equal(enable.status, 1);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
    assert.equal(fs.readFileSync(mcpPath, 'utf8'), beforeMcp);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph doctor recommends only a target that crosses the supported source threshold', () => {
  const root = makeRepo('lazytrae-codegraph-threshold-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: a project with exactly the file-count threshold and no optional tooling root.
    for (let index = 0; index < 500; index += 1) fs.writeFileSync(path.join(root, `source-${index}.js`), 'export {};\n');

    // When: doctor counts supported source files without provision or initialization.
    const doctor = runCli(['tooling', 'codegraph-doctor', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: the recommendation changes while the optional tool and index remain absent.
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /RECOMMENDATION: recommended/);
    assert.equal(fs.existsSync(toolingRoot), false);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit CodeGraph enable preserves user MCP configuration and launches only the owned serve process', () => {
  const root = makeRepo('lazytrae-codegraph-enabled-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: a caller-owned same-name MCP entry before init, plus a graph index and receipt-owned CodeGraph binary.
    const mcpPath = path.join(root, '.trae', 'mcp.json');
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: { codegraph: { command: 'caller-codegraph', args: ['serve'] } } }, null, 2) + '\n');
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(mcpPath, 'utf8')).mcpServers.codegraph, { command: 'caller-codegraph', args: ['serve'] });
    fs.mkdirSync(path.join(root, '.codegraph'));
    writeOwnedCodeGraph(toolingRoot);
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    mcp.mcpServers.user_owned = { command: 'caller-mcp', args: ['serve'] };
    fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + '\n');

    // When: the capability is explicitly enabled, synced, and reached through its separate stdio MCP process.
    const enabled = runCli(['tooling', 'codegraph-enable', '--target', root, '--tooling-root', toolingRoot], { cwd: root });
    const synced = runCli(['sync'], { cwd: root });
    const syncedMcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    fs.rmSync(mcpPath);
    const restored = runCli(['sync'], { cwd: root });
    const initialized = runCli(['codegraph', '--target', root, '--tooling-root', toolingRoot], {
      cwd: root,
      input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n',
    });

    // Then: the caller's same-name entry and the namespaced managed entry persist, and the proxy only runs `serve --mcp`.
    assert.equal(enabled.status, 0, enabled.stderr);
    assert.equal(synced.status, 0, synced.stderr);
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.match(initialized.stdout, /codegraph-fixture/);
    const next = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    assert.deepEqual(syncedMcp.mcpServers.user_owned, { command: 'caller-mcp', args: ['serve'] });
    assert.deepEqual(syncedMcp.mcpServers.codegraph, { command: 'caller-codegraph', args: ['serve'] });
    const canonicalRoot = fs.realpathSync(root);
    assert.deepEqual(next.mcpServers.lazytrae_codegraph, {
      command: 'lazytrae',
      args: ['codegraph', '--target', canonicalRoot, '--tooling-root', toolingRoot],
      required: false,
      description: 'Optional receipt-owned CodeGraph MCP bridge. Enable only after you create the project-local .codegraph index.',
    });
    const state = JSON.parse(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'tooling.json'), 'utf8'));
    assert.deepEqual(state.capabilities.codegraph, {
      enabled: true,
      state: 'ready',
      tooling_root: toolingRoot,
      index_ownership: 'preexisting',
    });

    const uninstalled = runCli(['tooling', 'codegraph-uninstall', '--target', root, '--tooling-root', toolingRoot], { cwd: root });
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    assert.equal(fs.existsSync(path.join(root, '.codegraph')), true, 'caller-owned index must survive uninstall');
    assert.equal(fs.existsSync(toolingRoot), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph rejects symlinked targets and unsafe uninstall roots without touching caller files', () => {
  const root = makeRepo('lazytrae-codegraph-safety-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-codegraph-outside-'));
  const linked = path.join(root, 'linked-target');
  fs.symlinkSync(outside, linked);
  try {
    // Given: a symlink target and a caller-owned non-receipt tooling directory.
    const callerRoot = path.join(root, 'caller-root');
    fs.mkdirSync(callerRoot);
    fs.writeFileSync(path.join(callerRoot, 'keep'), 'caller data\n');

    // When: status and uninstall receive unsafe ownership boundaries.
    const status = runCli(['tooling', 'codegraph-status', '--target', linked, '--tooling-root', callerRoot], { cwd: root });
    const uninstall = runCli(['tooling', 'codegraph-uninstall', '--target', root, '--tooling-root', callerRoot], { cwd: root });

    // Then: both fail before any deletion or graph initialization.
    assert.equal(status.status, 1);
    assert.equal(uninstall.status, 1);
    assert.equal(fs.readFileSync(path.join(callerRoot, 'keep'), 'utf8'), 'caller data\n');
    assert.equal(fs.existsSync(path.join(outside, '.codegraph')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
