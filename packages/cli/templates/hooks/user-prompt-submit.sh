#!/usr/bin/env bash
# LazyTrae v0.7 — UserPromptSubmit hook
# Detects ulw/ultrawork keywords, ulw-loop steering, and context-pressure markers.
# Mirrors LazyCodex: ultrawork trigger detection, ulw-loop steering, rules re-injection.
# Always exits 0 — never blocks a session.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SESSIONS="$REPO_ROOT/.lazytrae/state/sessions.json"

# Read stdin for hook event JSON
input=""
if [ ! -t 0 ]; then
  input=$(cat)
fi

# Extract prompt from hook event JSON
prompt=""
if [ -n "$input" ]; then
  prompt=$(echo "$input" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{const j=JSON.parse(d);process.stdout.write(j.prompt||j.user_prompt||'')}catch(e){}
});" 2>/dev/null || true)
fi

# Merge with possible command-line argument
if [ -z "$prompt" ] && [ $# -gt 0 ]; then
  prompt="$*"
fi

# ULTRAWORK trigger detection (mirrors lazycodex/plugins/omo/components/ultrawork/src/codex-hook.ts)
if echo "$prompt" | grep -qiE '\b(ultrawork|ulw)\b' 2>/dev/null; then
  echo "[LazyTrae] Ultrawork trigger detected. Loading ultrawork directive..."
  echo "[LazyTrae] Hint: use ulw-plan or ulw-loop skills for structured workflow."
fi

# Keyword detection for LazyTrae commands
keywords="ulw-loop|start-work|ulw-plan|handoff|stop-continuation|ralph-loop|init-deep|review-work|remove-ai-slops"
if echo "$prompt" | grep -qiE "\\b($keywords)\\b" 2>/dev/null; then
  echo "[LazyTrae] LazyTrae workflow keyword detected. Ensure relevant skill is loaded."
fi

# Ulw-loop steering detection (mirrors lazycodex/plugins/omo/components/ulw-loop/src/steering.ts)
if echo "$prompt" | grep -qiE '(OMO_ULW_LOOP_STEER|omo\.ulw-loop\.steer|omo ulw-loop steer)' 2>/dev/null; then
  echo "[LazyTrae] Ulw-loop steering directive detected. Will be processed by loop engine."
fi

# Context-pressure detection (mirrors lazycodex/plugins/omo/components/rules/src/context-pressure.ts)
CONTEXT_MARKERS="context compacted|context_length_exceeded|skill descriptions were shortened|context_too_large|codex ran out of room|your input exceeds the context window|long threads and multiple compactions"
if echo "$prompt" | grep -qiE "($CONTEXT_MARKERS)" 2>/dev/null; then
  echo "[LazyTrae] Context pressure detected. Setting post-compact recovery flag."
  if [ -f "$SESSIONS" ]; then
    node -e "
try{
  const d=require('$SESSIONS');
  if(!d.compaction_state)d.compaction_state={last_compaction_at:null,compaction_count:0,post_compact_recovery_needed:false};
  d.compaction_state.post_compact_recovery_needed=true;
  d.compaction_state.last_compaction_at=new Date().toISOString();
  d.compaction_state.compaction_count=(d.compaction_state.compaction_count||0)+1;
  require('fs').writeFileSync('$SESSIONS',JSON.stringify(d,null,2)+'\n');
}catch(e){}" 2>/dev/null || true
  fi
fi

exit 0