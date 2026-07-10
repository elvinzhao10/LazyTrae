const fs = require('fs');
const path = require('path');

const STALE_RECOVERY_MS = 24 * 60 * 60 * 1000;

function checkStaleRecovery(repoRoot, now = new Date()) {
  const sessionsPath = path.join(repoRoot, '.lazytrae', 'state', 'sessions.json');
  if (!fs.existsSync(sessionsPath)) {
    return { label: 'Post-compact recovery state', status: 'PASS', detail: 'No sessions state found' };
  }

  let sessions;
  try {
    sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
  } catch (error) {
    return { label: 'Post-compact recovery state', status: 'FAIL', detail: error.message };
  }

  const state = sessions.compaction_state || {};
  if (state.post_compact_recovery_needed !== true) {
    return { label: 'Post-compact recovery state', status: 'PASS', detail: 'No recovery pending' };
  }

  const timestamp = state.recovery_detected_at || state.last_compaction_at;
  const detectedAt = timestamp ? Date.parse(timestamp) : NaN;
  if (Number.isNaN(detectedAt)) {
    return { label: 'Post-compact recovery state', status: 'WARN', detail: 'Recovery pending without a valid timestamp' };
  }

  const ageMs = now.getTime() - detectedAt;
  if (ageMs > STALE_RECOVERY_MS) {
    return {
      label: 'Post-compact recovery state',
      status: 'WARN',
      detail: `Recovery pending since ${timestamp}; run lazytrae hook recover-context`,
    };
  }

  return { label: 'Post-compact recovery state', status: 'PASS', detail: 'Recovery pending but not stale' };
}

module.exports = { checkStaleRecovery, STALE_RECOVERY_MS };
