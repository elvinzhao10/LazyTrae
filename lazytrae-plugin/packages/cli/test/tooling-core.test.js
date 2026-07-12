const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

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

test('tooling verify leaves unsupported projects untouched and tooling reports search capability readiness', () => {
  const root = makeRepo('lazytrae-tooling-unsupported-');
  const toolingRoot = path.join(root, 'tooling-root');
  try {
    fs.writeFileSync(path.join(root, '.gitignore'), '# user-owned dirty change\n');
    const before = snapshot(root);
    const unsupported = runCli(['tooling', 'verify', '--dry-run'], { cwd: root });
    const installed = runCli(['tooling', 'install', '--tooling-root', toolingRoot], { cwd: root });
    const detected = runCli(['tooling', 'detect', '--tooling-root', toolingRoot], { cwd: root });

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
