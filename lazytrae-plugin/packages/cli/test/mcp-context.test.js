const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TOOLS, HANDLERS } = require('../../mcp/src/tools');
const { REPO_ROOT, MONOREPO_ROOT } = require('./test-helpers');

function emptyRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-empty-context-'));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

test('MCP context tools are listed with the existing state tools', () => {
  const names = TOOLS.map(tool => tool.name);

  assert.equal(TOOLS.length, 15);
  for (const name of [
    'lazytrae.symbol_search',
    'lazytrae.find_references',
    'lazytrae.goto_definition',
    'lazytrae.diagnostics',
    'lazytrae.docs_lookup',
    'lazytrae.dependency_graph',
  ]) {
    assert.equal(names.includes(name), true, `${name} missing`);
    assert.equal(typeof HANDLERS[name], 'function');
  }
});

test('MCP context tools return provenance and local repo evidence', () => {
  const symbol = HANDLERS['lazytrae.symbol_search'](REPO_ROOT, { query: 'createGoals' });
  assert.equal(symbol.provenance, 'heuristic');
  assert.equal(symbol.results.some(result => result.file.includes('loop-runtime.js')), true);

  const references = HANDLERS['lazytrae.find_references'](REPO_ROOT, { symbol: 'handleGetActivePlan' });
  assert.equal(references.provenance, 'heuristic');
  assert.equal(references.references.length > 0, true);

  const definition = HANDLERS['lazytrae.goto_definition'](REPO_ROOT, { symbol: 'handleGetActivePlan' });
  assert.equal(definition.provenance, 'heuristic');
  assert.equal(definition.results[0].file, 'packages/mcp/src/handlers-read.js');
  assert.notEqual(definition.no_result, true);

  const docs = HANDLERS['lazytrae.docs_lookup'](MONOREPO_ROOT, { query: 'ulw-loop' });
  assert.equal(docs.provenance, 'project-tool-backed');
  assert.equal(docs.results.some(result => result.file.startsWith('docs/')), true);

  const graph = HANDLERS['lazytrae.dependency_graph'](REPO_ROOT, { path: 'packages/cli/src/index.js' });
  assert.equal(graph.provenance, 'heuristic');
  assert.equal(graph.imports.includes('fs'), true);
  assert.equal(Array.isArray(graph.reverse_references), true);

  const diagnostics = HANDLERS['lazytrae.diagnostics'](REPO_ROOT, {});
  assert.equal(diagnostics.provenance, 'project-tool-backed');
  assert.equal(diagnostics.executed, false);
  assert.equal(diagnostics.commands.some(command => command.command === 'npm test'), true);
});

test('MCP context tools handle empty repos and missing symbols gracefully', () => {
  const root = emptyRepo();
  try {
    const search = HANDLERS['lazytrae.symbol_search'](root, { query: 'anything' });
    assert.equal(search.provenance, 'heuristic');
    assert.deepEqual(search.results, []);

    const references = HANDLERS['lazytrae.find_references'](root, { symbol: 'anything' });
    assert.equal(references.provenance, 'heuristic');
    assert.deepEqual(references.references, []);

    const missing = HANDLERS['lazytrae.goto_definition'](root, { symbol: 'definitely_missing_symbol' });
    assert.equal(missing.provenance, 'heuristic');
    assert.equal(missing.no_result, true);

    const diagnostics = HANDLERS['lazytrae.diagnostics'](root, {});
    assert.equal(diagnostics.provenance, 'project-tool-backed');
    assert.deepEqual(diagnostics.commands, []);

    const graph = HANDLERS['lazytrae.dependency_graph'](root, { path: 'missing.js' });
    assert.equal(graph.missing, true);

    const docs = HANDLERS['lazytrae.docs_lookup'](root, { query: 'anything' });
    assert.equal(docs.provenance, 'project-tool-backed');
    assert.deepEqual(docs.results, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('MCP dependency graph refuses paths outside the project root', () => {
  const graph = HANDLERS['lazytrae.dependency_graph'](REPO_ROOT, { path: '../../.codex/skills/.system/openai-docs/SKILL.md' });

  assert.equal(graph.provenance, 'heuristic');
  assert.equal(graph.missing, true);
  assert.match(graph.error, /repo root/);
  assert.deepEqual(graph.imports, []);
});

test('MCP diagnostics reports malformed package files without throwing', () => {
  const root = emptyRepo();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{bad json\n');

    const diagnostics = HANDLERS['lazytrae.diagnostics'](root, {});

    assert.equal(diagnostics.provenance, 'project-tool-backed');
    assert.equal(diagnostics.commands.length, 1);
    assert.equal(diagnostics.commands[0].command, null);
    assert.match(diagnostics.commands[0].reason, /invalid package\.json/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('MCP diagnostics reports non-object package metadata without throwing', () => {
  const root = emptyRepo();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), 'null\n');

    const diagnostics = HANDLERS['lazytrae.diagnostics'](root, {});

    assert.equal(diagnostics.provenance, 'project-tool-backed');
    assert.equal(diagnostics.commands.length, 1);
    assert.equal(diagnostics.commands[0].command, null);
    assert.match(diagnostics.commands[0].reason, /expected object metadata/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
