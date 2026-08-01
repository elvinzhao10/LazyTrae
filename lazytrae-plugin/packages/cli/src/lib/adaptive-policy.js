'use strict';

const { boundedStrings } = require('./adaptive-identity');

const EXPLICIT_WORKFLOWS = Object.freeze([
  ['lazy-init-deep', 'assisted'], ['lazy-start-work', 'assisted'], ['lazy-ulw-plan', 'planned'],
  ['lazy-review-work', 'orchestrated'], ['lazy-ulw-loop', 'long-horizon'], ['lazy-ultrawork', 'orchestrated'], ['lazy-verifier', 'direct'],
]);

function explicitWorkflow(text, context) {
  const lowered = text.toLowerCase().replace(/[’‘]/g, "'");
  for (const [workflow, mode] of EXPLICIT_WORKFLOWS) {
    if (context.named_workflow === workflow) return { mode, workflow };
  }
  if (context.named_workflow_class === 'plan-only') {
    return { mode: 'planned', workflow: 'lazy-ulw-plan' };
  }
  const matches = [];
  for (const [workflow, mode] of EXPLICIT_WORKFLOWS) {
    let offset = 0;
    while (offset < lowered.length) {
      const index = lowered.indexOf(workflow, offset);
      if (index < 0) break;
      offset = index + workflow.length;
      const before = lowered[index - 1] || '';
      const after = lowered[offset] || '';
      if (/[a-z0-9-]/.test(before) || /[a-z0-9-]/.test(after)) continue;
      const clauseStart = Math.max(
        lowered.lastIndexOf(';', index - 1),
        lowered.lastIndexOf('.', index - 1),
        lowered.lastIndexOf('!', index - 1),
        lowered.lastIndexOf('?', index - 1),
        lowered.lastIndexOf('\n', index - 1),
      );
      let prefix = lowered.slice(clauseStart + 1, index).trim();
      const commaParts = prefix.split(',');
      const commaTail = commaParts.pop().trim();
      const priorWorkflow = EXPLICIT_WORKFLOWS.some(([candidate]) => commaParts.join(',').includes(candidate));
      if (priorWorkflow && /^(?:(?:then|and|instead|rather)\s+)?(?:use|run|invoke|start|select|choose)(?:\s+the)?\s*$/.test(commaTail)) {
        prefix = commaTail;
      }
      const suffix = lowered.slice(offset);
      const rhetoricalAffirmative = /(?:^|\s)(?:do\s+not|don't|never)\s+(?:forget|hesitate|fail|neglect|overlook|skip)\b[\s\S]*\b(?:to\s+)?(?:use|run|invoke|start|select|choose)\b/.test(prefix);
      const negative = !rhetoricalAffirmative
        && /(?:^|\s)(?:do\s+not|don't|never|avoid|without)\b/.test(prefix)
        && (/(?:^|\s)(?:use|run|invoke|start|select|choose)\b/.test(prefix)
          || /(?:^|\s)(?:avoid|without)\b/.test(prefix));
      const incidental = /(?:discuss|mention|describe|explain|compare)(?:\s+the)?(?:\s*\/)?$/.test(prefix)
        || /^\s+as\s+an?\s+example\b/.test(suffix);
      const affirmative = prefix.length === 0
        || /(?:^|\s)(?:use|run|invoke|start|select|choose)(?:\s+the)?(?:\s*\/)?$/.test(prefix);
      if (affirmative && !negative && !incidental) matches.push({ index, mode, workflow });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return matches[0] || null;
}

function reasonSet(mode, stale, context, text) {
  if (stale || context.material_change || context.prior_completion_recorded) {
    return ['The revision fingerprint changed materially.', 'Prior completion evidence is stale.'];
  }
  if (context.signals?.verification_failure) return ['Verification failure added debugging.', 'Broader scope justified one mode increase.'];
  if (context.signals?.capability_unavailable) {
    return ['The preferred capability class is unavailable.', 'A safe substitution preserves assisted mode.'];
  }
  const risks = `${text} ${boundedStrings(context.risk_signals).join(' ')}`;
  if (mode === 'orchestrated' && /\b(security|authorization)\b/i.test(risks)) {
    return ['Authorization behavior is security-sensitive.', 'Material risk requires independent verification.'];
  }
  if (mode === 'orchestrated' && /\b(release|publication)\b/i.test(risks)) {
    return ['Release preparation is materially risky.', 'Independent artifact evidence is required.'];
  }
  return {
    direct: ['The change is localized and its acceptance criteria are clear.', 'Targeted verification is sufficient.'],
    assisted: ['The defect crosses several unfamiliar components.', 'Exploration and debugging are required before implementation.'],
    planned: ['Acceptance criteria remain unresolved.', 'Several design decisions must precede product edits.'],
    orchestrated: ['Material risk or independent workstreams require orchestration.', 'Independent verification is required.'],
    'long-horizon': ['The request explicitly spans multiple sessions.', 'Durable checkpoints are required.'],
  }[mode];
}

function responsibilitySet(mode, text, context, base) {
  const values = [...base];
  const signals = `${text} ${boundedStrings(context.risk_signals).join(' ')}`;
  if (mode === 'orchestrated' && /\b(security|authorization)\b/i.test(signals)) values.push('security-review');
  if (mode === 'orchestrated' && /\b(release|publication)\b/i.test(signals)) values.push('release-review');
  return [...new Set(values)];
}

function ownershipFor(mode, stages, responsibilities) {
  const stageResponsibility = {
    understand: 'exploration', plan: 'planning', implement: 'implementation', debug: 'debugging',
    verify: 'verification', continue: 'continuity',
  };
  const entries = [];
  for (const stage of stages) {
    const owners = stage === 'review'
      ? responsibilities.filter((item) => item.endsWith('-review'))
      : [stageResponsibility[stage]].filter(Boolean);
    for (const responsibility of owners) {
      const ownerClass = stage === 'review' || (mode === 'orchestrated' && stage === 'verify')
        ? 'independent-reviewer'
        : stage === 'continue' ? 'continuity-owner'
          : ['understand', 'plan'].includes(stage) && !['direct', 'assisted'].includes(mode)
            ? 'adaptive-orchestrator' : 'implementation-owner';
      entries.push({ ownerClass, responsibility, stage });
    }
  }
  return entries;
}

function authorityBoundary(mode, explicitPlanOnly, context, approvalRequiredClasses) {
  const automatic = explicitPlanOnly
    ? ['existing-capability-use', 'read-only-local-inspection']
    : ['existing-capability-use', ...(mode === 'long-horizon' || context.continuation_requested
      ? ['package-owned-local-state'] : []),
      'read-only-local-inspection', 'repository-edit', 'targeted-local-execution'];
  const risks = boundedStrings(context.risk_signals).join(' ');
  const gated = /\b(release|publication)\b/i.test(risks)
    ? [...new Set([...approvalRequiredClasses, 'account-marketplace-or-publish-mutation'])].sort()
    : approvalRequiredClasses;
  return { automatic, approval_required: gated };
}

module.exports = { authorityBoundary, explicitWorkflow, ownershipFor, reasonSet, responsibilitySet };
