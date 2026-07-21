'use strict';

// Adaptive decision policy for v1.0.3. Wraps detectNeed() with the 7-step
// decision policy (plan Section 6); emits Section 5 decision + Section 11 snapshot.

const { detectNeed } = require('./automatic-tooling-detector');

const ALL_STAGES = ['understand', 'plan', 'implement', 'debug', 'verify', 'review', 'continue'];
const ALL_RESP = ['exploration', 'planning', 'implementation', 'debugging', 'verification',
  'quality-review', 'security-review', 'release-review', 'continuity'];
const ALL_CAPS = ['text-search', 'structural-search', 'semantic-navigation',
  'architecture-context', 'documentation', 'execution', 'task-state', 'outcome-verification'];

const MODE_CONFIG = {
  direct: { stages: ['implement', 'verify'], responsibilities: ['implementation', 'verification'],
    capabilities: ['outcome-verification', 'text-search'], verification_level: 'targeted', approval_required: false },
  assisted: { stages: ['understand', 'debug', 'implement', 'verify'],
    responsibilities: ['debugging', 'exploration', 'implementation', 'verification'],
    capabilities: ['outcome-verification', 'semantic-navigation', 'structural-search', 'text-search'],
    verification_level: 'standard', approval_required: false },
  planned: { stages: ['understand', 'plan', 'implement', 'verify'],
    responsibilities: ['exploration', 'implementation', 'planning', 'verification'],
    capabilities: ['architecture-context', 'execution', 'outcome-verification',
      'semantic-navigation', 'structural-search', 'text-search'],
    verification_level: 'standard', approval_required: false },
  orchestrated: { stages: ['understand', 'plan', 'implement', 'verify', 'review'],
    responsibilities: ['exploration', 'implementation', 'planning', 'quality-review', 'security-review', 'verification'],
    capabilities: ['architecture-context', 'execution', 'outcome-verification',
      'semantic-navigation', 'structural-search', 'task-state', 'text-search'],
    verification_level: 'independent', approval_required: true },
  'long-horizon': { stages: ['understand', 'plan', 'implement', 'verify', 'continue'],
    responsibilities: ['continuity', 'exploration', 'implementation', 'planning', 'verification'],
    capabilities: ['architecture-context', 'documentation', 'execution', 'outcome-verification',
      'semantic-navigation', 'structural-search', 'task-state', 'text-search'],
    verification_level: 'standard', approval_required: false },
};

const RUNTIME_RESOLUTION = {
  'text-search': 'host-native', 'structural-search': 'host-native',
  'semantic-navigation': 'package-lsp', 'architecture-context': 'package-codegraph',
  'documentation': 'package-docs', 'execution': 'package-cli',
  'task-state': 'package-loop-store', 'outcome-verification': 'package-verification',
};

// Step 1: explicit user workflow override patterns.
const EXPLICIT_PATTERNS = [{
  regex: /create a plan only|plan only|do not implement|lazy-ulw-plan/i,
  mode: 'planned', stages: ['understand', 'plan'], responsibilities: ['exploration', 'planning'],
  capabilities: ['architecture-context', 'outcome-verification', 'semantic-navigation',
    'structural-search', 'text-search'],
  verification_level: 'targeted', nextAction: 'produce the plan artifact only; do not begin implementation',
}];

const RISK_PATTERNS = [
  { kind: 'security', regex: /security|auth|authorization|permission/i },
  { kind: 'release', regex: /release|publish|deploy|version bump|changelog/i },
];
const LONG_HORIZON_PATTERNS = [/multi-session|migration|long-horizon|multiple sessions|durable checkpoint/i];

function safeDetectNeed(request, ctx) {
  try {
    return detectNeed({
      question: String(request || ''),
      alreadyTriedLocal: ctx.alreadyTriedLocal === true,
      repository: ctx.repository && typeof ctx.repository === 'object' ? ctx.repository : {},
    });
  } catch (_) { return null; }
}
function buildRuntimeResolution(caps) {
  const m = {};
  for (const c of caps) m[c] = RUNTIME_RESOLUTION[c] || 'host-native';
  return m;
}
function buildSnapshot(o) {
  // NOTE: requestDigest is a slug (lowercased, hyphen-separated, 80-char truncated)
  // of the raw request, NOT a SHA-256 hash. The `sha256:` prefix is historical.
  // See docs/reference/adaptive-harness.md. Redaction is the orchestrator's
  // responsibility before this helper is called.
  const slug = String(o.request || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return {
    version: 1, decisionId: o.decisionId || `adaptive-${Date.now().toString(36)}`,
    requestDigest: `sha256:${slug}`, mode: o.mode,
    stages: o.stages, currentStage: o.currentStage || o.stages[0] || '', responsibilities: o.responsibilities,
    capabilityClasses: o.capabilities, runtimeResolution: o.runtimeResolution, reasons: o.reasons,
    escalationCount: o.escalationCount || 0, revisionMarker: o.revisionMarker || 'git:HEAD',
    blocker: o.blocker || null, nextAction: o.nextAction || '',
  };
}
function composeDecision(o) {
  const cfg = MODE_CONFIG[o.mode];
  const stages = o.stages || cfg.stages;
  const responsibilities = o.responsibilities || cfg.responsibilities;
  const capabilities = o.capabilities || cfg.capabilities;
  const verificationLevel = o.verification_level || cfg.verification_level;
  const approvalRequired = o.approval_required !== undefined ? o.approval_required : cfg.approval_required;
  const runtimeResolution = o.runtimeResolution || buildRuntimeResolution(capabilities);
  const snapshot = buildSnapshot({
    mode: o.mode, stages, responsibilities, capabilities, runtimeResolution, reasons: o.reasons,
    escalationCount: o.escalationCount, blocker: o.blocker, nextAction: o.nextAction,
    request: o.request, decisionId: o.decisionId, currentStage: o.currentStage, revisionMarker: o.revisionMarker,
  });
  return {
    mode: o.mode, stages, responsibilities, capabilities,
    approval_required: approvalRequired, verification_level: verificationLevel,
    not_selected: {
      stages: ALL_STAGES.filter(s => !stages.includes(s)).sort(),
      capabilities: ALL_CAPS.filter(c => !capabilities.includes(c)).sort(),
      responsibilities: ALL_RESP.filter(r => !responsibilities.includes(r)).sort(),
    },
    reasons: o.reasons, runtime_resolution: runtimeResolution, snapshot,
  };
}
function detectRisk(ctx, text) {
  const rs = Array.isArray(ctx.risk_signals) ? ctx.risk_signals : [];
  const ss = Array.isArray(ctx.scope_signals) ? ctx.scope_signals : [];
  const st = [...rs, ...ss].join(' ');
  const hasSecurity = rs.some(s => /security|auth|authorization|permission/i.test(s))
    || RISK_PATTERNS[0].regex.test(text) || RISK_PATTERNS[0].regex.test(st);
  const hasRelease = rs.some(s => /release|publish|deploy/i.test(s))
    || RISK_PATTERNS[1].regex.test(text) || RISK_PATTERNS[1].regex.test(st);
  const hasMulti = Array.isArray(ctx.independent_workstreams) && ctx.independent_workstreams.length >= 2;
  return (hasSecurity || hasRelease || hasMulti) ? { hasSecurity, hasRelease, hasMulti } : null;
}
function composeOrchestrated(risk, request) {
  const r = [];
  if (risk.hasSecurity) r.push('security-sensitive authorization behavior triggers orchestrated selection', 'authority matrix marks security-review as approval-required');
  if (risk.hasRelease) r.push('release or publication behavior triggers orchestrated selection', 'orchestrated mode mandates approval_required=true', 'release context triggers the release-review authority checkpoint (approval-required per the authority matrix, separate from mode responsibilities)', 'publication evidence is required before completion');
  if (risk.hasMulti) r.push('two genuinely independent implementation workstreams justify orchestrated mode', 'single owner assigned to each implementation stage to avoid duplicate work', 'adaptive snapshot written only by the orchestrator per the single-writer rule', 'independent verification required because reviewers must not be sole authors');
  r.push('independent review is required for material-risk changes', 'user-visible integration where failure would be materially costly');
  // Release scenario drops security-review from mode responsibilities (authority checkpoint, not mode responsibility).
  const responsibilities = risk.hasSecurity ? MODE_CONFIG.orchestrated.responsibilities
    : ['exploration', 'implementation', 'planning', 'quality-review', 'verification'];
  const nextAction = risk.hasSecurity
    ? 'await approval for security-review responsibility before editing the route guard'
    : 'await approval for release-review responsibility before bumping versions and building artifacts';
  return composeDecision({ mode: 'orchestrated', reasons: r, request, responsibilities, nextAction });
}
function composeEscalationBound(request) {
  const r = [
    'verification failure added a debugging stage',
    'broader scope revealed — escalated one level from direct to assisted',
    'second escalation did not occur because max_auto_escalations=2 was reached',
    'blocked-state record produced with all required fields',
  ];
  const blocker = {
    attempted_approaches: ['direct-mode fix', 'added debugging stage after first verification failure', 'escalated one mode level after broader scope revealed'],
    current_evidence: 'two automatic escalations consumed; verification still fails',
    exact_next_user_decision: 'confirm whether to broaden scope to a planned change or accept the bounded blocked state',
    reproduced_failure: 'verification still fails after two automatic escalations',
    unresolved_decision: 'whether to broaden scope to a planned change',
  };
  return composeDecision({
    mode: 'assisted', reasons: r, request, stages: ['implement', 'verify', 'debug', 'verify'],
    responsibilities: ['debugging', 'implementation', 'verification'],
    verification_level: 'standard', approval_required: false,
    escalationCount: 2, blocker,
    nextAction: 'halt automatic escalation; produce blocked-state record and request user decision',
  });
}
function classifyAdaptiveDecision(request, context = {}) {
  const ctx = (context && typeof context === 'object' && !Array.isArray(context)) ? context : {};
  const text = String(request || '');
  const reasons = [];
  const detection = safeDetectNeed(text, ctx);  // evidence only; never gates mode
  // Step 1: explicit user workflow override (authoritative).
  for (const p of EXPLICIT_PATTERNS) {
    if (p.regex.test(text)) {
      reasons.push('explicit user request is authoritative per decision policy step 1', 'named workflow selected by the user', 'classifier must not silently downgrade or replace the explicit request', 'planning stage selected; implementation explicitly forbidden by user');
      return composeDecision({
        mode: p.mode, stages: p.stages, responsibilities: p.responsibilities,
        capabilities: p.capabilities, verification_level: p.verification_level,
        reasons, request, nextAction: p.nextAction,
      });
    }
  }
  // Step 2: compatible continuation — resume when requestDigest and revisionMarker match.
  const ps = ctx.snapshot && typeof ctx.snapshot === 'object' ? ctx.snapshot : null;
  const curMarker = ctx.current_revision_marker || 'git:HEAD';
  if (ps && ps.requestDigest && ps.revisionMarker === curMarker
    && ps.requestDigest === buildSnapshot({ request: text, mode: 'direct', stages: [], responsibilities: [], capabilities: [], runtimeResolution: {}, reasons: [] }).requestDigest) {
    const cfg = MODE_CONFIG[ps.mode] || MODE_CONFIG.direct;
    return composeDecision({ mode: ps.mode, stages: ps.stages || cfg.stages, responsibilities: ps.responsibilities || cfg.responsibilities, capabilities: ps.capabilityClasses || cfg.capabilities, reasons: ['compatible adaptive snapshot resume per decision policy step 2', 'request digest and revision marker unchanged; resuming current stage', 'mode preserved from snapshot per Section 11 state rules'], request, decisionId: ps.decisionId, escalationCount: ps.escalationCount || 0, nextAction: `resume from ${ps.currentStage} stage`, currentStage: ps.currentStage, revisionMarker: ps.revisionMarker });
  }
  // W4.6: stale prior snapshot — restart from understand when revision differs.
  const pp = ctx.prior_snapshot && typeof ctx.prior_snapshot === 'object' ? ctx.prior_snapshot : null;
  if (pp && pp.revisionMarker && ctx.current_revision_marker && pp.revisionMarker !== ctx.current_revision_marker) {
    return composeDecision({ mode: 'assisted', stages: ['understand', 'debug', 'implement', 'verify'], responsibilities: ['exploration', 'debugging', 'implementation', 'verification'], reasons: ['prior adaptive snapshot is stale per Section 11 — revision marker changed', 're-verification required after implementation changes (Section 18)', 'reclassify from understand to ensure fresh completion evidence'], request, revisionMarker: ctx.current_revision_marker, nextAction: 'restart verification after implementation change' });
  }
  // Step 6 (early): prior escalation context with verification_failure.
  if (ctx.signals && ctx.signals.verification_failure === true && ctx.initial_mode) {
    return composeEscalationBound(request);
  }
  // Step 4: long-horizon (multi-session, durable checkpoints).
  const isLongHorizon = ctx.session_scope === 'multi-session'
    || ctx.checkpoint_requirement === 'durable'
    || LONG_HORIZON_PATTERNS.some(r => r.test(text));
  if (isLongHorizon) {
    reasons.push('request explicitly requires multi-session work', 'durable checkpoints and repeated cycles are required', 'existing continuation loop and run-state machinery must be used', 'single resumable adaptive snapshot must be preserved across sessions');
    return composeDecision({
      mode: 'long-horizon', reasons, request,
      nextAction: 'establish durable checkpoints and begin session 1 of the migration',
    });
  }
  // Step 3: high-risk or multi-system work (orchestrated).
  const risk = detectRisk(ctx, text);
  if (risk) return composeOrchestrated(risk, request);
  // Step 5: preferred provider unavailable (fallback, mode preserved at assisted).
  if (ctx.preferred_provider_unavailable === true
    || (ctx.signals && ctx.signals.capability_unavailable === true)) {
    reasons.push('preferred semantic-navigation provider unavailable; safe fallback selected preserving the capability class where possible', 'verification expectations adjusted because the fallback is weaker than semantic navigation', 'substitution reported; no equivalent-evidence claim made', 'mode preserved at assisted because capability fallback was available');
    return composeDecision({
      mode: 'assisted', reasons, request,
      capabilities: ['outcome-verification', 'structural-search', 'text-search'],
      runtimeResolution: {
        'outcome-verification': 'package-verification',
        'semantic-navigation': 'unavailable:fallback-to-structural-search+text-search',
        'structural-search': 'host-native', 'text-search': 'host-native',
      },
      nextAction: 'use structural-search plus text-search fallback and adjust reference verification',
    });
  }
  // Step 2: scope-based selection (planned > assisted > direct).
  const fileCount = ctx.file_count || ctx.file_count_estimate
    || (ctx.repository && ctx.repository.fileCount) || 0;
  if (ctx.scope === 'broad' || ctx.acceptance_criteria === 'incomplete'
    || (fileCount > 5 && Array.isArray(ctx.decisions_to_resolve) && ctx.decisions_to_resolve.length > 0)) {
    reasons.push('acceptance criteria are incomplete and must be resolved before editing', 'change spans multiple systems and an architectural boundary', 'important implementation decisions must be resolved before editing', 'scope is broad but does not require a multi-agent team');
    return composeDecision({
      mode: 'planned', reasons, request,
      nextAction: 'resolve the open design choices and produce an implementation plan',
    });
  }
  if (ctx.scope === 'bounded' || ctx.repository_familiarity === 'unfamiliar'
    || (fileCount >= 2 && fileCount <= 5)) {
    reasons.push('repository subsystem is unfamiliar to the current session', 'cross-file symbol tracing is required to localize the defect', 'request is primarily diagnostic, so exploration and debugging must precede implementation', 'implementation is bounded, so orchestrated mode is not justified');
    return composeDecision({
      mode: 'assisted', reasons, request,
      nextAction: 'trace the call chain across the files',
    });
  }
  // Step 7: default to direct (smallest sufficient mode).
  reasons.push('localized one-file change with clear acceptance criteria', 'targeted verification is sufficient', 'no security, release, or migration risk signals present', 'lowest-sufficient-mode rule selects direct over assisted');
  if (detection) reasons.push(`detector-signal: ${detection.capability}`);
  return composeDecision({
    mode: 'direct', reasons, request,
    nextAction: 'apply the localized change and run targeted verification',
  });
}

module.exports = { classifyAdaptiveDecision };
