'use strict';

// Durable decision memory and correction handling for LazyTrae.
//
// Events are stored as an append-only JSONL ledger at
// `.lazytrae/decisions/ledger.jsonl`. Every event is immutable and globally
// uniquely identified by an id (crypto.randomUUID). Append order is the replay
// order; timestamps are metadata only. The ledger never overwrites old records
// in place: supersession and voiding are recorded as new events, and the active
// view is derived by replaying the ledger.
//
// This module is the single authority for ledger reads and writes. Callers
// (notably the librarian) MUST route all appends through `appendEvent` so that
// reference validation, idempotency, and atomic persistence are centralized.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const EVENT_TYPES = {
  DECISION_RECORDED: 'decision-recorded',
  DECISION_SUPERSEDED: 'decision-superseded',
  DECISION_VOIDED: 'decision-voided',
  CORRECTION_OPENED: 'correction-opened',
  CORRECTION_RESOLVED: 'correction-resolved',
};

const SUPPORTED_EVENT_TYPES = new Set(Object.values(EVENT_TYPES));
const DEFAULT_RETRIEVAL_BUDGET_CHARS = 8000;

class LedgerError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

// Thrown while parsing. Carries the byte offset of the offending line so the
// caller can surface exactly where the ledger is corrupt and recover manually.
class LedgerMalformedError extends LedgerError {
  constructor(message, byteOffset, line) {
    super(message, 'LEDGER_MALFORMED');
    this.byteOffset = byteOffset;
    this.line = line;
  }
}

class LedgerReferenceError extends LedgerError {
  constructor(message) {
    super(message, 'LEDGER_REFERENCE');
  }
}

class LedgerConflictError extends LedgerError {
  constructor(message) {
    super(message, 'LEDGER_CONFLICT');
  }
}

class LedgerIdError extends LedgerError {
  constructor(message) {
    super(message, 'LEDGER_ID');
  }
}

function defaultLedgerPath(repoRoot) {
  return path.join(repoRoot, '.lazytrae', 'decisions', 'ledger.jsonl');
}

function newEventId() {
  return crypto.randomUUID();
}

// --- schema validation ---------------------------------------------------

function requireString(event, key) {
  const value = event[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new LedgerError(`${key} must be a non-empty string`, 'LEDGER_INVALID');
  }
}

function requireObject(event, key) {
  const value = event[key];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LedgerError(`${key} must be a JSON object`, 'LEDGER_INVALID');
  }
}

function requireEvidence(event, key) {
  const value = event[key];
  if (typeof value === 'string') {
    if (value.length === 0) throw new LedgerError(`${key} must not be empty`, 'LEDGER_INVALID');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) throw new LedgerError(`${key} must not be empty`, 'LEDGER_INVALID');
    return;
  }
  throw new LedgerError(`${key} must be a non-empty string or array`, 'LEDGER_INVALID');
}

function assertValidEvent(event) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new LedgerError('event must be a JSON object', 'LEDGER_INVALID');
  }
  requireString(event, 'id');
  if (typeof event.type !== 'string' || !SUPPORTED_EVENT_TYPES.has(event.type)) {
    throw new LedgerError(
      `event.type must be one of: ${[...SUPPORTED_EVENT_TYPES].join(', ')}`,
      'LEDGER_INVALID',
    );
  }
  switch (event.type) {
    case EVENT_TYPES.DECISION_RECORDED:
      requireString(event, 'summary');
      requireString(event, 'rationale');
      requireString(event, 'project');
      requireString(event, 'scope');
      requireObject(event, 'source');
      requireEvidence(event, 'evidence');
      break;
    case EVENT_TYPES.DECISION_SUPERSEDED:
      requireString(event, 'old');
      requireString(event, 'new');
      requireString(event, 'reason');
      if (event.old === event.new) {
        throw new LedgerError('supersede old and new must reference different decisions', 'LEDGER_INVALID');
      }
      break;
    case EVENT_TYPES.DECISION_VOIDED:
      requireString(event, 'target');
      requireString(event, 'reason');
      break;
    case EVENT_TYPES.CORRECTION_OPENED:
      requireString(event, 'ref');
      requireString(event, 'scope');
      requireString(event, 'defect');
      break;
    case EVENT_TYPES.CORRECTION_RESOLVED:
      requireString(event, 'target');
      requireString(event, 'verified_fix');
      break;
    default:
      throw new LedgerError(`unsupported event type: ${event.type}`, 'LEDGER_INVALID');
  }
}

// --- parsing -------------------------------------------------------------

// Returns { events, raw }. Absent file => empty valid memory.
function readEvents(ledgerPath) {
  let content;
  try {
    content = fs.readFileSync(ledgerPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return { events: [], raw: '' };
    throw error;
  }

  const buffer = Buffer.from(content, 'utf8');
  const lines = [];
  let lineStart = 0;
  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] === 0x0a) {
      lines.push({ start: lineStart, end: i, slice: buffer.subarray(lineStart, i) });
      i += 1;
      lineStart = i;
    } else {
      i += 1;
    }
  }
  if (lineStart < buffer.length) {
    lines.push({ start: lineStart, end: buffer.length, slice: buffer.subarray(lineStart, buffer.length) });
  }

  const events = [];
  for (const ln of lines) {
    let text = ln.slice.toString('utf8');
    if (text.endsWith('\r')) text = text.slice(0, -1);
    if (text.length === 0) {
      // A blank line in the middle of the ledger is not a valid record.
      throw new LedgerMalformedError(
        `blank line is not a valid ledger record at byte ${ln.start}`,
        ln.start,
        '',
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new LedgerMalformedError(
        `malformed JSON at byte ${ln.start}: ${error.message}`,
        ln.start,
        text,
      );
    }
    try {
      assertValidEvent(parsed);
    } catch (error) {
      if (error instanceof LedgerError) {
        throw new LedgerMalformedError(
          `invalid ledger record at byte ${ln.start}: ${error.message}`,
          ln.start,
          text,
        );
      }
      throw error;
    }
    events.push(parsed);
  }
  return { events, raw: content };
}

// --- reference validation ------------------------------------------------

function validateReferences(event, events) {
  const recorded = new Map();
  const supersededTargets = new Set();
  const voidedTargets = new Set();
  const openedCorrections = new Map();
  const resolvedCorrections = new Set();

  for (const e of events) {
    if (e.type === EVENT_TYPES.DECISION_RECORDED) recorded.set(e.id, e);
    else if (e.type === EVENT_TYPES.DECISION_SUPERSEDED) supersededTargets.add(e.old);
    else if (e.type === EVENT_TYPES.DECISION_VOIDED) voidedTargets.add(e.target);
    else if (e.type === EVENT_TYPES.CORRECTION_OPENED) openedCorrections.set(e.id, e);
    else if (e.type === EVENT_TYPES.CORRECTION_RESOLVED) resolvedCorrections.add(e.target);
  }

  const requireLiveDecision = (id, label) => {
    if (!recorded.has(id)) {
      throw new LedgerReferenceError(`${label} ${id} references a decision that was never recorded`);
    }
    if (supersededTargets.has(id)) {
      throw new LedgerReferenceError(`${label} ${id} references an already-superseded decision (cycle)`);
    }
    if (voidedTargets.has(id)) {
      throw new LedgerReferenceError(`${label} ${id} references an already-voided decision (cycle)`);
    }
  };

  if (event.type === EVENT_TYPES.DECISION_SUPERSEDED) {
    requireLiveDecision(event.old, 'supersede.old');
    requireLiveDecision(event.new, 'supersede.new');
  } else if (event.type === EVENT_TYPES.DECISION_VOIDED) {
    requireLiveDecision(event.target, 'void.target');
  } else if (event.type === EVENT_TYPES.CORRECTION_RESOLVED) {
    if (!openedCorrections.has(event.target)) {
      throw new LedgerReferenceError(`resolve.target ${event.target} references a correction that was never opened`);
    }
    if (resolvedCorrections.has(event.target)) {
      throw new LedgerReferenceError(`resolve.target ${event.target} references an already-resolved correction (cycle)`);
    }
  }
  // correction-opened.ref may point at a decision id (validated above if present)
  // or at a task id owned by a plan; those live outside the ledger and are not
  // re-referenced, so no cycle is possible.
}

function eventsEqualIgnoringTimestamp(a, b) {
  const strip = (obj) => {
    const { timestamp, ...rest } = obj;
    return rest;
  };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

// --- atomic persistence --------------------------------------------------

function atomicAppend(ledgerPath, event) {
  const dir = path.dirname(ledgerPath);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(event) + '\n';
  let existing = '';
  try {
    existing = fs.readFileSync(ledgerPath, 'utf8');
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
  }
  const content = existing + line;
  const tmpPath = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, ledgerPath);
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
    } catch (cleanupError) {
      // best-effort cleanup only
      void cleanupError;
    }
  }
}

// --- public write API ----------------------------------------------------

function appendEvent(ledgerPath, eventInput) {
  const event = { ...eventInput };
  if (event.timestamp === undefined) event.timestamp = new Date().toISOString();
  assertValidEvent(event);

  const { events } = readEvents(ledgerPath);

  const existing = events.find((e) => e.id === event.id);
  if (existing) {
    if (!eventsEqualIgnoringTimestamp(existing, event)) {
      throw new LedgerIdError(
        `event id ${event.id} already exists with different content; refusing to mutate`,
      );
    }
    return { appended: false, id: event.id, reason: 'idempotent' };
  }

  validateReferences(event, events);
  atomicAppend(ledgerPath, event);
  return { appended: true, id: event.id };
}

// --- replay / active view ------------------------------------------------

function buildActiveView(events) {
  const decisions = new Map();
  const corrections = new Map();

  for (const e of events) {
    if (e.type === EVENT_TYPES.DECISION_RECORDED) {
      decisions.set(e.id, { id: e.id, event: e, status: 'active', supersededBy: null, voidedBy: null });
    }
  }
  for (const e of events) {
    if (e.type === EVENT_TYPES.DECISION_SUPERSEDED) {
      const target = decisions.get(e.old);
      if (target) {
        target.status = 'superseded';
        target.supersededBy = e.new;
      }
    } else if (e.type === EVENT_TYPES.DECISION_VOIDED) {
      const target = decisions.get(e.target);
      if (target) {
        target.status = 'voided';
        target.voidedBy = e.id;
      }
    } else if (e.type === EVENT_TYPES.CORRECTION_OPENED) {
      corrections.set(e.id, { id: e.id, event: e, resolvedBy: null, open: true });
    } else if (e.type === EVENT_TYPES.CORRECTION_RESOLVED) {
      const target = corrections.get(e.target);
      if (target) {
        target.resolvedBy = e.id;
        target.open = false;
      }
    }
  }

  const activeDecisions = [...decisions.values()]
    .filter((d) => d.status === 'active')
    .map((d) => ({ id: d.id, status: d.status, ...d.event }));
  const openCorrections = [...corrections.values()]
    .filter((c) => c.open)
    .map((c) => ({ id: c.id, open: c.open, ...c.event }));

  return {
    events,
    decisions: [...decisions.values()],
    activeDecisions,
    corrections: [...corrections.values()],
    openCorrections,
  };
}

function replay(ledgerPath) {
  const { events } = readEvents(ledgerPath);
  return buildActiveView(events);
}

// --- scope + completion gating ------------------------------------------

function scopeIntersects(a, b) {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer === shorter || longer.startsWith(`${shorter}/`);
}

function blockingCorrections(ledgerPath, scope) {
  const { openCorrections } = replay(ledgerPath);
  return openCorrections.filter((c) => scopeIntersects(c.scope, scope));
}

function blocksCompletion(ledgerPath, scope) {
  return blockingCorrections(ledgerPath, scope).length > 0;
}

// --- bounded retrieval ---------------------------------------------------

function retrieve(ledgerPath, options = {}) {
  const budgetChars = options.budgetChars ?? DEFAULT_RETRIEVAL_BUDGET_CHARS;
  const view = replay(ledgerPath);
  const items = [
    ...view.activeDecisions.map((d) => ({ kind: 'decision', ...d })),
    ...view.openCorrections.map((c) => ({ kind: 'correction', ...c })),
  ];

  let text = '';
  let included = 0;
  let omitted = 0;
  for (const item of items) {
    const piece = JSON.stringify(item) + '\n';
    if (included > 0 && text.length + piece.length > budgetChars) {
      omitted += 1;
      continue;
    }
    text += piece;
    included += 1;
  }

  return {
    text,
    truncated: omitted > 0,
    omitted,
    activeDecisions: view.activeDecisions.length,
    openCorrections: view.openCorrections.length,
  };
}

module.exports = {
  EVENT_TYPES,
  SUPPORTED_EVENT_TYPES,
  DEFAULT_RETRIEVAL_BUDGET_CHARS,
  LedgerError,
  LedgerMalformedError,
  LedgerReferenceError,
  LedgerConflictError,
  LedgerIdError,
  defaultLedgerPath,
  newEventId,
  assertValidEvent,
  readEvents,
  appendEvent,
  replay,
  buildActiveView,
  scopeIntersects,
  blockingCorrections,
  blocksCompletion,
  retrieve,
};
