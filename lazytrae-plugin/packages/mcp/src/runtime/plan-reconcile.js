'use strict';

// T4 — Reconcile human plan edits with execution authority (LazyTrae v1.3.0).
//
// Mirrors lazyseries-shared-semantics.v1.json reconciliation_semantics and the
// LazyBuddy module lazybuddy_plan_reconcile.py:
//   - cosmetic changes (whitespace, wording, reorder, check/uncheck assertion)
//     preserve all valid evidence;
//   - semantic changes (acceptance/dependencies/verification commands/
//     decisions, added/removed tasks) invalidate ONLY the affected task and
//     its transitive dependents;
//   - a human check is a completion assertion, never a verified result; an
//     uncheck reopens the task;
//   - stale results (older plan revision) can never update newer plan state.

const TASK_TITLE_RE = /^([A-Za-z]*\d+)\s*[:.]\s*(.+)$/;
const CHECKBOX_RE = /^-\s+\[([ xX])\]\s+(.+)$/;
const SCOPE_KEYS = new Set(['acceptance', 'qa', 'verify', 'commit', 'depends', 'depends_on', 'decision']);

function splitFences(text) {
  // Return non-fenced lines with their indices (same fence grammar as Buddy).
  const lines = text.split('\n');
  let fence = null;
  const out = [];
  lines.forEach((line, index) => {
    const s = line.trim();
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      const token = marker[1];
      if (fence === null) fence = token;
      else if (token[0] === fence[0] && token.length >= fence.length && s === token) fence = null;
      return;
    }
    if (fence !== null) return;
    out.push({ line, s, index });
  });
  return out;
}

function parseTasks(text) {
  const tasks = new Map();
  let section = null;
  let inTaskSection = false;
  let currentId = null;
  for (const { line, s } of splitFences(text)) {
    if (s.startsWith('## ')) {
      section = s.slice(3).trim();
      inTaskSection = ['TODOs', 'Todos', 'Final Verification Wave'].includes(section);
      currentId = null;
      continue;
    }
    if (!inTaskSection) continue;
    const box = line.match(CHECKBOX_RE);
    if (box) {
      const title = box[2].trim();
      const id = title.match(TASK_TITLE_RE);
      currentId = id ? id[1] : null;
      if (currentId) {
        tasks.set(currentId, { checked: box[1].toLowerCase() === 'x', title, scopeLines: [], section });
      }
      continue;
    }
    if (currentId && s.startsWith('- ')) {
      const key = s.slice(2).split(':')[0].trim().toLowerCase();
      if (SCOPE_KEYS.has(key)) tasks.get(currentId).scopeLines.push(s);
    } else if (currentId && s && !s.startsWith('#')) {
      tasks.get(currentId).scopeLines.push(s);
    }
  }
  return tasks;
}

function stripFlags(title) {
  return title.replace(/\((?:provisional|depends_on|parent_plan_id)\s*:.*?\)/g, '').trim();
}

function extractDeps(tasks) {
  const deps = new Map();
  for (const [tid, record] of tasks) {
    const links = [];
    const m = record.title.match(/depends(?:_on)?\s*:\s*([^\),]+)/i) ||
      record.scopeLines.map((l) => l.match(/-?\s*depends(?:_on)?\s*:\s*(.+)/i)).find(Boolean);
    const source = m && m[1] != null ? m[1] : null;
    if (source) {
      for (const tok of source.split(',')) {
        const clean = tok.trim().replace(/[[\]]/g, '');
        if (clean) links.push(clean);
      }
    }
    deps.set(tid, links);
  }
  return deps;
}

function dependentsClosure(taskId, deps) {
  const result = new Set();
  const frontier = [taskId];
  while (frontier.length) {
    const current = frontier.pop();
    for (const [candidate, links] of deps) {
      if (result.has(candidate)) continue;
      if (links.includes(current)) {
        result.add(candidate);
        frontier.push(candidate);
      }
    }
  }
  return result;
}

// Classify the delta between two plan revisions. Same contract as Buddy's
// classify_plan_edits: { classification, invalidations, reopen, added,
// removed, summary }.
function classifyPlanEdits(oldText, newText) {
  const oldTasks = parseTasks(oldText);
  const newTasks = parseTasks(newText);

  const added = [...newTasks.keys()].filter((id) => !oldTasks.has(id)).sort();
  const removed = [...oldTasks.keys()].filter((id) => !newTasks.has(id)).sort();
  const depsNew = extractDeps(newTasks);

  const invalidations = [];
  const reopen = [];
  const summary = [];
  let semantic = false;

  for (const tid of removed) {
    semantic = true;
    invalidations.push({ task: tid, reason: 'task removed; running work stops receiving dispatch and results cannot be accepted as current' });
    summary.push(`removed task ${tid}`);
  }
  for (const tid of added) {
    semantic = true;
    summary.push(`added task ${tid} (requires eligibility checks before dispatch)`);
  }

  for (const tid of [...oldTasks.keys()].filter((k) => newTasks.has(k)).sort()) {
    const oldT = oldTasks.get(tid);
    const newT = newTasks.get(tid);
    if (oldT.checked && !newT.checked) {
      reopen.push(tid);
      summary.push(`human unchecked ${tid}: reopened for reconciliation (a check is an assertion, never a verified result)`);
    }
    if (!oldT.checked && newT.checked) {
      summary.push(`human checked ${tid}: assertion only — never counts as a verified result`);
    }
    if (stripFlags(oldT.title) !== stripFlags(newT.title)) {
      semantic = true;
      invalidations.push({ task: tid, reason: 'task title/deliverable changed' });
      summary.push(`${tid}: task title/deliverable changed`);
      continue;
    }
    const oldScope = [...oldT.scopeLines].sort().join('\n');
    const newScope = [...newT.scopeLines].sort().join('\n');
    if (oldScope !== newScope) {
      semantic = true;
      invalidations.push({ task: tid, reason: 'scope changed (acceptance/qa/verify/commit/depends/decision)' });
      summary.push(`${tid}: scope changed`);
    }
  }

  if (invalidations.length) {
    const direct = new Set(invalidations.map((i) => i.task));
    const closure = new Set();
    for (const tid of direct) {
      for (const dep of dependentsClosure(tid, depsNew)) closure.add(dep);
    }
    for (const tid of [...closure].filter((t) => !direct.has(t)).sort()) {
      invalidations.push({ task: tid, reason: 'transitive dependent of a scope-changed task' });
      summary.push(`${tid}: invalidated as transitive dependent`);
    }
  }

  let classification = 'unchanged';
  if (semantic || invalidations.length) classification = 'semantic';
  else if (oldText.trim() !== newText.trim()) {
    classification = 'cosmetic';
    summary.push('cosmetic edit (whitespace/wording/reorder/check assertion) — evidence preserved');
  }

  return { classification, invalidations, reopen: reopen.sort(), added, removed, summary };
}

// Stale-result guard: a result dispatched under an older plan revision can
// never update a newer plan's state.
function acceptResult(result, currentPlanSha) {
  const resultSha = result && result.plan_sha256;
  if (!resultSha) return { ok: false, reason: 'result carries no plan_sha256; refusing to apply' };
  if (resultSha !== currentPlanSha) {
    return { ok: false, reason: `stale result: dispatched under plan ${String(resultSha).slice(0, 12)} but current approved revision is ${String(currentPlanSha).slice(0, 12)}` };
  }
  return { ok: true, reason: 'ok' };
}

module.exports = { acceptResult, classifyPlanEdits, parseTasks };
