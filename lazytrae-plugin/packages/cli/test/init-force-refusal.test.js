'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const CLI = path.resolve(__dirname, '..', 'bin', 'lazytrae.js');

test('init refuses the force bypass before changing an existing project', (t) => {
  // Given: a project containing a caller-owned command.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-force-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  const command = path.join(project, '.trae', 'commands', 'ultrawork.md');
  fs.mkdirSync(path.dirname(command), { recursive: true });
  fs.writeFileSync(command, 'caller bytes\n');
  const before = fs.readFileSync(command);
  // When: the removed overwrite bypass is requested.
  const result = spawnSync(process.execPath, [CLI, 'init', '--force'], { cwd: project, encoding: 'utf8' });
  // Then: the request fails before writing and caller bytes remain exact.
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /force.*not supported|cannot.*bypass/i);
  assert.deepEqual(fs.readFileSync(command), before);
});
