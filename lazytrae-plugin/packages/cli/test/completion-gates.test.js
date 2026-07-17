const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeCompletionFixture, runCli } = require('./test-helpers');

test('completion-status blocks active Boulder tasks without evidence', () => {
  const fixture = makeCompletionFixture('lazytrae-completion-blocked-', false);

  const result = runCli(['completion-status'], { cwd: fixture });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /^blocked/m);
  assert.match(result.stdout, /boulder_task_evidence/);
  assert.match(result.stdout, /task-1 is in_progress/);
});

test('completion-status is ready when active Boulder task has real evidence', () => {
  const fixture = makeCompletionFixture('lazytrae-completion-ready-', true);

  const result = runCli(['completion-status'], { cwd: fixture });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^ready/m);
});

test('verify --must-pass fails incomplete fixtures and passes complete fixtures', () => {
  const incomplete = makeCompletionFixture('lazytrae-verify-must-pass-blocked-', false);
  const blocked = runCli(['verify', '--must-pass'], { cwd: incomplete });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /^blocked/m);
  assert.match(blocked.stdout, /boulder_task_evidence/);

  const complete = makeCompletionFixture('lazytrae-verify-must-pass-ready-', true);
  const ready = runCli(['verify', '--must-pass'], { cwd: complete });
  assert.equal(ready.status, 0);
  assert.match(ready.stdout, /^ready/m);
});

test('verify --help documents --must-pass', () => {
  const result = runCli(['verify', '--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /--must-pass/);
});

test('MCP mark_task_done requires summary and existing evidence paths', () => {
  const { HANDLERS } = require('../../mcp/src/tools');
  const fixture = makeCompletionFixture('lazytrae-mcp-mark-task-', false);

  const missingSummary = HANDLERS['lazytrae.mark_task_done'](fixture, { task_id: 'task-1' });
  assert.equal(missingSummary.error, 'EVIDENCE_REQUIRED');
  assert.match(missingSummary.message, /evidence_summary/);

  const missingPath = HANDLERS['lazytrae.mark_task_done'](fixture, {
    task_id: 'task-1',
    evidence_summary: 'proof',
    evidence_paths: ['.lazytrae/evidence/missing.md'],
  });
  assert.equal(missingPath.error, 'EVIDENCE_REQUIRED');
  assert.match(missingPath.evidence_errors.join('\n'), /evidence missing/);

  fs.writeFileSync(path.join(fixture, '.lazytrae', 'evidence', 'task-1.md'), 'proof\n');
  const done = HANDLERS['lazytrae.mark_task_done'](fixture, {
    task_id: 'task-1',
    evidence_summary: 'proof',
    evidence_paths: ['.lazytrae/evidence/task-1.md'],
  });
  assert.equal(done.marked_complete, true);
  assert.deepEqual(done.evidence_paths, ['.lazytrae/evidence/task-1.md']);

  const persisted = JSON.parse(fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'boulder.json'), 'utf-8'));
  const persistedTask = persisted.works[persisted.active_work_id].tasks[0];
  assert.equal(persistedTask.status, 'complete');
  assert.equal(typeof persistedTask.completed_at, 'string');
  assert.equal(persistedTask.evidence_summary, 'proof');
  assert.deepEqual(persistedTask.evidence_paths, ['.lazytrae/evidence/task-1.md']);
});

test('handoff includes completion gate warning for incomplete fixtures', () => {
  const fixture = makeCompletionFixture('lazytrae-handoff-blocked-', false);

  const json = runCli(['handoff', '--json'], { cwd: fixture });
  assert.equal(json.status, 0);
  const handoff = JSON.parse(json.stdout);
  assert.equal(handoff.completionGate.status, 'blocked');
  assert.match(handoff.completionGate.reasons[0].gate, /boulder_task_evidence/);

  const markdown = runCli(['handoff'], { cwd: fixture });
  assert.equal(markdown.status, 0);
  assert.match(markdown.stdout, /## Completion Gate/);
  assert.match(markdown.stdout, /blocked/);
});
