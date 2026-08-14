'use strict';

const path = require('node:path');
const { classifyAdaptiveDecision, stableDigest } = require('./adaptive-decision');
const {
  mapAdaptiveDecisionToSurfaces,
  qualifyInstalledHost,
} = require('./adaptive-mapping');
const { computeRevisionFingerprint } = require('./adaptive-revision');
const { writeAdaptiveSnapshot } = require('./adaptive-snapshot');
const { runtimeFingerprints } = require('./adaptive-host-fingerprint');
const {
  appendEvent,
  canonicalEventPath,
  loadLoop,
  loopArtifactPaths,
  saveLoop,
  statePath,
} = require('./loop-store');
const { assertSafeRepoWritePath } = require('./path-boundary');

const ACTIVE_LOOP_STATES = new Set([
  'initializing', 'planning', 'active', 'verifying', 'reviewing', 'blocked', 'paused',
]);

function malformedAdaptiveDirective() {
  return {
    version: 1,
    kind: 'workflow-decision',
    mode: null,
    stages: [],
    responsibilities: [],
    capabilityClasses: [],
    verificationLevel: null,
    approval: { requiredClasses: [], status: 'not-required' },
    workflowSurfaces: [],
    hostQualification: 'unverified',
    dispatch: 'blocked:malformed-input',
    hostExecution: 'not-observed',
    persistence: 'skipped:malformed-input',
    requestDigest: null,
    continuation: { status: 'fresh' },
  };
}

function formatAdaptiveDirective(directive) {
  return `${JSON.stringify({ lazytraeAdaptive: directive })}\n`;
}

function safeLoop(repoRoot) {
  try {
    assertSafeRepoWritePath(repoRoot, statePath(repoRoot));
    const loop = loadLoop(repoRoot);
    if (!loop || !ACTIVE_LOOP_STATES.has(loop.loop_state)) return { loop: null, warning: null };
    loopArtifactPaths(loop);
    return { loop, warning: null };
  } catch (error) {
    return { loop: null, warning: error.message };
  }
}

function changedMaterial(prior, current) {
  const fields = ['requestDigest', 'revisionFingerprint', 'scopeFingerprint', 'hostFingerprint'];
  return fields.filter((field) => JSON.stringify(prior?.[field]) !== JSON.stringify(current[field]));
}

function preflightPersistence(repoRoot, loop, diagnosticRequired) {
  const artifacts = loopArtifactPaths(loop);
  const targets = [
    statePath(repoRoot),
    path.join(repoRoot, artifacts.goals_path),
  ];
  if (diagnosticRequired) {
    targets.push(
      path.join(repoRoot, artifacts.ledger_path),
      path.join(repoRoot, '.lazytrae', 'logs', 'loop-events.ndjson'),
      canonicalEventPath(repoRoot, loop),
    );
  }
  targets.forEach((target) => assertSafeRepoWritePath(repoRoot, target));
}

function persistDecision(repoRoot, originalLoop, decision, continuationStatus) {
  const latest = safeLoop(repoRoot);
  if (latest.warning) return { persistence: 'skipped:unsafe-state', warning: latest.warning };
  if (!latest.loop || latest.loop.run_id !== originalLoop.run_id) {
    return { persistence: 'skipped:active-loop-changed', warning: null };
  }
  try {
    const diagnosticRequired = continuationStatus === 'reclassified';
    preflightPersistence(repoRoot, latest.loop, diagnosticRequired);
    if (diagnosticRequired) {
      appendEvent(repoRoot, latest.loop, 'adaptive-decision-reclassified', {
        changed_material: changedMaterial(originalLoop.adaptive, decision.snapshot),
        prior_completion: 'rejected',
        prior_decision_id: originalLoop.adaptive?.decisionId || null,
      });
    }
    writeAdaptiveSnapshot(latest.loop, decision.snapshot);
    saveLoop(repoRoot, latest.loop);
    return { persistence: 'updated:active-loop', warning: null };
  } catch (error) {
    return { persistence: 'skipped:unsafe-state', warning: error.message };
  }
}

function dispatchStatus(decision, hostQualification, revisionFingerprint, persistence) {
  if (decision.snapshot.approval.status === 'pending') return 'blocked:approval-required';
  if (hostQualification !== 'package-assets-verified') return 'blocked:host-unverified';
  if (revisionFingerprint.status !== 'available') return 'blocked:revision-unavailable';
  if (persistence === 'skipped:unsafe-state') return 'blocked:unsafe-state';
  if (decision.snapshot.blocker) return 'blocked:escalation-bound';
  return 'presented-to-host';
}

function processAdaptivePrompt({ repoRoot, prompt, context = {} }) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { directive: malformedAdaptiveDirective(), warning: null };
  }
  const initial = safeLoop(repoRoot);
  const revisionFingerprint = computeRevisionFingerprint(repoRoot);
  let host;
  try {
    host = qualifyInstalledHost(repoRoot);
  } catch (error) {
    host = { qualification: 'degraded', workflowSurfaces: [] };
    initial.warning = initial.warning || error.message;
  }
  const scopeFingerprint = stableDigest({
    boundary: 'adaptive-intake',
    scope: context.scope || 'prompt-intake',
  });
  const nativeFingerprints = runtimeFingerprints(repoRoot, context);
  const priorSnapshot = initial.loop?.adaptive || null;
  const decision = classifyAdaptiveDecision(prompt, {
    ...context,
    revisionFingerprint,
    scopeFingerprint,
    ...nativeFingerprints,
    priorSnapshot,
  });
  const continuationStatus = priorSnapshot
    ? (decision.snapshot.decisionId === priorSnapshot.decisionId ? 'resumed' : 'reclassified')
    : 'fresh';
  const mapping = mapAdaptiveDecisionToSurfaces(decision, { repoRoot });
  const workflowSurfaces = decision.explicitWorkflow
    ? [decision.explicitWorkflow]
    : mapping.workflow_surfaces;
  let persisted = initial.warning
    ? { persistence: 'skipped:unsafe-state', warning: initial.warning }
    : { persistence: 'skipped:no-active-loop', warning: null };
  if (initial.loop) persisted = persistDecision(repoRoot, initial.loop, decision, continuationStatus);
  const dispatch = dispatchStatus(
    decision,
    mapping.host_qualification,
    revisionFingerprint,
    persisted.persistence,
  );
  const directive = {
    version: 1,
    kind: 'workflow-decision',
    mode: decision.mode,
    stages: decision.stages,
    responsibilities: decision.responsibilities,
    capabilityClasses: decision.capabilities,
    verificationLevel: decision.verification_level,
    approval: decision.snapshot.approval,
    explicitWorkflow: decision.explicitWorkflow,
    workflowSurfaces: dispatch === 'presented-to-host' ? workflowSurfaces : [],
    hostQualification: mapping.host_qualification,
    dispatch,
    hostExecution: 'not-observed',
    persistence: persisted.persistence,
    requestDigest: decision.snapshot.requestDigest,
    continuation: { status: continuationStatus },
  };
  return { directive, snapshot: decision.snapshot, warning: persisted.warning };
}

module.exports = {
  computeRevisionFingerprint,
  formatAdaptiveDirective,
  malformedAdaptiveDirective,
  processAdaptivePrompt,
};
