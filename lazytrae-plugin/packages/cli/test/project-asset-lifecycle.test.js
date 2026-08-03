'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const CLI = path.resolve(__dirname, '..', 'bin', 'lazytrae.js');

function run(project, args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: project, encoding: 'utf8' });
}

test('init, sync check, and uninstall share the project asset ownership receipt', (t) => {
  // Given: an empty local repository initialized through the real CLI.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-assets-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  const initialized = run(project, ['init', '--host', 'ide']);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const receipt = path.join(project, '.lazytrae', 'asset-receipt.v1.json');
  assert.equal(fs.statSync(receipt).isFile(), true);

  // When: a caller changes one receipted output and check mode inspects it.
  const callerFile = path.join(project, '.trae', 'rules', 'css.md');
  fs.appendFileSync(callerFile, '\ncaller-only\n');
  const checked = run(project, ['sync', '--check']);

  // Then: check fails without changing bytes, sync preserves them, and uninstall removes only unchanged outputs.
  assert.notEqual(checked.status, 0);
  assert.match(checked.stdout, /modified output \.trae\/rules\/css\.md/);
  const callerBytes = fs.readFileSync(callerFile);
  assert.equal(run(project, ['sync']).status, 0);
  assert.deepEqual(fs.readFileSync(callerFile), callerBytes);
  const removed = run(project, ['uninstall', '--yes']);
  assert.equal(removed.status, 0, removed.stderr || removed.stdout);
  assert.deepEqual(fs.readFileSync(callerFile), callerBytes);
  assert.equal(fs.existsSync(path.join(project, '.trae', 'rules', 'typescript.md')), false);
  assert.equal(fs.existsSync(receipt), false);
});

test('mutating project asset commands reject the force bypass', (t) => {
  // Given: an initialized repository with a caller-modified receipted output.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-assets-force-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  assert.equal(run(project, ['init', '--host', 'ide']).status, 0);
  const callerFile = path.join(project, '.trae', 'rules', 'css.md');
  fs.appendFileSync(callerFile, '\ncaller-only\n');
  const before = fs.readFileSync(callerFile);
  // When: sync and uninstall are invoked with the forbidden bypass.
  const sync = run(project, ['sync', '--force']);
  const uninstall = run(project, ['uninstall', '--yes', '--force']);
  // Then: both fail before changing caller bytes.
  assert.notEqual(sync.status, 0);
  assert.notEqual(uninstall.status, 0);
  assert.match(`${sync.stderr}\n${uninstall.stderr}`, /force.*not supported|cannot.*bypass/i);
  assert.deepEqual(fs.readFileSync(callerFile), before);
});

test('sync check rejects a receipt that omits an expected compiled output', (t) => {
  // Given: a real initialized repository whose valid receipt is missing one expected entry.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-project-assets-incomplete-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  const initialized = run(project, ['init', '--host', 'ide']);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const receiptPath = path.join(project, '.lazytrae', 'asset-receipt.v1.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const omitted = receipt.files.shift();
  assert.ok(omitted);
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const outputPath = path.join(project, ...omitted.path.split('/'));
  const outputBytes = fs.readFileSync(outputPath);

  // When: the real CLI checks the truncated receipt against the compiled inventory.
  const checked = run(project, ['sync', '--check']);

  // Then: it fails closed, names the missing entry, and leaves its output untouched.
  assert.notEqual(checked.status, 0, checked.stderr || checked.stdout);
  assert.ok(checked.stdout.includes(`missing receipt entry ${omitted.path}`), checked.stdout);
  assert.deepEqual(fs.readFileSync(outputPath), outputBytes);
});
