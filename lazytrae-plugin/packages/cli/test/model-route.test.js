'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { runCli } = require('./test-helpers');

function writeCatalog(t, model) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-model-route-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const catalogPath = path.join(root, 'safe-catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify({ schema_version: 1, host: 'trae-ide', models: [model] }));
  return catalogPath;
}

test('model-route exposes the shared helper usage through the CLI dispatcher', () => {
  const result = runCli(['model-route', '--help']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--host HOST --task TASK/);
  assert.match(result.stdout, /--list --host HOST/);
});

test('model-route preserves a qualified caller-declared Trae IDE builtin identifier', (t) => {
  const model = {
    id: 'Configured-Builtin-42',
    origin: 'builtin',
    tier: 'strong',
    available: true,
    capabilities: ['tools', 'code'],
    subagentSupported: true,
  };
  const catalogPath = writeCatalog(t, model);

  const result = runCli([
    'model-route', '--host', 'trae-ide', '--task', 'review', '--allow-switch',
    '--catalog', catalogPath, '--model', model.id,
  ]);

  assert.equal(result.status, 0, result.stderr);
  const recommendation = JSON.parse(result.stdout);
  assert.equal(recommendation.chosenModel, model.id);
  assert.deepEqual(recommendation.dispatch, { kind: 'agent-frontmatter', value: model.id });
});

test('model-route refuses a custom Trae IDE model for subagent frontmatter', (t) => {
  const catalogPath = writeCatalog(t, {
    id: 'Configured-Custom-42',
    origin: 'custom',
    tier: 'strong',
    available: true,
    capabilities: ['tools', 'code'],
  });

  const result = runCli([
    'model-route', '--host', 'trae-ide', '--task', 'review', '--allow-switch',
    '--catalog', catalogPath, '--model', 'Configured-Custom-42',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /custom.*cannot be bound to subagents/i);
});

test('model-route inherits the current model when the plan has no switch decision', () => {
  const result = runCli(['model-route', '--host', 'trae-ide', '--task', 'review']);
  assert.equal(result.status, 0, result.stderr);
  const recommendation = JSON.parse(result.stdout);
  assert.equal(recommendation.chosenModel, null);
  assert.deepEqual(recommendation.dispatch, { kind: 'inherit', value: null });
});
