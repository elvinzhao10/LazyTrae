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

function recoveryText(state) {
  return [
    '[LazyTrae] Post-compact recovery needed. Re-injecting project rules and state context.',
    `Reason: ${state.recovery_reason || 'context-pressure marker'}`,
    `Rules hash: ${state.last_injected_rules_hash || 'unavailable'}`,
    'Next: re-read AGENTS.md, .trae/rules/, and .lazytrae/state before continuing.',
  ].join('\n');
}

const { runTransaction } = require(path.join(repoRoot, '.trae/hooks/runtime/state-transaction'));
runTransaction(repoRoot, 'sessions', () => {
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
    data.revision = (data.revision || 0) + 1;
    console.log('[LazyTrae] Context pressure detected. Post-compact recovery flag set.');
  } else if (action === 'recover' || action === 'recover-if-needed') {
    if (state.post_compact_recovery_needed !== true) {
      if (action === 'recover') console.log('[LazyTrae] No post-compact recovery pending.');
      return { members: [{ path: sessionsPath, content: JSON.stringify(data, null, 2) + '\n' }] };
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
    data.revision = (data.revision || 0) + 1;
  } else {
    console.error(`Unknown context recovery action: ${action}`);
    throw new Error('Unknown context recovery action');
  }
  return { members: [{ path: sessionsPath, content: JSON.stringify(data, null, 2) + '\n' }] };
});
NODE
