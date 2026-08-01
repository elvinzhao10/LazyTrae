const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CLI, runCli, toolingHostBin } = require('./test-helpers');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function snapshot(root) {
  return Object.fromEntries(['package.json', 'package-lock.json', 'pyproject.toml', 'Makefile', '.gitignore'].map(name => {
    const target = path.join(root, name);
    return [name, fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null];
  }));
}

function runCliWithHost(args, cwd, bin) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  });
}

test('tooling verify reports exact declared npm, Python, and Make plans without running them', () => {
  const npmRoot = makeRepo('lazytrae-tooling-npm-');
  const pythonRoot = makeRepo('lazytrae-tooling-python-');
  const makeRoot = makeRepo('lazytrae-tooling-make-');
  try {
    fs.writeFileSync(path.join(npmRoot, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint .', test: 'node test.js', evil: 'touch pwned' } }) + '\n');
    fs.writeFileSync(path.join(npmRoot, 'package-lock.json'), '{"lockfileVersion":3}\n');
    fs.writeFileSync(path.join(pythonRoot, 'pyproject.toml'), '[tool.ruff]\n[tool.pytest.ini_options]\n');
    fs.writeFileSync(path.join(makeRoot, 'Makefile'), 'lint:\n\t@true\ntest:\n\t@true\nevil:\n\t@touch pwned\n');
    const npm = runCli(['tooling', 'verify', '--dry-run'], { cwd: npmRoot });
    const python = runCli(['tooling', 'verify', '--dry-run'], { cwd: pythonRoot });
    const make = runCli(['tooling', 'verify', '--dry-run'], { cwd: makeRoot });

    assert.equal(npm.status, 0, npm.stderr);
    assert.match(npm.stdout, /npm run lint/);
    assert.match(npm.stdout, /npm run test/);
    assert.doesNotMatch(npm.stdout, /evil|pwned/);
    assert.equal(python.status, 0, python.stderr);
    assert.match(python.stdout, /python -m ruff check \./);
    assert.match(python.stdout, /python -m pytest/);
    assert.equal(make.status, 0, make.stderr);
    assert.match(make.stdout, /make lint/);
    assert.match(make.stdout, /make test/);
    assert.doesNotMatch(make.stdout, /evil|pwned/);
    assert.equal(fs.existsSync(path.join(npmRoot, 'pwned')), false);
    assert.equal(fs.existsSync(path.join(makeRoot, 'pwned')), false);
  } finally {
    fs.rmSync(npmRoot, { recursive: true, force: true });
    fs.rmSync(pythonRoot, { recursive: true, force: true });
    fs.rmSync(makeRoot, { recursive: true, force: true });
  }
});

test('tooling verify executes only an explicit declared selection and propagates its failure', () => {
  const root = makeRepo('lazytrae-tooling-run-');
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(7)"', evil: 'touch pwned' } }) + '\n');
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
    const before = snapshot(root);
    const missingSelection = runCli(['tooling', 'verify', '--run'], { cwd: root });
    const injected = runCli(['tooling', 'verify', '--run', 'evil'], { cwd: root });
    const malformed = runCli(['tooling', 'verify', '--dry-run', 'test'], { cwd: root });
    const failing = runCli(['tooling', 'verify', '--run', 'test'], { cwd: root });

    assert.equal(missingSelection.status, 1);
    assert.equal(injected.status, 1);
    assert.equal(malformed.status, 1);
    assert.equal(failing.status, 7, failing.stderr);
    assert.equal(fs.existsSync(path.join(root, 'pwned')), false);
    assert.deepEqual(snapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tooling verify keeps npm runtime state out of the caller HOME', () => {
  const root = makeRepo('lazytrae-tooling-npm-home-');
  const sentinelHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-tooling-sentinel-home-'));
  try {
    // Given: a declared npm lint and test workflow with an otherwise empty caller HOME.
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { lint: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"' } }) + '\n');
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');

    // When: explicit repository-native npm verification runs.
    const verified = runCli(['tooling', 'verify', '--run', 'lint', 'test'], { cwd: root, env: { ...process.env, HOME: sentinelHome } });

    // Then: the native checks retain their requested semantics without creating caller HOME state.
    assert.equal(verified.status, 0, verified.stderr);
    assert.deepEqual(fs.readdirSync(sentinelHome), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(sentinelHome, { recursive: true, force: true });
  }
});

test('tooling verify leaves unsupported projects untouched and tooling reports search capability readiness', () => {
  const root = makeRepo('lazytrae-tooling-unsupported-');
  const toolingRoot = path.join(root, 'tooling-root');
  try {
    fs.writeFileSync(path.join(root, '.gitignore'), '# user-owned dirty change\n');
    const before = snapshot(root);
    const unsupported = runCli(['tooling', 'verify', '--dry-run'], { cwd: root });
    const bin = toolingHostBin(root, { rg: 'ripgrep 13.0.0', sg: 'ast-grep 0.43.0' });
    const installed = runCliWithHost(['tooling', 'install', '--tooling-root', toolingRoot], root, bin);
    const detected = runCliWithHost(['tooling', 'detect', '--tooling-root', toolingRoot], root, bin);

    assert.equal(unsupported.status, 1);
    assert.match(unsupported.stdout + unsupported.stderr, /unsupported/i);
    assert.deepEqual(snapshot(root), before);
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(detected.status, 0, detected.stderr);
    assert.match(detected.stdout, /ripgrep: owned/);
    assert.match(detected.stdout, /ast-grep: owned/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tooling install keeps compatible host providers outside the owned root', () => {
  const root = makeRepo('lazytrae-tooling-host-ready-');
  const toolingRoot = path.join(root, 'tooling-root');
  try {
    const bin = toolingHostBin(root, { rg: 'ripgrep 14.1.0', sg: 'ast-grep 0.45.0' });
    const installed = runCliWithHost(['tooling', 'install', '--tooling-root', toolingRoot], root, bin);
    const detected = runCliWithHost(['tooling', 'detect', '--tooling-root', toolingRoot], root, bin);
    const status = runCliWithHost(['tooling', 'status', '--tooling-root', toolingRoot], root, bin);

    assert.equal(installed.status, 0, installed.stderr);
    assert.match(installed.stdout, /No provisioning required/);
    assert.equal(fs.existsSync(toolingRoot), false);
    assert.equal(detected.status, 0, detected.stderr);
    assert.equal(status.status, 0, status.stderr);
    assert.match(detected.stdout, /ripgrep: host \(ready\)/);
    assert.match(detected.stdout, /ast-grep: host \(ready\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tooling install provisions only missing or incompatible providers and records only owned capabilities', () => {
  const root = makeRepo('lazytrae-tooling-selective-');
  const toolingRoot = path.join(root, 'tooling-root');
  try {
    const bin = toolingHostBin(root, { rg: 'ripgrep 14.1.0', sg: 'ast-grep 0.43.0' });
    const installed = runCliWithHost(['tooling', 'install', '--tooling-root', toolingRoot], root, bin);
    const detected = runCliWithHost(['tooling', 'detect', '--tooling-root', toolingRoot], root, bin);
    const receipt = JSON.parse(fs.readFileSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json'), 'utf8'));

    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(detected.status, 0, detected.stderr);
    assert.match(detected.stdout, /ripgrep: host \(ready\)/);
    assert.match(detected.stdout, /ast-grep: owned \(ready\)/);
    assert.equal(fs.existsSync(path.join(toolingRoot, 'node_modules', '@vscode', 'ripgrep')), false);
    assert.deepEqual(receipt.provisioned_capabilities, ['ast-grep']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tooling install replaces incompatible host providers with pinned owned fallbacks', () => {
  const root = makeRepo('lazytrae-tooling-host-incompatible-');
  const toolingRoot = path.join(root, 'tooling-root');
  try {
    const bin = toolingHostBin(root, { rg: 'ripgrep 13.0.0', sg: 'ast-grep 0.43.0' });
    const installed = runCliWithHost(['tooling', 'install', '--tooling-root', toolingRoot], root, bin);
    const detected = runCliWithHost(['tooling', 'detect', '--tooling-root', toolingRoot], root, bin);
    const receipt = JSON.parse(fs.readFileSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json'), 'utf8'));

    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(detected.status, 0, detected.stderr);
    assert.match(detected.stdout, /ripgrep: owned \(ready\)/);
    assert.match(detected.stdout, /ast-grep: owned \(ready\)/);
    assert.deepEqual(receipt.provisioned_capabilities, ['ripgrep', 'ast-grep']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
