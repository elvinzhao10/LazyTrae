const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');
const { listOwnedEntries, prepareOwnedRuntime, writeReceipt } = require('../src/lib/tooling-root');
const LOCAL_LAUNCHER = path.resolve(__dirname, '..', 'bin', 'lazytrae.js');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function writeOwnedCodeGraph(root, options = {}) {
  const { persistent = false, descendantIgnoresTerm = false, statusSucceedsWithoutDatabase = false } = options;
  const binary = path.join(root, 'node_modules', '@colbymchenry', 'codegraph', 'npm-shim.js');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const command = process.argv.slice(2).join(' ');
if (process.env.CODEGRAPH_NO_DOWNLOAD !== '1') process.exit(10);
if (process.env.CODEGRAPH_TELEMETRY !== '0') process.exit(11);
if (!process.env.HOME.includes(path.join('runtime', 'home'))) process.exit(12);
if (command === 'serve --mcp' && process.env.CODEGRAPH_NO_DAEMON !== '1') process.exit(14);
if (command.startsWith('status ')) {
  process.exit(${statusSucceedsWithoutDatabase ? '0' : "fs.existsSync(path.join(process.cwd(), '.codegraph', 'codegraph.db')) ? 0 : 13"});
}
if (command === 'init .') {
  fs.mkdirSync(path.join(process.cwd(), '.codegraph'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), '.codegraph', 'codegraph.db'), 'SQLite format 3\\u0000caller-managed index\\n');
  process.exit(0);
}
if (command !== 'serve --mcp') process.exit(9);
if (${persistent}) {
  const { spawn } = require('child_process');
  const descendant = spawn(process.execPath, ['-e', ${descendantIgnoresTerm ? "'process.on(\\\"SIGTERM\\\", () => {}); setInterval(() => {}, 1000)'" : "'setInterval(() => {}, 1000)'"}], { stdio: 'ignore' });
  fs.writeFileSync(process.env.LAZYTRAE_TEST_PID_FILE, JSON.stringify({ pid: process.pid, descendantPid: descendant.pid }));
  setInterval(() => {}, 1000);
  return;
}
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
  prepareOwnedRuntime(root);
  writeReceipt(root, listOwnedEntries(root), ['codegraph']);
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForFile(filePath) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (fs.existsSync(filePath)) return;
    await wait(20);
  }
  throw new Error(`timed out waiting for ${filePath}`);
}

function waitForChildExit(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for CodeGraph bridge exit')), 3_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function stopCodeGraphBridge(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await waitForChildExit(child);
}

function processIsAlive(pid, platform = process.platform, procRoot = '/proc') {
  try {
    process.kill(pid, 0);
    if (platform === 'linux') {
      try {
        const stat = fs.readFileSync(path.join(procRoot, String(pid), 'stat'), 'utf8');
        const closingParenthesis = stat.lastIndexOf(')');
        if (closingParenthesis !== -1 && stat[closingParenthesis + 2] === 'Z') return false;
      } catch (error) {
        if (error && error.code === 'ENOENT') return false;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

test('CodeGraph cleanup treats a Linux zombie as terminated', (t) => {
  const procRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-codegraph-proc-'));
  t.after(() => fs.rmSync(procRoot, { recursive: true, force: true }));
  const pid = process.pid;
  const processDirectory = path.join(procRoot, String(pid));
  fs.mkdirSync(processDirectory);
  fs.writeFileSync(path.join(processDirectory, 'stat'), `${pid} (node) Z 0 0 0 0 0 0 0 0 0 0 0\n`);
  assert.equal(processIsAlive(pid, 'linux', procRoot), false);
});

function startCodeGraph(target, toolingRoot, pidPath) {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js'), 'codegraph', '--target', target, '--tooling-root', toolingRoot], {
    cwd: target,
    env: { ...process.env, LAZYTRAE_TEST_PID_FILE: pidPath },
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
  return child;
}

function killRecordedProcess(pidPath) {
  if (!fs.existsSync(pidPath)) return;
  const record = JSON.parse(fs.readFileSync(pidPath, 'utf8'));
  for (const pid of [record.pid, record.descendantPid]) {
    if (Number.isInteger(pid) && processIsAlive(pid)) process.kill(pid, 'SIGKILL');
  }
}

function writeFakeNpm(root) {
  const binary = path.join(root, 'bin', 'npm');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const runtime = path.dirname(process.env.HOME);
if (fs.realpathSync(path.dirname(runtime)) !== fs.realpathSync(process.cwd())) process.exit(7);
const expected = {
  HOME: path.join(runtime, 'home'),
  npm_config_cache: path.join(runtime, 'npm-cache'),
  npm_config_logs_dir: path.join(runtime, 'npm-logs'),
  XDG_CACHE_HOME: path.join(runtime, 'cache'),
  PYTHONPYCACHEPREFIX: path.join(runtime, 'python-pycache'),
  CODEGRAPH_TELEMETRY: '0',
};
if (Object.entries(expected).some(([name, value]) => process.env[name] !== value)) process.exit(7);
const executable = path.join(process.cwd(), 'node_modules', '@colbymchenry', 'codegraph', 'npm-shim.js');
fs.mkdirSync(path.dirname(executable), { recursive: true });
fs.writeFileSync(executable, '#!/usr/bin/env node\\nprocess.exit(0);\\n');
fs.chmodSync(executable, 0o755);
const bin = path.join(process.cwd(), 'node_modules', '.bin');
fs.mkdirSync(bin, { recursive: true });
fs.symlinkSync('../@colbymchenry/codegraph/npm-shim.js', path.join(bin, 'codegraph'));
`);
  fs.chmodSync(binary, 0o755);
  return path.dirname(binary);
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

test('CodeGraph install confines npm and runtime state to the receipt-owned root', () => {
  const root = makeRepo('lazytrae-codegraph-runtime-');
  const toolingRoot = path.join(root, 'tooling');
  const sentinelHome = path.join(root, 'sentinel-home');
  fs.mkdirSync(sentinelHome);
  const fakeBin = writeFakeNpm(root);
  try {
    // Given: a caller HOME sentinel and an npm replacement that verifies child-process state paths.
    const result = runCli(['tooling', 'codegraph-install', '--target', root, '--tooling-root', toolingRoot], {
      cwd: root,
      env: { ...process.env, HOME: sentinelHome, PATH: `${fakeBin}${path.delimiter}${process.env.PATH}` },
    });

    // When: the package-owned CodeGraph installation is requested.

    // Then: install succeeds without host-state writes and creates a contained runtime directory.
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(sentinelHome), []);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'runtime', 'home')), true);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph enable rejects an empty caller-owned index before changing MCP state', () => {
  const root = makeRepo('lazytrae-codegraph-empty-index-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: a receipt-owned executable and a caller-created but uninitialized graph directory.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    fs.mkdirSync(path.join(root, '.codegraph'));
    writeOwnedCodeGraph(toolingRoot);
    const mcpPath = path.join(root, '.trae', 'mcp.json');
    const beforeMcp = fs.readFileSync(mcpPath, 'utf8');

    // When: enabling checks the candidate index.
    const enabled = runCli(['tooling', 'codegraph-enable', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: empty directories are refused and the caller-owned index/configuration remain untouched.
    assert.equal(enabled.status, 1);
    assert.match(enabled.stderr, /run lazytrae tooling codegraph-init/i);
    assert.equal(fs.readFileSync(mcpPath, 'utf8'), beforeMcp);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'tooling.json'), 'utf8')).capabilities.codegraph, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph rejects a cached status response without the requested target database', () => {
  const root = makeRepo('lazytrae-codegraph-target-database-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: an empty target-local graph directory and a provider that falsely reports a cached index as ready.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    fs.mkdirSync(path.join(root, '.codegraph'));
    writeOwnedCodeGraph(toolingRoot, { statusSucceedsWithoutDatabase: true });

    // When: CodeGraph enable is requested for this exact target.
    const enabled = runCli(['tooling', 'codegraph-enable', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: a provider response alone cannot authorize an unrelated or missing target index.
    assert.equal(enabled.status, 1);
    assert.match(enabled.stderr, /codegraph-init/i);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'tooling.json'), 'utf8')).capabilities.codegraph, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph uninstall accepts only expected mutable runtime files', () => {
  const root = makeRepo('lazytrae-codegraph-mutable-runtime-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: a valid receipt root with post-install CodeGraph daemon/update and npm log files.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    writeOwnedCodeGraph(toolingRoot);
    const runtime = path.join(toolingRoot, 'runtime');
    fs.mkdirSync(path.join(runtime, 'home', '.codegraph', 'daemons'), { recursive: true });
    fs.writeFileSync(path.join(runtime, 'home', '.codegraph', 'daemons', 'target.json'), '{}\n');
    fs.writeFileSync(path.join(runtime, 'home', '.codegraph', 'update-check.json'), '{}\n');
    fs.writeFileSync(path.join(runtime, 'npm-logs', '2026-07-12T12_00_00_000Z-debug-0.log'), 'npm log\n');

    // When: the owned CodeGraph root is uninstalled.
    const result = runCli(['tooling', 'codegraph-uninstall', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: only the receipt root is removed and the caller project remains intact.
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(toolingRoot), false);
    assert.equal(fs.existsSync(path.join(root, '.trae')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CodeGraph uninstall rejects a non-runtime addition', () => {
  const root = makeRepo('lazytrae-codegraph-foreign-runtime-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: an otherwise receipt-owned root with a caller file outside the explicit mutable runtime paths.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    writeOwnedCodeGraph(toolingRoot);
    fs.writeFileSync(path.join(toolingRoot, 'caller-file'), 'preserve\n');

    // When: uninstallation is requested.
    const result = runCli(['tooling', 'codegraph-uninstall', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: the unknown file blocks removal and remains untouched.
    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(path.join(toolingRoot, 'caller-file'), 'utf8'), 'preserve\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('closing one CodeGraph MCP stream terminates only its owned process tree', async () => {
  const root = makeRepo('lazytrae-codegraph-process-tree-');
  const toolingRoot = path.join(root, 'tooling');
  const firstTarget = path.join(root, 'first');
  const secondTarget = path.join(root, 'second');
  const firstPidPath = path.join(root, 'first-pid.json');
  const secondPidPath = path.join(root, 'second-pid.json');
  let first;
  let second;
  try {
    // Given: two target-local indexes sharing one owned CodeGraph executable that keeps serving after input.
    writeOwnedCodeGraph(toolingRoot, { persistent: true });
    for (const target of [firstTarget, secondTarget]) {
      fs.mkdirSync(path.join(target, '.codegraph'), { recursive: true });
      fs.writeFileSync(path.join(target, '.codegraph', 'codegraph.db'), 'SQLite format 3\u0000fixture\n');
    }
    first = startCodeGraph(firstTarget, toolingRoot, firstPidPath);
    second = startCodeGraph(secondTarget, toolingRoot, secondPidPath);
    await Promise.all([waitForFile(firstPidPath), waitForFile(secondPidPath)]);
    const firstRecord = JSON.parse(fs.readFileSync(firstPidPath, 'utf8'));
    const secondRecord = JSON.parse(fs.readFileSync(secondPidPath, 'utf8'));

    // When: the first MCP client closes stdin.
    first.stdin.end();
    await waitForChildExit(first);

    // Then: its wrapper and process tree end while the independent target keeps serving.
    assert.notEqual(first.exitCode, null);
    assert.equal(processIsAlive(firstRecord.pid), false);
    assert.equal(processIsAlive(firstRecord.descendantPid), false);
    assert.equal(second.exitCode, null);
    assert.equal(processIsAlive(secondRecord.pid), true);
  } finally {
    await stopCodeGraphBridge(first);
    await stopCodeGraphBridge(second);
    killRecordedProcess(firstPidPath);
    killRecordedProcess(secondPidPath);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('closing a CodeGraph MCP stream force-kills a descendant that ignores SIGTERM', async () => {
  const root = makeRepo('lazytrae-codegraph-force-tree-');
  const toolingRoot = path.join(root, 'tooling');
  const target = path.join(root, 'target');
  const pidPath = path.join(root, 'pid.json');
  let bridge;
  try {
    // Given: a receipt-owned bridge whose spawned descendant ignores graceful termination.
    writeOwnedCodeGraph(toolingRoot, { persistent: true, descendantIgnoresTerm: true });
    fs.mkdirSync(path.join(target, '.codegraph'), { recursive: true });
    fs.writeFileSync(path.join(target, '.codegraph', 'codegraph.db'), 'SQLite format 3\u0000fixture\n');
    bridge = startCodeGraph(target, toolingRoot, pidPath);
    await waitForFile(pidPath);
    const record = JSON.parse(fs.readFileSync(pidPath, 'utf8'));

    // When: the MCP client closes its input stream.
    bridge.stdin.end();
    await waitForChildExit(bridge);

    // Then: the owned process group is gone even though its leader exited before the descendant.
    assert.notEqual(bridge.exitCode, null);
    assert.equal(processIsAlive(record.pid), false);
    assert.equal(processIsAlive(record.descendantPid), false);
  } finally {
    await stopCodeGraphBridge(bridge);
    killRecordedProcess(pidPath);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit CodeGraph initialization uses the contained runtime before enable', () => {
  const root = makeRepo('lazytrae-codegraph-init-');
  const toolingRoot = path.join(root, 'tooling');
  try {
    // Given: an initialized project and a receipt-owned CodeGraph executable without an index.
    assert.equal(runCli(['init'], { cwd: root }).status, 0);
    writeOwnedCodeGraph(toolingRoot);

    // When: the caller explicitly requests CodeGraph initialization.
    const initialized = runCli(['tooling', 'codegraph-init', '--target', root, '--tooling-root', toolingRoot], { cwd: root });

    // Then: the valid caller-managed index exists, while enable remains a separate explicit action.
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.equal(fs.existsSync(path.join(root, '.codegraph', 'codegraph.db')), true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'tooling.json'), 'utf8')).capabilities.codegraph, undefined);
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
    fs.writeFileSync(path.join(root, '.codegraph', 'codegraph.db'), 'SQLite format 3\u0000caller-owned index\n');
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
    const codeGraphServer = next.mcpServers.lazytrae_codegraph;
    assert.deepEqual({
      command: codeGraphServer.command,
      args: codeGraphServer.args,
      required: codeGraphServer.required,
      description: codeGraphServer.description,
    }, {
      command: 'node',
      args: [LOCAL_LAUNCHER, '--root', canonicalRoot, 'codegraph', '--target', canonicalRoot, '--tooling-root', toolingRoot],
      required: false,
      description: 'Optional receipt-owned CodeGraph MCP bridge. Enable only after you create the project-local .codegraph index.',
    });
    assert.match(codeGraphServer._lazytrae.fingerprint, /^sha256:[a-f0-9]{64}$/);
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
