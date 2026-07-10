#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SESSIONS="$REPO_ROOT/.lazytrae/state/sessions.json"
ACTION="${1:-status}"
REASON="${2:-context-pressure marker}"
node - "$ACTION" "$SESSIONS" "$REPO_ROOT" "$REASON" <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const [action, sessionsPath, repoRoot, reason] = process.argv.slice(2);
function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return { schema_version: 1, current_session_id: null, sessions: {}, compaction_state: {} };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function rulesHash(root) {
  const hash = crypto.createHash('sha256');
  for (const rel of ['AGENTS.md', '.trae/rules/lazytrae.md']) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) hash.update(rel).update('\0').update(fs.readFileSync(abs));
  }
  return hash.digest('hex');
}
function normalize(data) {
  if (!data.compaction_state) data.compaction_state = {};
  const state = data.compaction_state;
  if (typeof state.compaction_count !== 'number') state.compaction_count = 0;
  if (!Array.isArray(state.recovery_events)) state.recovery_events = [];
  return state;
}
function appendEvent(state, event) {
  state.recovery_events.push(event);
  if (state.recovery_events.length > 20) state.recovery_events = state.recovery_events.slice(-20);
}
function writeJson(filePath, data) {
  const root = fs.realpathSync.native(repoRoot);
  const target = path.resolve(filePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('write path must stay inside the repo root');
  }
  let ancestor = target;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const ancestorRelative = path.relative(root, fs.realpathSync.native(ancestor));
  if (ancestorRelative.startsWith('..') || path.isAbsolute(ancestorRelative)) {
    throw new Error('write path resolves outside the repo root');
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function recoveryText(state) {
  return [
    '[LazyTrae] Post-compact recovery needed. Re-injecting project rules and state context.',
    `Reason: ${state.recovery_reason || 'context-pressure marker'}`,
    `Rules hash: ${state.last_injected_rules_hash || 'unavailable'}`,
    'Next: re-read AGENTS.md, .trae/rules/, and .lazytrae/state before continuing.',
  ].join('\n');
}

const data = readJson(sessionsPath);
const state = normalize(data);
const now = new Date().toISOString();

if (action === 'mark') {
  const hash = rulesHash(repoRoot);
  state.post_compact_recovery_needed = true;
  state.last_compaction_at = now;
  state.recovery_detected_at = now;
  state.recovery_reason = reason;
  state.last_injected_rules_hash = hash;
  state.compaction_count += 1;
  appendEvent(state, { at: now, action: 'marked', reason, last_injected_rules_hash: hash });
  writeJson(sessionsPath, data);
  console.log('[LazyTrae] Context pressure detected. Post-compact recovery flag set.');
} else if (action === 'recover' || action === 'recover-if-needed') {
  if (state.post_compact_recovery_needed !== true) {
    if (action === 'recover') console.log('[LazyTrae] No post-compact recovery pending.');
    process.exit(0);
  }
  console.log(recoveryText(state));
  state.post_compact_recovery_needed = false;
  state.post_compact_recovered_at = now;
  appendEvent(state, {
    at: now,
    action: 'recovered',
    reason: state.recovery_reason || reason,
    last_injected_rules_hash: state.last_injected_rules_hash || rulesHash(repoRoot),
  });
  writeJson(sessionsPath, data);
} else {
  console.error(`Unknown context recovery action: ${action}`);
  process.exit(1);
}
NODE
