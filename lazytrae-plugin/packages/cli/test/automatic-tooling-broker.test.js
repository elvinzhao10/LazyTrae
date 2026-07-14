const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawn, spawnSync } = require('node:child_process');
const { CLI, runCli } = require('./test-helpers');

function repository(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  require('node:child_process').spawnSync('git', ['init', '-q'], { cwd: root });
  require('node:child_process').spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  require('node:child_process').spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  fs.writeFileSync(path.join(root, 'needle.txt'), 'TODO broker proof\n');
  require('node:child_process').spawnSync('git', ['add', '.'], { cwd: root });
  require('node:child_process').spawnSync('git', ['commit', '-qm', 'fixture'], { cwd: root });
  return root;
}

function trackedState(root) {
  return Object.fromEntries(['.trae/mcp.json', '.lazytrae/state/tooling.json', 'package-lock.json'].map(name => {
    const file = path.join(root, name);
    return [name, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null];
  }));
}

test('automatic capability run searches with an ephemeral owned receipt and never mutates project configuration', () => {
  const root = repository('lazytrae-broker-search-');
  const toolpack = path.join(root, 'empty-toolpack');
  try {
    fs.mkdirSync(path.join(root, '.trae'), { recursive: true });
    fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
    fs.writeFileSync(path.join(root, '.trae', 'mcp.json'), '{"caller":"unchanged"}\n');
    fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'tooling.json'), '{"caller":"unchanged"}\n');
    require('node:child_process').spawnSync('git', ['add', '.'], { cwd: root });
    require('node:child_process').spawnSync('git', ['commit', '-qm', 'configuration'], { cwd: root });
    const before = trackedState(root);

    const result = runCli(['tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', toolpack], { cwd: root });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.capability, 'local_search');
    assert.equal(output.provider, 'ripgrep');
    assert.equal(output.receipt.owner, 'lazytrae-tooling');
    assert.match(output.result, /TODO broker proof/);
    assert.equal(fs.existsSync(toolpack), false);
    assert.deepEqual(trackedState(root), before);
    assert.equal(require('node:child_process').spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout, '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic capability run rejects unknown capabilities without creating a toolpack', () => {
  const root = repository('lazytrae-broker-unknown-');
  const toolpack = path.join(root, 'empty-toolpack');
  try {
    const result = runCli(['tooling', 'capability', 'run', 'not_a_capability', '--query', 'TODO', '--toolpack', toolpack], { cwd: root });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AUTOMATIC_TOOLING_UNKNOWN_CAPABILITY/);
    assert.equal(fs.existsSync(toolpack), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic capability run rejects malformed input, stale toolpacks, and dirty workspaces without mutation', () => {
  const root = repository('lazytrae-broker-boundaries-');
  const stale = path.join(root, 'stale-toolpack');
  const malformed = path.join(root, 'malformed-toolpack');
  try {
    fs.mkdirSync(stale);
    fs.writeFileSync(path.join(stale, 'lazytrae-tooling-receipt.json'), '{}\n');
    const staleResult = runCli(['tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', stale], { cwd: root });
    const malformedResult = runCli(['tooling', 'capability', 'run', 'local_search', '--toolpack', malformed], { cwd: root });
    fs.writeFileSync(path.join(root, 'dirty.txt'), 'dirty\n');
    const dirtyResult = runCli(['tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', path.join(root, 'dirty-toolpack')], { cwd: root });
    assert.equal(staleResult.status, 1);
    assert.match(staleResult.stderr, /must be empty/);
    assert.equal(malformedResult.status, 1);
    assert.match(malformedResult.stderr, /requires --query/);
    assert.equal(dirtyResult.status, 1);
    assert.match(dirtyResult.stderr, /AUTOMATIC_TOOLING_PERMISSION_DENIED/);
    assert.equal(fs.existsSync(path.join(root, 'dirty-toolpack')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic capability run cleans the owned toolpack after a bounded timeout', () => {
  const root = repository('lazytrae-broker-timeout-');
  const toolpack = path.join(root, 'empty-toolpack');
  const bin = path.join(root, 'bin');
  try {
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rg'), "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then printf 'ripgrep 14.0.0\\n'; else exec sleep 5; fi\n");
    fs.chmodSync(path.join(bin, 'rg'), 0o755);
    require('node:child_process').spawnSync('git', ['add', '.'], { cwd: root });
    require('node:child_process').spawnSync('git', ['commit', '-qm', 'fake-ripgrep'], { cwd: root });
    const result = runCli(['tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', toolpack, '--timeout-ms', '20'], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AUTOMATIC_TOOLING_TIMEOUT/);
    assert.equal(fs.existsSync(toolpack), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

function waitFor(file) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 2000;
    const timer = setInterval(() => {
      if (fs.existsSync(file)) { clearInterval(timer); resolve(); }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error(`timed out waiting for ${file}`)); }
    }, 10);
  });
}

test('automatic structural search uses ast-grep 0.44 stream JSON output', () => {
  const root = repository('lazytrae-broker-structural-');
  const toolpack = path.join(root, 'empty-toolpack');
  try {
    fs.writeFileSync(path.join(root, 'needle.js'), 'const TODO = 1;\n');
    spawnSync('git', ['add', '.'], { cwd: root });
    spawnSync('git', ['commit', '-qm', 'structural-fixture'], { cwd: root });
    const result = runCli(['tooling', 'capability', 'run', 'structural_search', '--query', 'TODO', '--toolpack', toolpack], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.provider, 'ast_grep');
    assert.match(output.result, /TODO/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic capability timeout kills a provider grandchild before removing its toolpack', async () => {
  const root = repository('lazytrae-broker-tree-timeout-');
  const toolpack = path.join(root, 'empty-toolpack');
  const bin = path.join(root, 'bin');
  const pidFile = path.join(root, 'grandchild.pid');
  try {
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rg'), `#!/bin/sh\nif [ "$1" = "--version" ]; then printf 'ripgrep 14.0.0\\n'; else sleep 30 & echo $! > '${pidFile}'; wait; fi\n`);
    fs.chmodSync(path.join(bin, 'rg'), 0o755);
    spawnSync('git', ['add', '.'], { cwd: root });
    spawnSync('git', ['commit', '-qm', 'tree-timeout-fixture'], { cwd: root });
    const result = runCli(['tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', toolpack, '--timeout-ms', '50'], { cwd: root, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    assert.equal(result.status, 1);
    await waitFor(pidFile);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(alive(pid), false, `grandchild ${pid} survived timeout`);
    assert.equal(fs.existsSync(toolpack), false);
  } finally {
    if (fs.existsSync(pidFile)) { const pid = Number(fs.readFileSync(pidFile, 'utf8')); if (alive(pid)) process.kill(pid, 'SIGKILL'); }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic capability SIGINT kills a provider tree without waiting for its timeout', async () => {
  const root = repository('lazytrae-broker-tree-signal-');
  const toolpack = path.join(root, 'empty-toolpack');
  const bin = path.join(root, 'bin');
  const pidFile = path.join(root, 'grandchild.pid');
  try {
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rg'), `#!/bin/sh\nif [ "$1" = "--version" ]; then printf 'ripgrep 14.0.0\\n'; else sleep 30 & echo $! > '${pidFile}'; wait; fi\n`);
    fs.chmodSync(path.join(bin, 'rg'), 0o755);
    spawnSync('git', ['add', '.'], { cwd: root });
    spawnSync('git', ['commit', '-qm', 'tree-signal-fixture'], { cwd: root });
    const started = Date.now();
    const child = spawn(process.execPath, [CLI, 'tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', toolpack], { cwd: root, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    await waitFor(pidFile);
    child.kill('SIGINT');
    const [code] = await new Promise(resolve => child.once('close', (exitCode) => resolve([exitCode])));
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(code, 130);
    assert.ok(Date.now() - started < 2000, 'SIGINT waited for the default timeout');
    assert.equal(alive(pid), false, `grandchild ${pid} survived SIGINT`);
    assert.equal(fs.existsSync(toolpack), false);
  } finally {
    if (fs.existsSync(pidFile)) { const pid = Number(fs.readFileSync(pidFile, 'utf8')); if (alive(pid)) process.kill(pid, 'SIGKILL'); }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic capability stdin closure kills a provider tree without waiting for its timeout', async () => {
  const root = repository('lazytrae-broker-tree-stdin-');
  const toolpack = path.join(root, 'empty-toolpack');
  const bin = path.join(root, 'bin');
  const pidFile = path.join(root, 'grandchild.pid');
  try {
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rg'), `#!/bin/sh\nif [ "$1" = "--version" ]; then printf 'ripgrep 14.0.0\\n'; else sleep 30 & echo $! > '${pidFile}'; wait; fi\n`);
    fs.chmodSync(path.join(bin, 'rg'), 0o755);
    spawnSync('git', ['add', '.'], { cwd: root });
    spawnSync('git', ['commit', '-qm', 'tree-stdin-fixture'], { cwd: root });
    const started = Date.now();
    const child = spawn(process.execPath, [CLI, 'tooling', 'capability', 'run', 'local_search', '--query', 'TODO', '--toolpack', toolpack], { cwd: root, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    await waitFor(pidFile);
    await new Promise(resolve => setTimeout(resolve, 125));
    child.stdin.end();
    const [code] = await new Promise(resolve => child.once('close', (exitCode) => resolve([exitCode])));
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(code, 130);
    assert.ok(Date.now() - started < 2000, 'stdin closure waited for the default timeout');
    assert.equal(alive(pid), false, `grandchild ${pid} survived stdin closure`);
    assert.equal(fs.existsSync(toolpack), false);
  } finally {
    if (fs.existsSync(pidFile)) { const pid = Number(fs.readFileSync(pidFile, 'utf8')); if (alive(pid)) process.kill(pid, 'SIGKILL'); }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
