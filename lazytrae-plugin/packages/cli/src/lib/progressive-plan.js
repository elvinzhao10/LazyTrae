'use strict';

// Progressive milestone + decision-gate model for LazySeries v1.3.0 (plan
// behavior c_progressive_milestones_and_child_plan and d_decision_gate_format).
//
// This is a dependency-free, pure parser/validator so the exact same source
// can be mirrored into the MCP runtime (packages/mcp/src/runtime) and both
// consumers stay byte-identical in behavior. See active-plan consistency test.
//
// Plan record shape (parsed from a Prometheus plan markdown body):
//   ## Milestones
//   - M1: discovery and scaffold
//     - depends: (none)
//     - provisional: false
//     - parent_plan_id: (none)
//   - M2: billing integration
//     - depends: M1
//     - provisional: true
//     - parent_plan_id: plan-root
//     - T1: integrate provider-x
//
//   ## Decision Gates
//   ### G1
//   question: Which billing provider should the billing milestone integrate?
//   recommendation: Provider X (existing contract, lowest integration cost).
//   alternatives: provider-x (Existing contract provider; tradeoffs: lower cost, fewer features) | provider-y (New provider; tradeoffs: more features, new procurement)
//   owner: product-owner
//   affected_tasks: billing-integration
//   needed_by: M2
//   status: open
//   assumptions: Billing is the only consequential product decision surfaced now.

const DECISION_GATE_REQUIRED_FIELDS = [
  'question', 'recommendation', 'alternatives', 'owner', 'needed_by', 'status',
];
const DECISION_GATE_STATUSES = ['open', 'answered', 'blocked', 'superseded'];

const MILESTONE_HEADING = /^\s*milestones\s*$/i;
const DECISION_GATE_HEADING = /^\s*decision\s+gates\s*$/i;

function isBlank(line) {
  return /^\s*$/.test(line);
}

// Split markdown into top-level sections keyed by their heading.
function splitSections(text) {
  const sections = {};
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const heading = raw.match(/^#{1,6}\s+(.*?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections[current] = sections[current] || [];
    } else if (current) {
      sections[current].push(raw);
    }
  }
  return sections;
}

// Parse `## Milestones` bullets into milestone records.
// Each milestone is a top-level list item `- M<n>: <title>` with nested
// `- key: value` annotations and nested task bullets `- T<n>: <title>`.
function parseMilestones(text) {
  const sections = splitSections(text);
  const block = Object.keys(sections).find((key) => MILESTONE_HEADING.test(key));
  if (!block) return [];
  const lines = sections[block];
  const milestones = [];
  let current = null;
  let pending = null; // pending annotation key for multi-line values
  const flush = () => { if (current) milestones.push(current); current = null; pending = null; };
  for (const raw of lines) {
    const top = raw.match(/^\s*-\s+(M\d+|milestone[-\s]?\d+)\s*:\s*(.*)$/i);
    if (top) {
      flush();
      const id = top[1].toUpperCase().replace(/MILESTONE[-\s]?/, 'M');
      current = {
        id,
        title: top[2].trim(),
        flags: { provisional: false, parent_plan_id: null, dependency_links: [] },
        tasks: [],
        depends: [],
      };
      pending = null;
      continue;
    }
    const task = raw.match(/^\s+-\s+(T\d+|task[-\s]?\d+)\s*:\s*(.*)$/i);
    if (task && current) {
      const tid = task[1].toUpperCase().replace(/TASK[-\s]?/, 'T');
      current.tasks.push({ id: tid, title: task[2].trim() });
      pending = null;
      continue;
    }
    const annotation = raw.match(/^\s+-\s+([a-z_]+)\s*:\s*(.*)$/i);
    if (annotation && current) {
      const key = annotation[1].toLowerCase();
      const value = annotation[2].trim();
      if (key === 'provisional') {
        current.flags.provisional = /^(true|yes|1|provisional)$/i.test(value);
      } else if (key === 'parent_plan_id') {
        current.flags.parent_plan_id = /^(none|null|-)?$/i.test(value) ? null : value;
      } else if (key === 'depends' || key === 'dependency_links' || key === 'dependencies') {
        current.flags.dependency_links = value === '(none)' || value === ''
          ? []
          : value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
        current.depends = current.flags.dependency_links;
      }
      pending = null;
      continue;
    }
    // continuation of a previous annotation value (indented, no dash)
    if (pending && /^\s+\S/.test(raw) && current) {
      // rare; ignore stray continuations to keep parsing deterministic
    }
  }
  flush();
  return milestones;
}

// Parse `## Decision Gates` blocks into canonical gate records. Each gate is a
// `### G<n>` (or `### Gate <n>`) sub-heading whose body carries the canonical
// key/value fields. Because splitSections strips the leading '#', the section
// key is the bare id (e.g. "G1").
const GATE_ID_KEY = /^(g\d+|gate[-\s]?\d+)$/i;

function parseDecisionGates(text) {
  const sections = splitSections(text);
  const gates = [];
  for (const [rawKey, lines] of Object.entries(sections)) {
    if (!GATE_ID_KEY.test(rawKey.trim())) continue;
    const id = rawKey.trim().toUpperCase().replace(/GATE[-\s]?/, 'G');
    const current = { id };
    for (const raw of lines) {
      const kv = raw.match(/^\s*(question|recommendation|alternatives|owner|affected_tasks|needed_by|status|assumptions)\s*:\s*(.*)$/i);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      const value = kv[2].trim();
      if (key === 'alternatives') {
        current.alternatives = parseAlternatives(value);
      } else if (key === 'affected_tasks') {
        current.affected_tasks = value === '' ? [] : value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      } else if (key === 'assumptions') {
        current.assumptions = value === '' ? [] : value.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
      } else if (key === 'status') {
        current.status = value.toLowerCase();
      } else {
        current[key] = value;
      }
    }
    gates.push(normalizeGate(current));
  }
  return gates;
}

function parseAlternatives(value) {
  if (value === '' || /^none$/i.test(value)) return [];
  // format: id (summary; tradeoffs: ...) | id2 (...)
  return value.split(/\s*\|\s*/).map((chunk) => {
    const m = chunk.match(/^([\w-]+)\s*\(([^;]*)(?:;\s*tradeoffs:\s*(.*))?\)$/);
    if (m) return { id: m[1], summary: m[2].trim(), tradeoffs: m[3] ? m[3].trim() : '' };
    const simple = chunk.match(/^([\w-]+)\s*(.*)$/);
    return simple ? { id: simple[1], summary: simple[2].trim(), tradeoffs: '' } : { id: chunk.trim(), summary: '', tradeoffs: '' };
  }).filter((a) => a.id);
}

function normalizeGate(record) {
  return {
    id: record.id || null,
    question: record.question || '',
    recommendation: record.recommendation || '',
    alternatives: Array.isArray(record.alternatives) ? record.alternatives : [],
    owner: record.owner || '',
    affected_tasks: Array.isArray(record.affected_tasks) ? record.affected_tasks : [],
    needed_by: record.needed_by || '',
    status: record.status || 'open',
    assumptions: Array.isArray(record.assumptions) ? record.assumptions : [],
  };
}

// Validate a single decision gate against the canonical shape. No auto-approval:
// a gate with status other than 'answered' is treated as not granted.
function validateDecisionGate(gate) {
  const g = normalizeGate(gate || {});
  const errors = [];
  for (const field of DECISION_GATE_REQUIRED_FIELDS) {
    if (field === 'alternatives') continue;
    if (!g[field] || (typeof g[field] === 'string' && g[field].trim() === '')) {
      errors.push(`decision_gate.${field} is required`);
    }
  }
  if (!Array.isArray(g.alternatives) || g.alternatives.length === 0) {
    errors.push('decision_gate.alternatives must contain at least one option');
  } else {
    // at least one option that is NOT the recommended choice
    const recNorm = (g.recommendation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isRecommended = (alt) => {
      const idNorm = (alt.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (idNorm && recNorm.includes(idNorm)) return true;
      return (alt.summary || '').trim().toLowerCase() === (g.recommendation || '').trim().toLowerCase();
    };
    const hasNonRecommended = g.alternatives.some((alt) => !isRecommended(alt));
    if (!hasNonRecommended) errors.push('decision_gate.alternatives must include at least one non-recommended option');
  }
  if (!DECISION_GATE_STATUSES.includes(g.status)) {
    errors.push(`decision_gate.status must be one of: ${DECISION_GATE_STATUSES.join(', ')}`);
  }
  return { valid: errors.length === 0, errors, gate: g };
}

// Detect a cycle in the dependency graph (milestone <-> milestone and
// milestone -> task links). Returns the cycle path or null.
function findCycle(nodeIds, links) {
  const adjacency = new Map();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const [from, to] of links) {
    if (adjacency.has(from)) adjacency.get(from).push(to);
  }
  const WHITE = 0; const GRAY = 1; const BLACK = 2;
  const color = new Map(nodeIds.map((id) => [id, WHITE]));
  const stack = [];
  let cycle = null;
  function visit(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adjacency.get(node) || []) {
      if (!adjacency.has(next)) continue; // dangling handled separately
      if (color.get(next) === GRAY) {
        const idx = stack.indexOf(next);
        cycle = stack.slice(idx).concat(next);
        return true;
      }
      if (color.get(next) === WHITE && visit(next)) return true;
    }
    stack.pop();
    color.set(node, BLACK);
    return false;
  }
  for (const id of nodeIds) {
    if (color.get(id) === WHITE && visit(id)) break;
  }
  return cycle;
}

// Validate a set of milestones (and optional gates) for a parent plan record.
//   knownParentPlanIds: set of plan ids that a parent_plan_id may legally point to.
// Returns { valid, errors, milestones, gates }.
function validateMilestones(textOrRecords, options = {}) {
  const milestones = Array.isArray(textOrRecords) ? textOrRecords : parseMilestones(textOrRecords);
  const gates = Array.isArray(options.gates) ? options.gates : parseDecisionGates(textOrRecords || '');
  const knownParentPlanIds = new Set(options.knownParentPlanIds || []);
  const errors = [];

  // Stable id set: milestones + their tasks.
  const milestoneIds = new Set(milestones.map((m) => m.id));
  const allIds = new Set(milestoneIds);
  for (const m of milestones) {
    for (const t of m.tasks || []) {
      if (allIds.has(t.id)) errors.push(`duplicate id ${t.id}`);
      allIds.add(t.id);
    }
  }

  // 1) missing IDs + dangling child links + gather links for cycle check.
  const links = [];
  for (const m of milestones) {
    const deps = m.flags?.dependency_links || m.depends || [];
    for (const dep of deps) {
      if (!allIds.has(dep)) {
        errors.push(`milestone ${m.id} depends on missing id ${dep}`);
      } else {
        links.push([m.id, dep]);
      }
    }
    const parent = m.flags?.parent_plan_id || null;
    if (parent && parent !== m.id) {
      if (knownParentPlanIds.size > 0 && !knownParentPlanIds.has(parent)) {
        errors.push(`milestone ${m.id} has dangling child link to unknown parent_plan_id ${parent}`);
      }
    }
  }

  // 2) cycle rejection.
  const cycle = findCycle([...allIds], links);
  if (cycle) {
    errors.push(`dependency cycle detected: ${cycle.join(' -> ')}`);
  }

  // 3) gate canonical shape + needed_by must reference a known milestone.
  for (const gate of gates) {
    const result = validateDecisionGate(gate);
    if (!result.valid) errors.push(...result.errors.map((e) => `gate ${gate.id || '?'}: ${e}`));
    if (gate.needed_by && !milestoneIds.has(gate.needed_by)) {
      errors.push(`gate ${gate.id} needed_by references unknown milestone ${gate.needed_by}`);
    }
  }

  return { valid: errors.length === 0, errors, milestones, gates };
}

// Which tasks/milestones are blocked by an OPEN or BLOCKED gate?
// Only transitive dependents of affected_tasks block; independent work proceeds.
function blockedNodes(gates) {
  const blocked = new Set();
  for (const gate of gates) {
    if (gate.status === 'answered' || gate.status === 'superseded') continue;
    for (const task of gate.affected_tasks || []) blocked.add(task);
  }
  return blocked;
}

// Compute which milestones are dispatchable.
// Rule (behavior c): the NEXT (first non-provisional) milestone is executable;
// every later milestone is forced provisional and MUST NOT dispatch. A milestone
// whose needed gate is still open/blocked is also not executable.
function computeExecutableMilestones(textOrRecords, options = {}) {
  const parsed = Array.isArray(textOrRecords)
    ? { milestones: textOrRecords, gates: options.gates || [] }
    : validateMilestones(textOrRecords, options);
  const milestones = parsed.milestones;
  const gates = parsed.gates;
  const blocked = blockedNodes(gates);

  let executableIndex = -1;
  for (let i = 0; i < milestones.length; i += 1) {
    const m = milestones[i];
    if (m.flags?.provisional) continue;
    const gateBlocks = gates.some((g) => (g.status === 'open' || g.status === 'blocked')
      && g.needed_by === m.id);
    const depBlocks = (m.flags?.dependency_links || []).some((dep) => blocked.has(dep));
    if (!gateBlocks && !depBlocks) { executableIndex = i; break; }
  }

  return milestones.map((m, i) => {
    const forcedProvisional = executableIndex !== -1 && i > executableIndex;
    const provisional = forcedProvisional || Boolean(m.flags?.provisional);
    const executable = i === executableIndex && !provisional;
    // provisional milestones and milestones after the executable one MUST NOT dispatch
    const mayDispatch = executable && !provisional;
    return {
      id: m.id,
      title: m.title,
      provisional,
      executable,
      may_dispatch: mayDispatch,
      parent_plan_id: m.flags?.parent_plan_id || null,
      dependency_links: m.flags?.dependency_links || [],
    };
  });
}

module.exports = {
  DECISION_GATE_REQUIRED_FIELDS,
  DECISION_GATE_STATUSES,
  computeExecutableMilestones,
  blockedNodes,
  findCycle,
  normalizeGate,
  parseDecisionGates,
  parseMilestones,
  validateDecisionGate,
  validateMilestones,
};
