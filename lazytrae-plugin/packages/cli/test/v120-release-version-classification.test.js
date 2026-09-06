'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { classify } = require('../scripts/release-version-classifier');

const ROOT = path.resolve(__dirname, '../../../..');

function fixture() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-v121-classifier-'));
  fs.cpSync(ROOT, target, { recursive: true, filter: source => !source.includes(`${path.sep}.git`) && !source.includes(`${path.sep}node_modules`) });
  return target;
}

function mutate(relativePath, transform) {
  const root = fixture();
  const file = path.join(root, relativePath);
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
  return root;
}

test('v1.2.2 release versions are classified and historical v1.2.1 references are explicit', () => {
  assert.deepEqual(classify(ROOT).failures, []);
});

test('classifier rejects a current 1.2.1 claim even when migration wording is present', () => {
  const root = mutate('README.md', text => `${text}\nCurrent supported release is 1.2.1 for migration compatibility.\n`);
  try {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/release-version-classifier.js'), root], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(JSON.parse(result.stdout).failures.some(item => item.includes('CURRENT_VERSION_DRIFT_TEXT README.md')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, relativePath, transform, failure] of [
  ['current 1.2.1 drift', 'README.md', text => `${text}\nCurrent supported release is v1.2.1.\n`, 'CURRENT_VERSION_DRIFT_TEXT'],
  ['missing release-note section', 'RELEASE_NOTES.md', text => text.replace('## Rollback', '## Recovery'), 'MISSING_RELEASE_NOTE_SECTION'],
  ['package/runtime mismatch', 'lazytrae-plugin/packages/cli/package.json', text => text.replace('"version": "1.2.2"', '"version": "1.2.1"'), 'CURRENT_VERSION_DRIFT'],
]) {
  test(`classifier rejects ${name} in a copy`, () => {
    const root = mutate(relativePath, transform);
    try { assert.ok(classify(root).failures.some(item => item.includes(failure))); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('classifier rejects a superseded standalone release note', () => {
  const root = fixture();
  try {
    fs.writeFileSync(path.join(root, 'RELEASE_NOTES-v1.2.1.md'), 'superseded\n');
    assert.ok(classify(root).failures.some(item => item.includes('SUPERSEDED_RELEASE_NOTES')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
