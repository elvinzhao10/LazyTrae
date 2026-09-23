'use strict';

// Dual-entry convergence for LazySeries v1.3.0 (plan behaviors
// a_explicit_and_automatic_coexistence and b_natural_language_activation_scope).
//
// Both activation routes — the explicit `/lazy-start-work` command AND a plain
// natural-language implementation request — converge on the SAME execution
// authority and gates (classifyAdaptiveDecision in ./adaptive-decision). No
// slash command is required for a clear implementation request.
//
// This module adds the v1.3.0 additive concerns layered on top of that shared
// authority:
//   - execution_intent (plan_only | execute), persisted separately from
//     workflow_mode and current stage; default plan_only.
//   - plan-only invariant: explanation requests, quoted commands, and explicit
//     plan-only never mutate product files and never set execute. An ambiguous
//     approval with multiple pending questions cannot grant execution.
//   - missing host hook support falls back to the explicit entry route with an
//     accurate (pending, not PASS) status — never a silent automatic claim.
//   - duplicate host events must not duplicate dispatch.
//   - resume selects a single compatible run or asks only when ambiguous.

const { classifyAdaptiveDecision } = require('./adaptive-decision');

const COMMAND_INTENTS = Object.freeze({
  'lazy-start-work': Object.freeze({ intent: 'execute', route: 'explicit-execution' }),
  'start-work': Object.freeze({ intent: 'execute', route: 'explicit-execution' }),
  'lazy-ulw-plan': Object.freeze({ intent: 'plan_only', route: 'explicit-planning' }),
  'ulw-plan': Object.freeze({ intent: 'plan_only', route: 'explicit-planning' }),
});
const EXPLICIT_COMMAND = new RegExp(`^\\s*\\/(${Object.keys(COMMAND_INTENTS).join('|')})(?=\\s|$)`, 'i');
const EXPLANATION_REQUEST = /\b(explain|describe|how does|how do|what is|what are|show(?: me)? the (?:command|steps|way)|walk me through)\b|(?:解释|说明)(?:一下)?(?:这个)?计划|solo explica|計画だけ説明/i;
const QUOTED_COMMAND = /```[\s\S]*?```|`[^`]+`|"[^"\n]+"|'[^'\n]+'/;
const QUOTED_COMMAND_GLOBAL = /```[\s\S]*?```|`[^`]+`|"[^"\n]+"|'[^'\n]+'/g;
const PLAN_ONLY_REQUEST = /\b(plan[- ]?only|do not implement|don't implement|create a plan only|just (?:plan|the plan)|no (?:implementation|coding|code))\b|^\s*(?:(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:create|write|draft|make)(?:\s+me)?\s+(?:(?:an?|the)\s+)?(?:implementation\s+)?plan\b|(?:please\s+)?plan\s+(?:this|the|a)\b|(?:please\s+)?update\s+me\s+(?:on|about|with)\b)/i;
const NON_EXECUTION_REQUEST = /(?:^|[,;.!]\s*)(?:(?:but|then)\s+)?(?:please\s+)?(?:(?:pause|stop|hold)(?:\s+(?:here|now|execution|work))?\s*(?:[.!]?\s*$|(?:and|then|until|before)\b)|wait\s+(?:for|until)\b)|^\s*(?:please\s+)?(?:add|begin|build|change|continue|create|delete|execute|fix|implement|make|modify|refactor|remove|repair|resume|run|start|update)\s+(?:nothing|no\b)|\b(?:do not|don't|dont|never)\s+(?:execute|run|implement|start|build|change|modify|continue|resume)\b|\b(?:no\s+(?:ejecut(?:a|ar|es)|implement(?:a|ar|es))|solo\s+explica)\b|(?:先|暂时|暂)?(?:不要|别|无需|暂不)(?:执行|实施|实现|运行|修改|开始)|只(?:解释|说明)(?:一下)?(?:这个)?计划|実行せず|実行しない|実装しない|計画だけ説明/i;
const EXECUTION_REQUEST = /(?:^|[,;.!]\s*)(?:(?:then|and then)\s+)?(?:please\s+)?(?:add|begin|build|change|continue|create|delete|execute|fix|implement|make|modify|refactor|remove|repair|resume|run|start|update)\b|\b(?:can|could|will|would)\s+you\s+(?:please\s+)?(?:add|build|change|create|delete|execute|fix|implement|make|modify|refactor|remove|repair|run|start|update)\b|\bi\s+(?:need|want)\s+you\s+to\s+(?:add|build|change|create|delete|execute|fix|implement|make|modify|refactor|remove|repair|run|start|update)\b|(?:^|[,;.!]\s*)(?:please\s+)?(?:go ahead and (?:add|build|change|create|delete|execute|fix|implement|make|modify|refactor|remove|repair|run|start|update|do it)|proceed with (?:the\s+)?(?:implementation|work|changes?))\b|^\s*请?(?:修复|实现|执行|运行|修改|更新|删除|添加|开始)/i;

// A vague affirmative that is NOT a clear execution instruction. On its own it
// does not grant execution authority — especially when several questions remain.
const VAGUE_AFFIRMATIVE = /^\s*(yes|yeah|yep|ok|okay|sure|sounds good|approved?|lgmts?|go)\b[.!]?\s*$/i;

function commandFor(request) {
  const match = EXPLICIT_COMMAND.exec(String(request || ''));
  return match ? { name: match[1].toLowerCase(), ...COMMAND_INTENTS[match[1].toLowerCase()] } : null;
}

function isExplicitCommand(request) {
  return commandFor(request) !== null;
}

function isExplanationRequest(request) {
  const text = String(request || '');
  if (EXPLANATION_REQUEST.test(text)) return true;
  const unquoted = text.replace(QUOTED_COMMAND_GLOBAL, ' ');
  return QUOTED_COMMAND.test(text) && !EXECUTION_REQUEST.test(unquoted);
}

function isPlanOnlyRequest(request) {
  const text = String(request || '');
  return PLAN_ONLY_REQUEST.test(text) || NON_EXECUTION_REQUEST.test(text);
}

function isExecutionRequest(request) {
  const text = String(request || '');
  if (isPlanOnlyRequest(text)) return false;
  const command = commandFor(text);
  if (command) return command.intent === 'execute';
  return EXECUTION_REQUEST.test(text.replace(QUOTED_COMMAND_GLOBAL, ' '));
}

// A neutral question (Wh- lead or trailing '?') with no execution verb is not
// an implementation directive; it defaults to plan_only rather than execute.
function isQuestionRequest(request) {
  const text = String(request || '').trim();
  if (/\?\s*$/.test(text) && !isExecutionRequest(text)) return true;
  return /^(what|why|when|where|who|which|can|could|should|is|are|do|does|did|will|would|has|have|am)\b/i.test(text)
    && !EXECUTION_REQUEST.test(text);
}

function routeFor(request) {
  return commandFor(request)?.route || 'automatic-activation';
}

// Resolve the persisted execution_intent. Invariant: explanation / quoted /
// explicit plan-only can NEVER set execute. A vague affirmative with more than
// one pending question cannot grant execution authority. A clear directive to
// change product code executes; a neutral question defaults to plan_only.
function resolveExecutionIntent(request, context = {}) {
  const text = String(request || '').trim();
  if (text.length === 0 || isPlanOnlyRequest(text)) return 'plan_only';
  const command = commandFor(text);
  if (command) return command.intent;

  const pendingQuestions = Number(context.pendingQuestions != null ? context.pendingQuestions : (context.pendingDecisionGates || 0));
  const isVagueYes = VAGUE_AFFIRMATIVE.test(text);
  if (isVagueYes) {
    if (pendingQuestions > 1) return 'plan_only';
    return context.priorExecutionIntent === 'execute' ? 'execute' : 'plan_only';
  }

  if (isExecutionRequest(text)) return 'execute';
  if (isQuestionRequest(text) || isExplanationRequest(text)) return 'plan_only';

  return 'plan_only';
}

// Plan-only invariant: a plan_only intent must not mutate product files and
// must not dispatch execution. Returns { ok, reason }.
function checkPlanOnlyInvariant(executionIntent, proposedAction) {
  if (executionIntent !== 'plan_only') return { ok: true };
  const mutates = Boolean(proposedAction && (proposedAction.mutatesProductFiles || proposedAction.setsExecute));
  if (mutates) {
    return {
      ok: false,
      reason: 'plan_only intent forbids product-file mutation and execution dispatch',
    };
  }
  return { ok: true };
}

// Missing host hook support: detect and offer the explicit entry route with an
// accurate status. Never a silent automatic-claim (status PASS).
function detectMissingHook(context = {}) {
  if (context.hostHookSupport === false || context.hostHookSupport === 'unsupported') {
    return {
      fallback: 'explicit-entry',
      status: 'pending',
      silent_automatic_claim: false,
      offer: 'Host lacks prompt-submit hook support; use /lazy-start-work to execute.',
    };
  }
  return null;
}

// Duplicate host event suppression. Callers pass a stable event key (e.g. a
// hash of the prompt + run id); repeated keys return true (suppress dispatch).
function makeDuplicateGuard() {
  const seen = new Set();
  return function isDuplicateEvent(eventKey) {
    if (typeof eventKey !== 'string' || eventKey.length === 0) return false;
    if (seen.has(eventKey)) return true;
    seen.add(eventKey);
    return false;
  };
}

// Resume: select the single compatible run, or ask only when ambiguous.
//   runs: [{ run_id, plan_id, authority }]
//   requestContext: { plan_id }
function selectResumeRun(runs, requestContext = {}) {
  const list = Array.isArray(runs) ? runs : [];
  const wantPlan = requestContext.plan_id;
  const compatible = list.filter((r) => !wantPlan || r.plan_id === wantPlan);
  if (compatible.length === 1) return { run: compatible[0], ask: false, fresh: false };
  if (compatible.length > 1) return { run: null, ask: true, fresh: false, candidates: compatible };
  return { run: null, ask: false, fresh: true };
}

// Compose the full route decision. Both entry routes converge on the shared
// adaptive authority (classifyAdaptiveDecision) for mode selection; this layer
// adds route + execution_intent + the v1.3.0 guards.
function classifyAdaptiveRoute(request, context = {}) {
  const route = routeFor(request);
  const execution_intent = resolveExecutionIntent(request, context);
  const missingHook = detectMissingHook(context);
  const decision = classifyAdaptiveDecision(request, context);
  const explicitPlanOnly = isPlanOnlyRequest(request) || isExplanationRequest(request);
  const effectiveIntent = missingHook ? execution_intent : execution_intent;
  return {
    route,
    execution_intent: effectiveIntent,
    mode: decision.mode,
    workflow_mode: decision.mode,
    current_stage: decision.snapshot?.currentStage || decision.stages?.[0] || 'understand',
    // execution_intent is persisted separately from workflow_mode / current_stage
    persisted_fields: {
      execution_intent: effectiveIntent,
      entry_route: route,
      workflow_mode: decision.mode,
      current_stage: decision.snapshot?.currentStage || decision.stages?.[0] || 'understand',
    },
    explicit_plan_only: Boolean(explicitPlanOnly) || isPlanOnlyRequest(request) || isExplanationRequest(request),
    missing_host_hook: missingHook,
    decision,
    guard: {
      plan_only_invariant: checkPlanOnlyInvariant(effectiveIntent, { mutatesProductFiles: false, setsExecute: false }),
    },
  };
}

module.exports = {
  COMMAND_INTENTS,
  EXECUTION_REQUEST,
  EXPLICIT_COMMAND,
  VAGUE_AFFIRMATIVE,
  checkPlanOnlyInvariant,
  classifyAdaptiveRoute,
  commandFor,
  detectMissingHook,
  isExplanationRequest,
  isExecutionRequest,
  isExplicitCommand,
  isPlanOnlyRequest,
  makeDuplicateGuard,
  resolveExecutionIntent,
  routeFor,
  selectResumeRun,
};
