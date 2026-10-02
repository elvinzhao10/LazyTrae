'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-cli-floor-'));
try {
  // Given the package with its locked dependencies installed.
  const output = execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const [archive] = JSON.parse(output);
  assert.ok(archive.files.some(file => file.path === 'bin/lazytrae.js'));
  assert.ok(archive.files.some(file => file.path === 'src/index.js'));
  if (process.argv[2] === 'install') {
    // When the exact archive is installed in a clean consumer.
    const consumer = path.join(temporary, 'consumer');
    execFileSync('npm', ['install', '--prefix', consumer, '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--package-lock=false', path.join(temporary, archive.filename)], { encoding: 'utf8' });
    const help = execFileSync(process.execPath, [path.join(consumer, 'node_modules/lazytrae-ai/bin/lazytrae.js'), '--help'], { encoding: 'utf8' });
    // Then the installed CLI executes on this actual runtime.
    assert.match(help, /lazytrae/i);
  } else {
    assert.equal(process.argv[2], 'package');
  }
  process.stdout.write(JSON.stringify({ exercise: process.argv[2], runtime: process.versions.node, archive: archive.filename, outcome: 'executed' }) + '\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
