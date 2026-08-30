'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');
const {
  LifecycleError,
  offboardProduct,
  prepareProductRoot,
  promoteRelease,
  stageRelease,
} = require('../src/lib/lifecycle');

const MATRIX = JSON.parse(fs.readFileSync(path.join(
  __dirname, '..', 'contracts', 'fixtures', 'lifecycle-v2', 'upgrade-ownership.json',
), 'utf8'));

test('upgrade ownership fixture covers the required lifecycle and preservation matrix', () => {
  assert.deepEqual(MATRIX.sequence, ['install', 'upgrade', 'soft_offboard', 'reinstall', 'receipt_owned_uninstall']);
  assert.deepEqual(new Set(MATRIX.preserve), new Set([
    'foreign_mcp_entry', 'unrelated_host_settings', 'soft_state',
    'modified_owned_file', 'unknown_file', 'sibling_product_root',
  ]));
});

function durableFixture(t) {
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae v120 ownership '));
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  const sourceRoot = path.join(sandbox, 'source');
  fs.mkdirSync(sourceRoot);
  const paths = prepareProductRoot({ installRoot: path.join(sandbox, 'install'), product: MATRIX.product });
  return { paths, sandbox, sourceRoot };
}

function promote(fixture, version, marker) {
  fs.writeFileSync(path.join(fixture.sourceRoot, 'package.json'), `${JSON.stringify({ version })}\n`);
  fs.writeFileSync(path.join(fixture.sourceRoot, 'entry.js'), `console.log(${JSON.stringify(version)})\n`);
  const commitSha = marker.repeat(40);
  const staged = stageRelease(fixture.paths, { sourceRoot: fixture.sourceRoot, version, commitSha });
  return promoteRelease(fixture.paths, {
    ...staged,
    commitSha,
    entrypoint: 'entry.js',
    manifestRelativePath: 'package.json',
    origin: 'https://github.com/elvinzhao10/LazyTrae.git',
    runtimePath: process.execPath,
    version,
  });
}

test('v1.1 install upgrades to v1.2, reinstalls, and removes only the receipt-owned product', (t) => {
  const fixture = durableFixture(t);
  const first = promote(fixture, MATRIX.from_version, 'a');
  const second = promote(fixture, MATRIX.to_version, 'b');
  const sibling = prepareProductRoot({ installRoot: fixture.paths.installRoot, product: 'LazyBuddy' });
  const siblingSentinel = path.join(sibling.productRoot, 'caller-owned');
  const settings = path.join(fixture.sandbox, 'host-settings.json');
  fs.writeFileSync(siblingSentinel, 'sibling\n');
  fs.writeFileSync(settings, 'settings\n');

  assert.equal(JSON.parse(fs.readFileSync(fixture.paths.active)).active_release, second.releaseId);
  assert.equal(fs.existsSync(first.receiptPath), true);
  offboardProduct(fixture.paths, 'offboard-product');
  assert.equal(fs.readFileSync(siblingSentinel, 'utf8'), 'sibling\n');
  assert.equal(fs.readFileSync(settings, 'utf8'), 'settings\n');

  fixture.paths = prepareProductRoot({ installRoot: fixture.paths.installRoot, product: MATRIX.product });
  promote(fixture, MATRIX.to_version, 'c');
  offboardProduct(fixture.paths, 'offboard-product');
  assert.equal(fs.existsSync(fixture.paths.productRoot), false);
});

test('v1.2 offboard reports modified, unknown, mismatched, and cross-product state without deletion', async (t) => {
  for (const state of ['modified_owned_file', 'unknown_file', 'mismatched_receipt', 'cross_product_root']) {
    await t.test(state, () => {
      const fixture = durableFixture(t);
      const installed = promote(fixture, MATRIX.to_version, 'd');
      if (state === 'modified_owned_file') {
        fs.appendFileSync(path.join(fixture.paths.releases, installed.releaseId, 'entry.js'), '// caller change\n');
      } else if (state === 'unknown_file') {
        fs.writeFileSync(path.join(fixture.paths.productRoot, 'unknown'), 'caller\n');
      } else if (state === 'mismatched_receipt') {
        const receipt = JSON.parse(fs.readFileSync(installed.receiptPath, 'utf8'));
        receipt.product = 'LazyBuddy';
        fs.writeFileSync(installed.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      } else {
        fixture.paths.product = 'LazyBuddy';
      }
      assert.throws(() => offboardProduct(fixture.paths, 'offboard-product'), (error) => (
        error instanceof LifecycleError && error.code === MATRIX.refusals[state]
      ));
      assert.equal(fs.existsSync(fixture.paths.productRoot), true);
    });
  }
});

test('removal docs define only the supported TraeCode CLI platform boundary', () => {
  const removal = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'docs', '08-safe-removal.md'), 'utf8');
  assert.match(removal, /normal removal flow documented by the installer or package\s+manager/);
  assert.match(removal, /does not define or imply/);
  assert.doesNotMatch(removal, /^\s*(?:trae|traecli)\s+uninstall\b/m);
});

test('soft offboard and reinstall preserve foreign MCP, soft state, and modified or unknown files', (t) => {
  const project = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae v120 project '));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
  const mcpPath = path.join(project, '.trae', 'mcp.json');
  const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
  mcp.mcpServers.foreign = { command: 'foreign-mcp', args: [] };
  fs.writeFileSync(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`);
  const modified = path.join(project, '.trae', 'rules', 'css.md');
  fs.appendFileSync(modified, '\ncaller change\n');
  fs.writeFileSync(path.join(project, '.trae', 'settings.json'), '{"caller":true}\n');
  fs.mkdirSync(path.join(project, '.lazytrae', 'state'), { recursive: true });
  fs.writeFileSync(path.join(project, '.lazytrae', 'state', 'caller.json'), '{"keep":true}\n');
  fs.writeFileSync(path.join(project, '.trae', 'unknown.txt'), 'unknown\n');

  const offboard = runCli(['offboard', '--host', 'ide', '--yes'], { cwd: project });
  assert.equal(offboard.status, 1, offboard.stderr || offboard.stdout);
  const remainingMcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
  assert.equal(Object.hasOwn(remainingMcp.mcpServers, 'lazytrae'), false);
  assert.deepEqual(remainingMcp.mcpServers.foreign, { command: 'foreign-mcp', args: [] });
  assert.match(fs.readFileSync(modified, 'utf8'), /caller change/);
  assert.equal(fs.readFileSync(path.join(project, '.trae', 'settings.json'), 'utf8'), '{"caller":true}\n');
  assert.equal(fs.readFileSync(path.join(project, '.trae', 'unknown.txt'), 'utf8'), 'unknown\n');
  assert.equal(fs.readFileSync(path.join(project, '.lazytrae', 'state', 'caller.json'), 'utf8'), '{"keep":true}\n');

});

test('clean soft offboard can reinstall before normal receipt-owned uninstall', (t) => {
  const project = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae v120 reinstall '));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
  fs.writeFileSync(path.join(project, '.lazytrae', 'state', 'caller.json'), '{"keep":true}\n');

  assert.equal(runCli(['offboard', '--host', 'ide', '--yes'], { cwd: project }).status, 0);
  assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
  assert.equal(runCli(['uninstall', '--yes'], { cwd: project }).status, 0);
  assert.equal(fs.readFileSync(path.join(project, '.lazytrae', 'state', 'caller.json'), 'utf8'), '{"keep":true}\n');
});
