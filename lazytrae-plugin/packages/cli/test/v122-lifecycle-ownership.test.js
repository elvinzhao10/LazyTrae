'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { installAssets } = require('../src/lib/asset-ownership');
const { runCli } = require('./test-helpers');

function project(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function write(root, relative, bytes) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return target;
}

test('init and sync preserve caller-owned state, evidence, and unknown files byte-for-byte', (t) => {
  // Given: consumer data occupying template-shaped destinations and unrelated paths.
  const root = project(t, 'lazytrae-v122-owned-');
  const sentinels = new Map([
    ['.lazytrae/state/sessions.json', Buffer.from('{"caller":"session"}\n')],
    ['.lazytrae/evidence/handoff.md', Buffer.from('caller evidence\n')],
    ['.trae/hooks/caller-only.sh', Buffer.from('# caller hook\n')],
    ['unknown.bin', Buffer.from([0, 1, 2, 255])],
  ]);
  for (const [relative, bytes] of sentinels) write(root, relative, bytes);

  // When: init and a rerun through sync complete.
  const initialized = runCli(['init'], { cwd: root });
  const synced = runCli(['sync'], { cwd: root });

  // Then: caller bytes remain exact across both success paths.
  assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
  assert.equal(synced.status, 0, `${synced.stdout}\n${synced.stderr}`);
  for (const [relative, bytes] of sentinels) assert.deepEqual(fs.readFileSync(path.join(root, relative)), bytes, relative);
});

test('init conflict is detected before any managed asset or receipt is written', (t) => {
  // Given: an unknown conflicting generated destination beside caller data.
  const root = project(t, 'lazytrae-v122-conflict-');
  const conflict = write(root, '.trae/commands/lazy-ulw-loop.md', 'caller command\n');
  const caller = write(root, 'caller.txt', 'preserve\n');

  // When: init encounters ownership ambiguity.
  const result = runCli(['init'], { cwd: root });

  // Then: it fails closed before partial authority state exists.
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unreceipted|refus/i);
  assert.equal(fs.readFileSync(conflict, 'utf8'), 'caller command\n');
  assert.equal(fs.readFileSync(caller, 'utf8'), 'preserve\n');
  assert.equal(fs.existsSync(path.join(root, '.lazytrae', 'asset-receipt.v1.json')), false);
  assert.equal(fs.existsSync(path.join(root, '.trae', 'agents', 'explorer.md')), false);
});

test('repeated interrupted promotions roll back exactly and rerun converges without touching unknown files', (t) => {
  // Given: a two-file owned tree, an unknown caller file, and two injected interruption points.
  const root = project(t, 'lazytrae-v122-interrupt-');
  const source = path.join(root, 'source');
  const destination = path.join(root, 'destination');
  const manifest = path.join(source, 'manifest.json');
  const receipt = path.join(destination, '.receipt.json');
  fs.mkdirSync(path.join(source, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(source, 'assets', 'a.txt'), 'a1\n');
  fs.writeFileSync(path.join(source, 'assets', 'b.txt'), 'b1\n');
  fs.writeFileSync(manifest, JSON.stringify({
    schema_version: 1, owner: 'lazytrae-v122-interruption',
    roots: [{ source: 'assets', destination: '.managed', default_format: 'text', format_by_extension: {} }],
  }));
  const options = { sourceRoot: source, manifestPath: manifest, destinationRoot: destination, receiptPath: receipt };
  installAssets(options);
  const unknown = write(destination, 'caller.bin', Buffer.from([7, 8, 9]));
  const before = new Map(['.managed/a.txt', '.managed/b.txt', '.receipt.json']
    .map((relative) => [relative, fs.readFileSync(path.join(destination, relative))]));
  fs.writeFileSync(path.join(source, 'assets', 'a.txt'), 'a2\n');
  fs.writeFileSync(path.join(source, 'assets', 'b.txt'), 'b2\n');

  // When/Then: interruption at either promotion restores every prior byte.
  for (const stopAt of [1, 2]) {
    let promotions = 0;
    const rename = (from, to) => {
      if (from.endsWith('.asset-tmp') && ++promotions === stopAt) throw Object.assign(new Error('interrupted'), { code: 'EINTR' });
      fs.renameSync(from, to);
    };
    assert.throws(() => installAssets({ ...options, rename }), /interrupted/);
    for (const [relative, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(destination, relative)), bytes, `${stopAt}:${relative}`);
    assert.deepEqual(fs.readFileSync(unknown), Buffer.from([7, 8, 9]));
  }
  installAssets(options);
  assert.equal(fs.readFileSync(path.join(destination, '.managed/a.txt'), 'utf8'), 'a2\n');
  assert.equal(fs.readFileSync(path.join(destination, '.managed/b.txt'), 'utf8'), 'b2\n');
  assert.deepEqual(fs.readFileSync(unknown), Buffer.from([7, 8, 9]));
});

test('sync preflights late conflicts before repairing any managed output', (t) => {
  // Given: a valid install with one missing managed output and a modified MCP authority entry.
  const root = project(t, 'lazytrae-v122-preflight-');
  const initialized = runCli(['init'], { cwd: root });
  assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
  const missing = path.join(root, '.trae', 'agents', 'explorer.md');
  fs.rmSync(missing);
  const declarationPath = path.join(root, '.trae', 'mcp.json');
  const declaration = JSON.parse(fs.readFileSync(declarationPath, 'utf8'));
  declaration.mcpServers.lazytrae.args.push('--caller-modified');
  fs.writeFileSync(declarationPath, `${JSON.stringify(declaration, null, 2)}\n`);
  const beforeDeclaration = fs.readFileSync(declarationPath);

  // When: sync sees the late ownership conflict.
  const result = runCli(['sync'], { cwd: root });

  // Then: it fails before restoring another managed output and preserves caller bytes.
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /modified.*preserved|rename or remove/i);
  assert.equal(fs.existsSync(missing), false);
  assert.deepEqual(fs.readFileSync(declarationPath), beforeDeclaration);
});

test('sync rejects malformed consumer config before mutating managed files', (t) => {
  // Given: a valid install with a missing managed output and malformed caller configuration.
  const root = project(t, 'lazytrae-v122-malformed-');
  const initialized = runCli(['init'], { cwd: root });
  assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
  const missing = path.join(root, '.trae', 'agents', 'explorer.md');
  fs.rmSync(missing);
  const config = write(root, '.lazytrae/config.json', '{malformed\n');
  const before = fs.readFileSync(config);

  // When: sync preflights the consumer configuration.
  const result = runCli(['sync'], { cwd: root });

  // Then: no managed repair precedes the failure and caller bytes remain exact.
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(missing), false);
  assert.deepEqual(fs.readFileSync(config), before);
});
