#!/usr/bin/env node

// MCP Server Test — Test all 9 LazyTrae MCP tools
// Run: node packages/cli/test/mcp-test.js

const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert/strict');
const { HANDLERS } = require('../../mcp/src/tools');
const { resolveMcpIndex } = require('../src/commands/mcp');
const SOURCE_ROOT = path.resolve(__dirname, '..', '..', '..');

function makeRepoRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-smoke-'));
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.lazytrae', 'plans'), { recursive: true });
  fs.writeFileSync(path.join(root, '.lazytrae', 'plans', 'demo.md'), '# Demo plan\n');
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

function runTest(name, handler, args, expectError) {
  process.stdout.write(`Test: ${name}... `);
  try {
    const result = handler(REPO_ROOT, args);
    if (result && result.error) {
      if (expectError) {
        console.log(`PASS (expected error: ${result.error})`);
        passed++;
      } else {
        console.log(`FAIL (got error: ${result.error})`);
        failed++;
      }
    } else {
      if (expectError) {
        console.log(`FAIL (expected error, got success)`);
        failed++;
      } else {
        console.log(`PASS`);
        passed++;
      }
    }
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

// Read-only tools (no side effects)
runTest('lazytrae.get_active_plan', HANDLERS['lazytrae.get_active_plan'], {}, false);
runTest('lazytrae.get_boulder_status', HANDLERS['lazytrae.get_boulder_status'], {}, false);
runTest('lazytrae.get_next_task', HANDLERS['lazytrae.get_next_task'], {}, false);
runTest('lazytrae.get_parity_status', HANDLERS['lazytrae.get_parity_status'], {}, false);

// Write tools (record evidence, request review, generate handoff)
runTest('lazytrae.record_evidence', HANDLERS['lazytrae.record_evidence'], { gate_type: 'automated_verification', task_id: 'task-1', summary: 'Test evidence from mcp-test.js' }, false);
runTest('lazytrae.request_review', HANDLERS['lazytrae.request_review'], { task_id: 'task-1', context: 'Test review context', files_changed: ['packages/cli/src/commands/mcp.js'] }, false);
runTest('lazytrae.generate_handoff', HANDLERS['lazytrae.generate_handoff'], { summary: 'MCP test handoff' }, false);

// Task mutation with safe task IDs (should error gracefully)
runTest('lazytrae.mark_task_done (non-existent)', HANDLERS['lazytrae.mark_task_done'], { task_id: 'nonexistent-task' }, true);
runTest('lazytrae.add_blocker', HANDLERS['lazytrae.add_blocker'], { reason: 'Test blocker from mcp-test.js', signature: 'test-blocker' }, false);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

fs.rmSync(REPO_ROOT, { recursive: true, force: true });

process.exit(failed > 0 ? 1 : 0);
