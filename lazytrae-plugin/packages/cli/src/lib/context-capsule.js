'use strict';

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const CURRENT_TASK_STATES = new Set(['in_progress', 'blocked']);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function strings(value, limit = 16) {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, limit)
    : [];
}

function text(value) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 512) : null;
}

function validDigest(value) {
  return typeof value === 'string' && DIGEST.test(value);
}

function activeWork(boulder) {
  const state = object(boulder);
  const works = object(state?.works);
  const work = works && typeof state.active_work_id === 'string' ? object(works[state.active_work_id]) : null;
  return work && Array.isArray(work.tasks) ? work : null;
}

function activeTask(work) {
  const tasks = work.tasks.map(object).filter(Boolean);
  return tasks.find((task) => CURRENT_TASK_STATES.has(task.status))
    || tasks.find((task) => task.status === 'pending') || null;
}

function identityFor(work, task, loop) {
  const adaptive = object(loop?.adaptive);
  const revision = object(adaptive?.revisionFingerprint);
  const identity = {
    work_id: text(work.work_id),
    run_id: text(loop?.run_id),
    task_id: text(task.id),
    request_digest: adaptive?.requestDigest,
    revision_fingerprint: revision,
    scope_fingerprint: adaptive?.scopeFingerprint,
    plan_revision: work.plan_revision,
  };
  const valid = identity.work_id && identity.run_id && identity.task_id
    && validDigest(identity.request_digest) && validDigest(identity.scope_fingerprint)
    && validDigest(identity.plan_revision) && revision?.status === 'available'
    && validDigest(revision.digest);
  return valid ? identity : null;
}

function acceptedBoundaries(loop) {
  return Array.isArray(loop.checkpoints)
    ? loop.checkpoints.map(object).filter((checkpoint) => checkpoint?.status === 'complete')
      .slice(-8).map((checkpoint) => ({
        id: text(checkpoint.id),
        summary: text(checkpoint.summary),
        evidence_paths: strings(checkpoint.evidence_paths),
      }))
    : [];
}

function blockerReasons(value) {
  return Array.isArray(value) ? strings(value.map((item) => text(object(item)?.reason))) : [];
}

function sameIdentity(left, right) {
  const candidate = object(right);
  const revision = object(candidate?.revision_fingerprint);
  return Boolean(candidate)
    && left.work_id === candidate.work_id
    && left.run_id === candidate.run_id
    && left.task_id === candidate.task_id
    && left.request_digest === candidate.request_digest
    && left.revision_fingerprint.status === revision?.status
    && left.revision_fingerprint.digest === revision?.digest
    && left.scope_fingerprint === candidate.scope_fingerprint
    && left.plan_revision === candidate.plan_revision;
}

function deriveContextCapsule(nativeState, expectedIdentity = null) {
  const state = object(nativeState);
  if (!state || !object(state.boulder) || !object(state.loop) || !object(state.sessions)) {
    return { status: 'malformed', capsule: null, reason: 'native-state-malformed' };
  }
  const work = activeWork(state.boulder);
  const task = work ? activeTask(work) : null;
  if (!work || !task) return { status: 'inactive', capsule: null, reason: 'no-active-task' };
  const identity = identityFor(work, task, state.loop);
  if (!identity) return { status: 'missing-identity', capsule: null, reason: 'identity-unavailable' };
  if (expectedIdentity && !sameIdentity(identity, expectedIdentity)) {
    return { status: 'stale', capsule: null, reason: 'identity-mismatch' };
  }
  const boundaries = acceptedBoundaries(state.loop);
  const evidence = [...new Set([
    ...boundaries.flatMap((boundary) => boundary.evidence_paths),
    ...work.tasks.map(object).filter((item) => item?.status === 'complete')
      .flatMap((item) => strings(item.evidence_paths)),
  ])].slice(0, 24);
  const blockers = [
    ...blockerReasons(work.blockers),
    ...blockerReasons(state.loop.review_blockers),
  ];
  return {
    status: expectedIdentity ? 'resumed' : 'current',
    reason: null,
    capsule: {
      version: 1,
      identity,
      objective: text(work.objective || work.plan_name),
      task: { id: identity.task_id, description: text(task.description), status: task.status },
      plan: { path: text(work.active_plan), section: text(task.plan_section) },
      owned_paths: strings(task.owned_paths),
      criteria: strings(task.criteria),
      commands: strings(task.commands),
      manual_qa_surface: text(task.manual_qa_surface),
      evidence_destination: text(task.evidence_destination),
      authority_constraints: strings(task.authority_constraints),
      adversarial_requirements: strings(task.adversarial_requirements),
      accepted_boundaries: boundaries,
      evidence_pointers: evidence,
      review_pointers: strings(task.review_paths),
      blockers,
      next_action: `continue task ${identity.task_id}`,
    },
  };
}

module.exports = { deriveContextCapsule };
