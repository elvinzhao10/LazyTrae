'use strict';

// plan-checkbox-parser.js
//
// Plan checkbox parser for LazyTrae. This mirrors the Buddy `sync-plan-state.sh`
// plan-format compatibility fixes (run 20260914-1132-lazyseries-v123-platform-patches,
// task T4): heading compatibility ("## TODOs" canonical + legacy "## Todos") and a
// zero-task guard that fails loudly instead of silently succeeding.
//
// Heading match is EXACT (case-sensitive):
//   "TODOs"                 -> canonical task section
//   "Todos"                 -> legacy task section (accepted)
//   "Final Verification Wave" -> verification section (canonical)
//   "Final verification wave" -> legacy verification section (accepted)
// Arbitrary other casing is intentionally NOT accepted.
//
// The parser is pure (no filesystem / IO) so it can be unit-tested in isolation.

const CHECKBOX_RE = /^-\s+\[([ xX])\]\s+(.+)$/;
// Canonical colon IDs and legacy dot IDs share the same task identity.
const TASK_ID_RE = /^([A-Za-z]*\d+)\s*[:.]\s*(.+)$/;

const HEADINGS = new Set(['TODOs', 'Todos', 'Final Verification Wave', 'Final verification wave']);
const TASK_SECTIONS = new Set(['TODOs', 'Todos']);
const VERIFICATION_SECTIONS = new Set(['Final Verification Wave', 'Final verification wave']);

function parsePlanCheckboxes(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  let inSection = false;
  let currentSection = null;
  const boxes = [];
  for (const raw of lines) {
    const s = raw.trim();
    if (s.startsWith('## ')) {
      currentSection = s.slice(3).trim();
      inSection = HEADINGS.has(currentSection);
      continue;
    }
    if (!inSection) continue;
    const m = CHECKBOX_RE.exec(raw);
    if (!m) continue;
    const checked = m[1].toLowerCase() === 'x';
    const title = m[2].trim();
    const tidMatch = TASK_ID_RE.exec(title);
    const tid = tidMatch ? tidMatch[1] : null;
    const keyMatch = tidMatch;
    const idKey = keyMatch ? keyMatch[1] : null;
    boxes.push({ id: tid, idKey, title, checked, section: currentSection });
  }
  return boxes;
}

// Mirrors Buddy's sync-plan-state guards. Returns an error string or null.
//   - zero-task guard: plan that parsed zero checkboxes -> error
//   - duplicate task id detection: preserves task identity
//   - missing task id in a task section (verification section exempt)
function validatePlanCheckboxes(text) {
  const boxes = parsePlanCheckboxes(text);

  if (boxes.length === 0) {
    return "no checkboxes parsed — check plan heading format (expected '## TODOs' or '## Todos', with '- [ ] Task' lines)";
  }

  if (!boxes.some(box => TASK_SECTIONS.has(box.section))) {
    return "no task checkboxes parsed — add a task under '## TODOs' or '## Todos'";
  }

  const seen = new Map();
  for (const box of boxes) {
    if (!box.idKey) continue;
    if (!seen.has(box.idKey)) seen.set(box.idKey, []);
    seen.get(box.idKey).push(box.title);
  }
  for (const [dupId, titles] of seen) {
    if (titles.length > 1) {
      return `duplicate task id '${dupId}' in plan (${titles.length} checkboxes share it)`;
    }
  }

  for (const box of boxes) {
    if (TASK_SECTIONS.has(box.section) && !box.idKey) {
      return `checkbox in '${box.section}' is missing a task id (expected a 'T1:'-style prefix): ${box.title}`;
    }
  }

  return null;
}

module.exports = {
  parsePlanCheckboxes,
  validatePlanCheckboxes,
  HEADINGS,
  TASK_SECTIONS,
  VERIFICATION_SECTIONS,
};
