// LazyTrae MCP — Blocker and review handlers (add_blocker, request_review)

const fs = require('fs');
const path = require('path');
const { assertSafeWrite, readJSON, writeJSON, iso, withFileLock, getActiveWork } = require('./state-access');

function handleAddBlocker(root, args) {
  const bp = path.join(root, '.lazytrae', 'state', 'boulder.json');

  return withFileLock(bp, () => {
    const b = readJSON(bp);
    if (!b) return { error: 'boulder.json not found' };

    const work = getActiveWork(root);
    if (!work) return { error: 'No active work found' };

    const ts = iso();
    const blocker = { reason: args.reason, severity: args.severity || null, occurred_at: ts };

    if (args.task_index !== undefined) {
      if (args.task_index < 0 || args.task_index >= work.tasks.length)
        return { error: 'Task index ' + args.task_index + ' out of range' };
      const task = work.tasks[args.task_index];
      task.status = 'blocked';
      task.blocked_reason = args.reason;
      blocker.task_id = task.id;
    }

    if (!work.blockers) work.blockers = [];
    work.blockers.push(blocker);
    work.updated_at = ts;
    b.updated_at = ts;
    writeJSON(bp, b);

    return { blocker_added: true, blocker, work_id: b.active_work_id, total_blockers: work.blockers.length };
  });
}

function handleRequestReview(root, args) {
  const evidencePath = path.join(root, '.lazytrae', 'evidence', 'oracle-review.md');
  assertSafeWrite(evidencePath);
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });

  const ts = iso();
  const reviewType = args.review_type;
  const context = args.context || 'No context provided.';
  const filesChanged = (args.files_changed || []).map(f => '  - ' + f).join('\n') || '  - None specified';
  const taskId = args.task_id || 'N/A';

  const entry = [
    '# Oracle Review Request — ' + ts, '',
    '## Review Type', '', reviewType, '',
    '## Context', '', context, '',
    '## Files Changed', '', filesChanged, '',
    '## Task ID', '', taskId, '',
    '## Five Evidence Gates', '',
    '### 1. Plan Reread', '- [ ] Plan re-read before claiming completion', '',
    '### 2. Automated Verification', '- [ ] Tests, linters, type checks, builds pass', '',
    '### 3. Manual-QA', '- [ ] Real-surface proof through channels (CLI, HTTP, browser, data)', '',
    '### 4. Adversarial QA', '- [ ] Edge cases, regression, adversarial scenarios tested', '',
    '### 5. Cleanup', '- [ ] AI slop removed, dead code cleaned up', '',
    '## Verdict', '',
    '- [ ] APPROVE', '- [ ] ITERATE (max 3 fixable issues)', '- [ ] REJECT (blocking)', '',
    '## Notes', '', '_Review requested at ' + ts + '_', '',
  ].join('\n');

  fs.appendFileSync(evidencePath, entry, 'utf-8');

  return {
    review_requested: true, review_type: reviewType,
    file: '.lazytrae/evidence/oracle-review.md', timestamp: ts, task_id: taskId,
    message: 'Review request created. The Oracle agent should now perform the review.',
  };
}

module.exports = { handleAddBlocker, handleRequestReview };
