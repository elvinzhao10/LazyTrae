'use strict';
const { portable, read } = require('./dashboard-state');
const { source, assess } = require('./dashboard-proof');
const { hash, safeRead, protectedPath, DashboardError } = require('./dashboard-files');
async function capture(root, previous) {
  const { createProjector, parseContract } = await portable('projection.mjs');
  const { loop, input } = await read(root);
  const identity = source(root);
  input.source_revision = identity.head;
  if (previous) input.previous_cursor = parseContract('cursor', previous);
  const accepted = new Set();
  for (const goal of loop.goals) for (const criterion of goal.successCriteria) {
    if (assess(root, loop, goal, criterion, identity)) accepted.add(criterion.id);
  }
  const project = createProjector({ completionApplies: (_proof, binding, criterion) => binding === input && accepted.has(criterion.id) });
  const snapshot = project(input);
  const evidence = [];
  for (const task of snapshot.tasks) for (const attempt of task.attempts) for (const ref of attempt.evidence) {
    evidence.push({ ...ref, task_id: task.id, id: hash(`${input.project_id}\n${input.run_id}\n${task.id}\n${ref.path}\n${ref.sha256}`),
      ...(protectedPath(ref.path) ? { unavailable_reason: 'PROTECTED_SERVICE_ARTIFACT' } : {}) });
  }
  return { snapshot, cursor: Buffer.from(JSON.stringify(snapshot.cursor)).toString('base64url'), evidence,
    editability: { supported: true, reason: null }, queue_authority: { supported: true, reason: null } };
}
async function evidence(root, id) {
  const current = await capture(root);
  const ref = current.evidence.find(item => item.id === id);
  if (!ref || ref.unavailable_reason) throw new DashboardError('UNKNOWN_EVIDENCE', 404);
  const bytes = safeRead(root, ref.path);
  if (hash(bytes) !== ref.sha256) throw new DashboardError('REFERENCE_CHANGED', 409);
  return bytes;
}
module.exports = { capture, evidence };
