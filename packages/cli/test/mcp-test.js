#!/usr/bin/env node

// MCP Server Test — Test all 9 LazyTrae MCP tools
// Run: node packages/cli/test/mcp-test.js

const path = require('path');
const { HANDLERS } = require('../src/commands/mcp');

// Find repo root relative to this file
function findRepoRoot() {
  let d = path.resolve(__dirname, '..', '..');
  while (d !== path.dirname(d)) {
    try {
      const fs = require('fs');
      if (fs.existsSync(path.join(d, '.git')) || fs.existsSync(path.join(d, '.lazytrae'))) return d;
    } catch (_) {}
    d = path.dirname(d);
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();

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

console.log('=== LazyTrae MCP Server Tests ===');
console.log(`Repo root: ${REPO_ROOT}\n`);

// Read-only tools (no side effects)
runTest('lazytrae.get_active_plan', HANDLERS['lazytrae.get_active_plan'], {}, false);
runTest('lazytrae.get_boulder_status', HANDLERS['lazytrae.get_boulder_status'], {}, false);
runTest('lazytrae.get_next_task', HANDLERS['lazytrae.get_next_task'], {}, false);
runTest('lazytrae.get_parity_status', HANDLERS['lazytrae.get_parity_status'], {}, false);

// Write tools (record evidence, request review, generate handoff)
runTest('lazytrae.record_evidence', HANDLERS['lazytrae.record_evidence'], { gate_type: 'automated', task_id: 'task-1', summary: 'Test evidence from mcp-test.js' }, false);
runTest('lazytrae.request_review', HANDLERS['lazytrae.request_review'], { task_id: 'task-1', context: 'Test review context', files_changed: ['packages/cli/src/commands/mcp.js'] }, false);
runTest('lazytrae.generate_handoff', HANDLERS['lazytrae.generate_handoff'], { summary: 'MCP test handoff' }, false);

// Task mutation with safe task IDs (should error gracefully)
runTest('lazytrae.mark_task_done (non-existent)', HANDLERS['lazytrae.mark_task_done'], { task_id: 'nonexistent-task' }, true);
runTest('lazytrae.add_blocker', HANDLERS['lazytrae.add_blocker'], { reason: 'Test blocker from mcp-test.js', signature: 'test-blocker' }, false);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

process.exit(failed > 0 ? 1 : 0);