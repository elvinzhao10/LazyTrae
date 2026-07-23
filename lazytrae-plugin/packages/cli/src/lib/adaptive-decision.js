'use strict';

const {
  approvalClasses, boundedStrings, compatibleSnapshot, compatibleSnapshotIdentity,
  fingerprintContext, sha256Digest, stableDigest,
} = require('./adaptive-identity');
const {
  authorityBoundary, explicitWorkflow, ownershipFor, reasonSet, responsibilitySet,
} = require('./adaptive-policy');
const { validateAdaptiveSnapshot } = require('./adaptive-snapshot');

const ALL_STAGES = ['understand', 'plan', 'implement', 'debug', 'verify', 'review', 'continue'];
const ALL_RESPONSIBILITIES = ['exploration', 'planning', 'implementation', 'debugging', 'verification',
  'quality-review', 'security-review', 'release-review', 'continuity'];
const ALL_CAPABILITIES = ['text-search', 'structural-search', 'semantic-navigation',
  'architecture-context', 'documentation', 'execution', 'task-state', 'outcome-verification'];
const MODE_ORDER = ['direct', 'assisted', 'planned', 'orchestrated', 'long-horizon'];

const MODES = Object.freeze({
  direct: Object.freeze({
    stages: ['implement', 'verify'],
    responsibilities: ['implementation', 'verification'],
    capabilities: ['outcome-verification', 'text-search'],
    verificationLevel: 'targeted',
  }),
  assisted: Object.freeze({
    stages: ['understand', 'debug', 'implement', 'verify'],
    responsibilities: ['exploration', 'debugging', 'implementation', 'verification'],
    capabilities: ['outcome-verification', 'semantic-navigation', 'structural-search', 'text-search'],
    verificationLevel: 'standard',
  }),
  planned: Object.freeze({
    stages: ['understand', 'plan', 'implement', 'verify'],
    responsibilities: ['exploration', 'planning', 'implementation', 'verification'],
    capabilities: ['architecture-context', 'execution', 'outcome-verification',
      'semantic-navigation', 'structural-search', 'text-search'],
    verificationLevel: 'standard',
  }),
  orchestrated: Object.freeze({
    stages: ['understand', 'plan', 'implement', 'verify', 'review'],
    responsibilities: ['exploration', 'planning', 'implementation', 'verification',
      'quality-review'],
    capabilities: ['architecture-context', 'execution', 'outcome-verification',
      'semantic-navigation', 'structural-search', 'task-state', 'text-search'],
    verificationLevel: 'independent',
  }),
  'long-horizon': Object.freeze({
    stages: ['understand', 'plan', 'implement', 'verify', 'continue'],
    responsibilities: ['exploration', 'planning', 'implementation', 'verification', 'continuity'],
    capabilities: ['architecture-context', 'documentation', 'execution', 'outcome-verification',
      'semantic-navigation', 'structural-search', 'task-state', 'text-search'],
    verificationLevel: 'standard',
  }),
});

function selectMode(text, context, staleContinuation) {
  const explicit = explicitWorkflow(text, context);
  if (explicit) return explicit.mode;
  const named = context.named_workflow_class || '';
  if (named === 'plan-only' || /\b(plan[- ]only|create a plan only)\b/i.test(text)) return 'planned';
  if (/\bindependent review workflow\b/i.test(text)) return 'orchestrated';
  if (/\blong-horizon workflow\b/i.test(text)) return 'long-horizon';
  if (/\b(do this directly|direct workflow)\b/i.test(text)) return 'direct';
  if (staleContinuation || context.material_change || context.prior_completion_recorded) return 'assisted';
  if (context.session_scope === 'multi-session' || context.checkpoint_requirement === 'durable'
    || /\b(multi-session|multiple sessions|durable checkpoint|long-horizon)\b/i.test(text)) return 'long-horizon';
  const risks = [...boundedStrings(context.risk_signals), ...boundedStrings(context.scope_signals)].join(' ');
  if (/\b(security|authorization|release|publication|destructive|material-user-impact)\b/i.test(`${text} ${risks}`)
    || approvalClasses(text, context).length > 0
    || (Array.isArray(context.independent_workstreams)
      && context.independent_workstreams.length >= 2)) return 'orchestrated';
  const fileCount = context.file_count || context.file_count_estimate || context.repository?.fileCount || 0;
  if (context.scope === 'broad' || context.acceptance_criteria === 'incomplete'
    || (fileCount > 5 && boundedStrings(context.decisions_to_resolve).length > 0)) return 'planned';
  if (context.scope === 'bounded' || context.scope === 'cross-file'
    || context.repository_familiarity === 'unfamiliar' || (fileCount >= 2 && fileCount <= 5)
    || context.signals?.primarily_debugging || context.signals?.capability_unavailable) return 'assisted';
  return 'direct';
}

function riskFor(mode, text, context) {
  if (['low', 'standard', 'material', 'high'].includes(context.currentRisk || context.current_risk)) {
    return context.currentRisk || context.current_risk;
  }
  if (/\b(security|authorization)\b/i.test(text)) return 'high';
  if (mode === 'orchestrated' || mode === 'long-horizon') return 'material';
  if (mode === 'direct' || (mode === 'planned' && context.named_workflow_class === 'plan-only')) return 'low';
  return 'standard';
}

function escalationState(mode, context) {
  const prior = validateAdaptiveSnapshot(context.priorSnapshot || context.snapshot)
    ? context.priorSnapshot || context.snapshot : null;
  const history = Array.isArray(prior?.escalationHistory) ? prior.escalationHistory.slice(0, 2) : [];
  let currentMode = mode;
  if (context.signals?.verification_failure && history.length < 2) {
    history.push({ sequence: history.length + 1, trigger: 'verification-failure', fromMode: currentMode, toMode: currentMode, stageAdded: 'debug' });
  }
  if (context.scope_revealed_broader && history.length < 2) {
    const next = MODE_ORDER[Math.min(MODE_ORDER.indexOf(currentMode) + 1, MODE_ORDER.length - 1)];
    history.push({ sequence: history.length + 1, trigger: 'broader-scope-revealed', fromMode: currentMode, toMode: next, stageAdded: 'understand' });
    currentMode = next;
  }
  const exhausted = history.length === 2 && context.signals?.verification_failure && prior?.escalationCount >= 2;
  return {
    mode: currentMode,
    history,
    blocker: exhausted ? {
      attemptedApproaches: ['targeted correction', 'bounded debugging', 'one-level mode increase'],
      currentEvidence: 'verification still fails after two adjacent automatic escalations',
      nextRequiredDecision: 'decide whether to broaden the approved scope',
      reproducedFailure: 'current verification remains failing',
      unresolvedDecision: 'whether the task may broaden beyond the automatic escalation bound',
    } : null,
  };
}

function riskSignals(text, context) {
  const risks = `${text} ${boundedStrings(context.risk_signals).join(' ')}`;
  return {
    security: /\b(security|authorization|permission)\b/i.test(risks),
    release: /\b(release|publication|publish|deploy|version bump)\b/i.test(risks),
  };
}

function isVerificationFailure(context) {
  return context.signals?.verification_failure === true;
}

function hasStaleMaterial(stale, context) {
  return Boolean(stale || context.material_change || context.prior_completion_recorded);
}

function workflowIsNamedInRequest(request, explicit) {
  return Boolean(explicit && new RegExp(`\\b${explicit.workflow}\\b`, 'i').test(request));
}

function decisionReasons(request, context, mode, explicit, substitutions, staleMaterial, approvalClassesValue) {
  if (staleMaterial) {
    const changedRevision = Array.isArray(context.material_change)
      && context.material_change.includes('revisionFingerprint');
    const reasons = [
      changedRevision
        ? 'The revision fingerprint changed materially.'
        : 'Material continuation fingerprints changed.',
      'The stale snapshot is diagnostic only and prior completion is rejected.',
      'Current risk and approval were re-evaluated before reclassification.',
    ];
    if (approvalClassesValue.length) reasons.push(
      'A requested action crosses an approval-required authority boundary.',
    );
    return reasons;
  }
  if (explicit) {
    const namedInRequest = workflowIsNamedInRequest(request, explicit);
    const reasons = explicit.workflow === 'lazy-ulw-plan'
      ? namedInRequest
        ? [
          `The user explicitly selected ${explicit.workflow} as the authoritative workflow.`,
          'The classifier must not replace or deepen the explicit request.',
          'Implementation is excluded by the instruction.',
        ]
        : [
          'The user explicitly selected a named plan-only workflow.',
          'The classifier must not replace or deepen the explicit request.',
          'Implementation is excluded by the instruction.',
        ]
      : [
        'The user explicitly selected a named execution workflow.',
        'The classifier must not replace or deepen the explicit request.',
        `${explicit.workflow} is authoritative and retains its execution and verification stages.`,
      ];
    if (approvalClassesValue.length) reasons.push(
      'A requested action crosses an approval-required authority boundary.',
    );
    return reasons;
  }
  if (substitutions.length) {
    const reasons = [
      'The preferred capability class is unavailable.',
      'A safe substitution preserves assisted mode.',
      'Additional verification compensates for weaker navigation evidence.',
    ];
    if (approvalClassesValue.length) reasons.push(
      'A requested action crosses an approval-required authority boundary.',
    );
    return reasons;
  }
  if (isVerificationFailure(context)) {
    const reasons = ['The first verification failure adds a debugging stage.'];
    if (context.scope_revealed_broader === true) reasons.push(
      'The failure reveals broader scope and permits one mode increase.',
      'Two adjacent transitions consume the automatic escalation bound.',
    );
    if (approvalClassesValue.length) reasons.push(
      'A requested action crosses an approval-required authority boundary.',
    );
    return reasons;
  }
  const risk = riskSignals(request, context);
  let reasons;
  if (mode === 'direct') {
    reasons = [
      'The change is localized and its acceptance criteria are clear.',
      'Targeted verification is sufficient.',
      'The lowest sufficient mode is direct.',
    ];
  } else if (mode === 'assisted') {
    reasons = [
      'The defect crosses several unfamiliar components.',
      'Exploration and debugging are required before a bounded implementation.',
      'The scope does not justify orchestration.',
    ];
  } else if (mode === 'planned') {
    reasons = [
      'Acceptance criteria remain unresolved.',
      'Several design decisions must precede product edits.',
      'The scope is broad but does not require independent workstreams.',
    ];
  } else if (mode === 'orchestrated' && risk.security) {
    reasons = [
      'Authorization behavior is security-sensitive.',
      'Material risk requires independent verification and security review.',
      'Review responsibility is automatic and selects no approval action class.',
    ];
  } else if (mode === 'orchestrated' && risk.release) {
    reasons = [
      'Release preparation is materially risky and needs independent evidence.',
      'Release review is a responsibility rather than an approval action class.',
      'Publication mutation remains outside the selected actions.',
    ];
  } else if (mode === 'orchestrated') {
    reasons = [
      'Independent workstreams require orchestration.',
      'Implementation and review have distinct owners.',
    ];
  } else {
    reasons = [
      'The request explicitly spans multiple sessions.',
      'Durable checkpoints and repeated cycles are required.',
      'Existing package-owned continuation state is sufficient.',
    ];
  }
  if (approvalClassesValue.length) reasons.push(
    'A requested action crosses an approval-required authority boundary.',
  );
  return reasons;
}

function notSelectedReasons(request, context, mode, explicit, substitutions, staleMaterial) {
  if (staleMaterial) return [
    'The changed revision requires fresh understanding but not a full new plan.',
    'Prior completion evidence cannot satisfy current verification.',
  ];
  if (explicit) return explicit.workflow === 'lazy-ulw-plan'
    ? [
      'The explicit instruction stops before execution.',
      'No durable continuation is required for a plan-only result.',
    ]
    : [
      'Only stages outside the named workflow are omitted.',
      'The named workflow is not replaced by a deeper adaptive workflow.',
    ];
  if (substitutions.length) return [
    'A bounded class-level substitution avoids deeper workflow selection.',
    'No durable continuation is required.',
  ];
  if (isVerificationFailure(context)) return [
    'The revealed scope remains bounded after one mode increase.',
    'Durable continuation and independent review are unnecessary.',
  ];
  const risk = riskSignals(request, context);
  if (mode === 'direct') return [
    'The request is already localized and does not need broader context.',
    'The task does not need resumable state or independent review.',
  ];
  if (mode === 'assisted') return [
    'The cross-file trace is bounded and does not require broad architecture context.',
    'The work is expected to finish without durable continuation.',
  ];
  if (mode === 'planned') return [
    'The feature is bounded to one session and needs no durable continuation.',
    'Independent review is not justified by the current risk.',
  ];
  if (risk.security) return [
    'No documentation change is required by this authorization correction.',
    'Release review is outside the selected responsibility set.',
  ];
  if (risk.release) return [
    'No separate documentation capability is necessary for the bounded release metadata edits.',
    'Publication mutation is explicitly excluded from the request.',
  ];
  return [
    'The multi-session migration requires the complete portable capability class set.',
    'Independent review is not selected solely because work spans sessions.',
  ];
}

function titleCase(value) {
  return value.length ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function userExplanation(request, context, mode, explicit, substitutions, staleMaterial, approvalClassesValue) {
  let values;
  if (staleMaterial) {
    values = [
      'Current approval classes were re-evaluated and none are selected.',
      'Prior completion is rejected and fresh standard verification is required.',
      'A full restart and reuse of stale completion are both unnecessary.',
      'Assisted reclassification begins from fresh understanding after the revision change.',
    ];
  } else if (explicit) {
    const planOnly = explicit.workflow === 'lazy-ulw-plan';
    const namedInRequest = workflowIsNamedInRequest(request, explicit);
    values = [
      'No approval action class is selected.',
      planOnly
        ? 'The plan artifact receives a targeted structural check.'
        : `${titleCase(MODES[mode].verificationLevel)} verification follows the named workflow.`,
      planOnly
        ? 'Implementation and continuation are excluded by the user.'
        : 'Only stages outside the named workflow are excluded.',
      planOnly
        ? namedInRequest ? `${explicit.workflow} is authoritative as requested.` : 'The named plan-only workflow is authoritative.'
        : `${explicit.workflow} is authoritative as requested.`,
    ];
  } else if (substitutions.length) {
    values = [
      'No install or activation approval is requested because existing classes provide the fallback.',
      'Additional verification compensates for the weaker substitution.',
      'A deeper mode and new capability activation are unnecessary.',
      'Assisted mode uses structural and text search as allowed substitution classes.',
    ];
  } else if (isVerificationFailure(context)) {
    values = [
      'No approval action class is selected.',
      'Standard verification reruns after bounded debugging.',
      'Planning and orchestration remain unnecessary after one mode increase.',
      'Debugging was added first; assisted mode followed only after broader scope was proven.',
    ];
  } else {
    const risk = riskSignals(request, context);
    if (mode === 'direct') values = [
      'No approval action class is selected.',
      'A focused check is sufficient evidence.',
      'Planning, continuation, and independent review are unnecessary.',
      'Direct implementation and targeted verification are selected.',
    ];
    else if (mode === 'assisted') values = [
      'No approval action class is selected.',
      'Standard verification follows the diagnostic correction.',
      'Planning and durable continuation are unnecessary for this bounded trace.',
      'Assisted exploration and debugging precede implementation.',
    ];
    else if (mode === 'planned') values = [
      'No approval action class is selected.',
      'Standard verification follows the approved design.',
      'Durable continuation and independent review are unnecessary.',
      'Planning resolves the open design choices before implementation.',
    ];
    else if (risk.security) values = [
      'No approval action class is selected by security review itself.',
      'Independent verification and security review are required.',
      'Release and continuation responsibilities are outside this bounded change.',
      'Orchestration separates implementation from independent review.',
    ];
    else if (risk.release) values = [
      'No approval is required until an excluded publish mutation is requested.',
      'Independent release review and artifact verification are required.',
      'Publishing and account mutation are not selected.',
      'Release preparation is orchestrated with independent evidence.',
    ];
    else values = [
      'Package-owned local checkpoints are automatic for this task.',
      'Each checkpoint retains standard verification evidence.',
      'A replacement state system and independent review are unnecessary.',
      'Long-horizon continuation preserves progress across multiple sessions.',
    ];
  }
  if (approvalClassesValue.length) values[0] = `Approval is pending for: ${approvalClassesValue.join(', ')}.`;
  return {
    approval: values[0],
    evidence: values[1],
    not_selected: values[2],
    selected: values[3],
  };
}

function composeDecision(request, context, selectedMode, identity, stale) {
  const approvalRequiredClasses = approvalClasses(request, context);
  const approval = { requiredClasses: approvalRequiredClasses, status: approvalRequiredClasses.length ? 'pending' : 'not-required' };
  const escalation = escalationState(selectedMode, context);
  const mode = escalation.mode;
  const selectedRisk = riskFor(mode, request, context);
  const config = MODES[mode];
  const explicit = explicitWorkflow(request, context);
  const explicitPlanOnly = explicit?.workflow === 'lazy-ulw-plan' || /\b(plan[- ]only|create a plan only)\b/i.test(request);
  const stages = explicitPlanOnly ? ['understand', 'plan'] : [...config.stages];
  if (!explicitPlanOnly && escalation.history.some((entry) => entry.stageAdded === 'debug')
    && !stages.includes('debug')) stages.splice(Math.max(0, stages.indexOf('implement')), 0, 'debug');
  const responsibilities = explicitPlanOnly
    ? ['exploration', 'planning']
    : responsibilitySet(mode, request, context, config.responsibilities);
  if (stages.includes('debug') && !responsibilities.includes('debugging')) responsibilities.splice(
    Math.max(0, responsibilities.indexOf('implementation')), 0, 'debugging',
  );
  const capabilities = explicitPlanOnly
    ? ['architecture-context', 'outcome-verification', 'semantic-navigation', 'structural-search', 'text-search']
    : [...config.capabilities];
  const substitutions = context.signals?.capability_unavailable ? [{
    requiredClass: 'semantic-navigation',
    allowedSubstitutionClasses: ['structural-search', 'text-search'],
    evidenceDowngrade: 'additional-verification-required',
    explanation: 'Structural and text search preserve discovery coverage but require additional verification.',
  }] : [];
  const staleMaterial = hasStaleMaterial(stale, context);
  const reasons = decisionReasons(
    request, context, mode, explicit, substitutions, staleMaterial, approvalRequiredClasses,
  );
  const snapshotReasons = explicitPlanOnly
    ? ['The explicit named workflow is authoritative.', 'Implementation is excluded by the instruction.']
    : reasonSet(mode, stale, context, request);
  const nextAction = approvalRequiredClasses.length
    ? 'Wait for explicit approval before dispatch.'
    : escalation.blocker
      ? escalation.blocker.nextRequiredDecision
      : explicitPlanOnly
        ? 'Produce the approved plan and stop before implementation.'
        : stale || context.material_change || context.prior_completion_recorded
          ? 'Preserve the stale diagnostic, reject prior completion, and run fresh verification.'
          : context.signals?.verification_failure
            ? 'Trace the broader dependency, apply the bounded correction, and rerun standard verification.'
            : context.signals?.capability_unavailable
              ? 'Use the allowed substitution classes and add the compensating verification.'
              : {
                direct: 'Apply the localized correction and run the focused check.',
                assisted: 'Trace the stale-data behavior across the bounded components.',
                planned: 'Resolve the four design decisions and approve a bounded implementation plan.',
                orchestrated: /\b(release|publication)\b/i.test(`${request} ${boundedStrings(context.risk_signals).join(' ')}`)
                  ? 'Prepare release artifacts and capture independent verification without publishing.'
                  : 'Assign implementation and independent review to distinct owners.',
                'long-horizon': 'Establish the first checkpoint and begin the bounded migration plan.',
              }[mode];
  const priorDecisionId = context.priorSnapshot?.decisionId || context.snapshot?.decisionId || 'none';
  const decisionSeed = `${identity.requestDigest}:${identity.scopeFingerprint}:${identity.hostFingerprint}:${identity.revisionFingerprint.digest || 'unavailable'}:${stale ? `reclassified:${priorDecisionId}` : 'fresh'}`;
  const decisionId = context.decisionId || `decision-${sha256Digest(decisionSeed).slice(7, 23)}`;
  const snapshot = {
    version: 1,
    decisionId,
    requestDigest: identity.requestDigest,
    mode,
    stages,
    currentStage: stages[0],
    responsibilities,
    capabilityClasses: capabilities,
    capabilitySubstitutions: substitutions,
    approval,
    escalationCount: escalation.history.length,
    escalationHistory: escalation.history,
    revisionFingerprint: identity.revisionFingerprint,
    scopeFingerprint: identity.scopeFingerprint,
    hostFingerprint: identity.hostFingerprint,
    risk: selectedRisk,
    reasons: snapshotReasons,
    blocker: escalation.blocker,
    nextAction,
    verificationLevel: explicitPlanOnly ? 'targeted' : config.verificationLevel,
  };
  return {
    explicitWorkflow: explicit?.workflow || null,
    mode,
    stages,
    responsibilities,
    capabilities,
    approval_required: approvalRequiredClasses.length > 0,
    approval_classes: approvalRequiredClasses,
    verification_level: explicitPlanOnly ? 'targeted' : config.verificationLevel,
    allowed_substitutions: substitutions,
    authority_boundary: authorityBoundary(mode, explicitPlanOnly, context, approvalRequiredClasses),
    ownership: ownershipFor(mode, stages, responsibilities),
    not_selected: {
      stages: ALL_STAGES.filter((stage) => !stages.includes(stage)).sort(),
      responsibilities: ALL_RESPONSIBILITIES.filter((item) => !responsibilities.includes(item)).sort(),
      capabilities: ALL_CAPABILITIES.filter((item) => !capabilities.includes(item)).sort(),
      reasons: notSelectedReasons(
        request, context, mode, explicit, substitutions, staleMaterial,
      ),
    },
    user_explanation: userExplanation(
      request, context, mode, explicit, substitutions, staleMaterial, approvalRequiredClasses,
    ),
    reasons,
    snapshot,
  };
}

const CONTINUATION_SEMANTIC_FIELDS = [
  'capabilityClasses',
  'capabilitySubstitutions',
  'mode',
  'responsibilities',
  'stages',
  'verificationLevel',
];

function hasCompatibleDecisionSemantics(prior, current) {
  return CONTINUATION_SEMANTIC_FIELDS.every(
    (field) => JSON.stringify(prior[field]) === JSON.stringify(current[field]),
  );
}

function replayContinuationMode(selectedMode, prior) {
  let mode = selectedMode;
  for (const entry of prior.escalationHistory) {
    if (entry.fromMode !== mode) return null;
    if (entry.trigger === 'verification-failure') {
      if (entry.toMode !== mode || entry.stageAdded !== 'debug') return null;
    } else if (entry.trigger === 'broader-scope-revealed') {
      const next = MODE_ORDER[Math.min(MODE_ORDER.indexOf(mode) + 1, MODE_ORDER.length - 1)];
      if (entry.toMode !== next || entry.stageAdded !== 'understand') return null;
    } else {
      return null;
    }
    mode = entry.toMode;
  }
  return mode === prior.mode ? mode : null;
}

function classifyAdaptiveDecision(request, context = {}) {
  const ctx = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const text = typeof request === 'string' ? request : String(request || '');
  const identity = fingerprintContext(text, ctx);
  const prior = ctx.priorSnapshot || ctx.snapshot || ctx.adaptive_snapshot || null;
  const preliminaryMode = selectMode(text, ctx, false);
  const currentApproval = { requiredClasses: approvalClasses(text, ctx) };
  const identityCompatible = compatibleSnapshotIdentity(prior, identity);
  const continuationMode = identityCompatible ? replayContinuationMode(preliminaryMode, prior) : null;
  const currentRisk = riskFor(continuationMode || preliminaryMode, text, ctx);
  const semanticContext = {
    ...ctx,
    scope_revealed_broader: false,
    signals: { ...ctx.signals, verification_failure: false },
  };
  const expected = continuationMode
    ? composeDecision(text, semanticContext, continuationMode, identity, false)
    : null;
  if (compatibleSnapshot(prior, identity, currentRisk, currentApproval)
    && expected
    && hasCompatibleDecisionSemantics(prior, expected.snapshot)) {
    const resumed = composeDecision(text, { ...ctx, decisionId: prior.decisionId }, prior.mode, identity, false);
    resumed.snapshot.currentStage = prior.currentStage;
    resumed.reasons = ['All continuation fingerprints remain compatible.', 'Current risk and approval were re-evaluated before reuse.'];
    resumed.snapshot.reasons = [...resumed.reasons];
    return resumed;
  }
  if (identityCompatible) {
    const freshContext = {
      ...ctx,
      adaptive_snapshot: null,
      decisionId: undefined,
      priorSnapshot: null,
      snapshot: null,
    };
    return composeDecision(text, freshContext, preliminaryMode, identity, true);
  }
  const stale = Boolean(prior);
  const mode = selectMode(text, ctx, stale);
  const decision = composeDecision(text, ctx, mode, identity, stale);
  return decision;
}

module.exports = {
  MODES,
  classifyAdaptiveDecision,
  sha256Digest,
  stableDigest,
};
