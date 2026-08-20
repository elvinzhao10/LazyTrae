const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(PACKAGE_ROOT, 'bin', 'lazytrae.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: options.cwd || PACKAGE_ROOT,
    encoding: 'utf8',
  });
}

test('package self-verification uses only the extracted CLI runtime', () => {
  // Given: an npm package root with no source-monorepo sibling.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-packaged-self-test-'));
  fs.mkdirSync(path.join(project, '.git'));
  try {
    // When: the shipped CLI is used for its help and an IDE project initialization.
    const runtime = fs.realpathSync(CLI);
    const relativeRuntime = path.relative(PACKAGE_ROOT, runtime);
    const help = runCli(['--help']);
    const init = runCli(['--root', project, 'init', '--host', 'ide']);
    const doctor = runCli(['--root', project, 'doctor']);

    // Then: every executed runtime path is package-local and the package works without checkout files.
    assert.equal(relativeRuntime.startsWith(`..${path.sep}`) || path.isAbsolute(relativeRuntime), false);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /lazytrae/);
    assert.equal(init.status, 0, init.stderr);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.equal(fs.existsSync(path.join(project, '.trae', 'mcp.json')), true);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
