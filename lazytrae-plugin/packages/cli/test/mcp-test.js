#!/usr/bin/env node

// MCP Server Test — exercise the final 15-tool LazyTrae MCP contract
// Run: node packages/cli/test/mcp-test.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert/strict');
const { TOOLS, HANDLERS } = require('../../mcp/src/tools');
const { resolveMcpIndex } = require('../src/commands/mcp');
const SOURCE_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeRepoRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-smoke-'));
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.lazytrae', 'plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, '.lazytrae', 'plans', 'demo.md'), '# Demo plan\n');
  fs.writeFileSync(path.join(root, 'README.md'), 'Fixture docs describe the fixtureMarker workflow.\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }) + '\n');
  fs.writeFileSync(path.join(root, 'src', 'fixture.js'), "const fs = require('fs');\nfunction fixtureMarker() { return fs.existsSync('.'); }\nmodule.exports = { fixtureMarker };\n");
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'boulder.json'), JSON.stringify({
    schema_version: 2,
    active_work_id: 'work-1',
    works: {
      'work-1': {
        work_id: 'work-1',
        active_plan: '.lazytrae/plans/demo.md',
        plan_name: 'demo',
        session_ids: [],
        status: 'active',
        tasks: [{ id: 'task-1', description: 'Smoke task', status: 'pending', evidence_paths: [] }],
        blockers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  }, null, 2) + '\n');
  return root;
}

const REPO_ROOT = makeRepoRoot();

let passed = 0;
let failed = 0;

function runTest(name, handler, args, assertion) {
  process.stdout.write(`Test: ${name}... `);
  try {
    const result = handler(REPO_ROOT, args);
    assertion(result);
    console.log('PASS');
    passed++;
  } catch (e) {
    console.log(`FAIL (exception: ${e.message})`);
    failed++;
  }
}

function runAssertion(name, assertion) {
  process.stdout.write(`Test: ${name}... `);
  try {
    assertion();
    console.log('PASS');
    passed++;
  } catch (e) {
    console.log(`FAIL (exception: ${e.message})`);
    failed++;
  }
}

console.log('=== LazyTrae MCP Server Tests ===');
console.log(`Repo root: ${REPO_ROOT}\n`);

runAssertion('lazytrae mcp wrapper resolves packages/mcp/src/index.js', () => {
  const expected = path.join(SOURCE_ROOT, 'packages', 'mcp', 'src', 'index.js');
  assert.equal(resolveMcpIndex(), expected);
  assert.equal(fs.existsSync(resolveMcpIndex()), true);
});

const FINAL_TOOL_NAMES = [
  'lazytrae.get_active_plan',
  'lazytrae.get_boulder_status',
  'lazytrae.get_next_task',
  'lazytrae.record_evidence',
  'lazytrae.mark_task_done',
  'lazytrae.add_blocker',
  'lazytrae.request_review',
  'lazytrae.generate_handoff',
  'lazytrae.get_parity_status',
  'lazytrae.symbol_search',
  'lazytrae.find_references',
  'lazytrae.goto_definition',
  'lazytrae.diagnostics',
  'lazytrae.docs_lookup',
  'lazytrae.dependency_graph',
];

runAssertion('tools/list contract exposes exactly the final 15 handlers', () => {
  assert.deepEqual(TOOLS.map(tool => tool.name), FINAL_TOOL_NAMES);
  for (const name of FINAL_TOOL_NAMES) assert.equal(typeof HANDLERS[name], 'function', `${name} has no handler`);
});

runTest('lazytrae.get_active_plan', HANDLERS['lazytrae.get_active_plan'], {}, result => {
  assert.equal(result.active_plan, '.lazytrae/plans/demo.md');
  assert.equal(result.tasks[0].id, 'task-1');
});
runTest('lazytrae.get_boulder_status', HANDLERS['lazytrae.get_boulder_status'], {}, result => {
  assert.equal(result.works[0].pending, 1);
});
runTest('lazytrae.get_next_task', HANDLERS['lazytrae.get_next_task'], {}, result => {
  assert.equal(result.next_task.id, 'task-1');
});
runTest('lazytrae.get_parity_status', HANDLERS['lazytrae.get_parity_status'], {}, result => {
  assert.equal(result.present, true);
});
runTest('lazytrae.record_evidence', HANDLERS['lazytrae.record_evidence'], {
  gate_type: 'automated_verification',
  commands: [{ command: 'node packages/cli/test/mcp-test.js', description: 'MCP contract smoke test' }],
  verdict: 'pass',
}, result => {
  assert.equal(result.recorded, true);
  assert.equal(result.file_path, '.lazytrae/evidence/test-runs.md');
});
runTest('lazytrae.mark_task_done', HANDLERS['lazytrae.mark_task_done'], {
  task_id: 'task-1',
  evidence_summary: 'MCP contract smoke test passed.',
  evidence_paths: ['.lazytrae/evidence/test-runs.md'],
}, result => {
  assert.equal(result.marked_complete, true);
  assert.equal(result.task_id, 'task-1');
});
runTest('lazytrae.add_blocker', HANDLERS['lazytrae.add_blocker'], {
  reason: 'Test blocker from mcp-test.js',
  severity: 'info',
}, result => {
  assert.equal(result.blocker_added, true);
  assert.equal(result.total_blockers, 1);
});
runTest('lazytrae.request_review', HANDLERS['lazytrae.request_review'], {
  review_type: 'full',
  task_id: 'task-1',
  context: 'Test review context',
  files_changed: ['packages/cli/src/commands/mcp.js'],
}, result => {
  assert.equal(result.review_requested, true);
  assert.equal(result.review_type, 'full');
});
runTest('lazytrae.generate_handoff', HANDLERS['lazytrae.generate_handoff'], {}, result => {
  assert.equal(result.current_state.plan_name, 'demo');
  assert.equal(fs.existsSync(path.join(REPO_ROOT, '.lazytrae', 'evidence', 'handoff.md')), true);
});

runTest('lazytrae.symbol_search', HANDLERS['lazytrae.symbol_search'], { query: 'fixtureMarker' }, result => {
  assert.equal(result.provenance, 'heuristic');
  assert.equal(result.results.some(match => match.file === 'src/fixture.js'), true);
});
runTest('lazytrae.find_references', HANDLERS['lazytrae.find_references'], { symbol: 'fixtureMarker' }, result => {
  assert.equal(result.provenance, 'heuristic');
  assert.equal(result.references.length > 0, true);
});
runTest('lazytrae.goto_definition', HANDLERS['lazytrae.goto_definition'], { symbol: 'fixtureMarker' }, result => {
  assert.equal(result.no_result, false);
  assert.equal(result.results[0].file, 'src/fixture.js');
});
runTest('lazytrae.diagnostics', HANDLERS['lazytrae.diagnostics'], {}, result => {
  assert.equal(result.provenance, 'project-tool-backed');
  assert.equal(result.commands.some(command => command.command === 'npm test'), true);
});
runTest('lazytrae.docs_lookup', HANDLERS['lazytrae.docs_lookup'], { query: 'fixture docs' }, result => {
  assert.equal(result.provenance, 'project-tool-backed');
  assert.equal(result.results.some(match => match.file === 'README.md'), true);
});
runTest('lazytrae.dependency_graph', HANDLERS['lazytrae.dependency_graph'], { path: 'src/fixture.js' }, result => {
  assert.equal(result.provenance, 'heuristic');
  assert.deepEqual(result.imports, ['fs']);
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

fs.rmSync(REPO_ROOT, { recursive: true, force: true });

process.exit(failed > 0 ? 1 : 0);
