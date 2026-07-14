#!/usr/bin/env bash
# LazyTrae v0.7 — UserPromptSubmit hook
# Detects ulw/ultrawork keywords, ulw-loop steering, and context-pressure markers.
# Detect ultrawork triggers, ulw-loop steering, and rule reinjection needs.
# Always exits 0 — never blocks a session.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RECOVERY="$REPO_ROOT/.trae/hooks/context-recovery.sh"

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

# ULTRAWORK trigger detection
if echo "$prompt" | grep -qiE '\b(ultrawork|ulw)\b' 2>/dev/null; then
  cat <<'ULTRAWORK_DIRECTIVE'
[LazyTrae] ⚡ ULTRAWORK MODE ENABLED!

You are now operating in ULTRAWORK mode. Follow this directive for the entire session:

## Tier Triage
Classify the work as LIGHT or HEAVY. HEAVY if any of these are true:
- Multi-file changes (>3 files)
- Cross-module refactoring
- Risk of breaking existing tests
- Requires research or design decisions
- User says "careful", "thorough", or similar

## Execution Loop: PIN → RED → GREEN → SURFACE → CLEAN

1. PIN: Anchor the goal. Write success criteria. Record starting state.
2. RED: Write the failing test or reproduce the bug. Prove it's broken.
3. GREEN: Make it pass. Smallest possible change. No refactoring.
4. SURFACE: Manual-QA proof. Real surface, not dry-run.
5. CLEAN: Refactor safely. Remove AI slop. Update docs.

## Verification
- HEAVY tier: binding reviewer gate — 5-agent parallel review
- All 5 evidence gates must pass: plan reread, automated, manual-QA, adversarial, cleanup
- No completion claim without evidence

## Stop Rules
Stop when all criteria pass + cleanup receipts + notepad current + reviewer approved.
If 2 consecutive failures, escalate. If 2 waves of exploration, stop and report.

To exit ultrawork mode, say "exit ultrawork" explicitly.
ULTRAWORK_DIRECTIVE
fi

# Keyword detection for LazyTrae commands
keywords="ulw-loop|start-work|ulw-plan|handoff|stop-continuation|ralph-loop|init-deep|review-work|remove-ai-slops"
if echo "$prompt" | grep -qiE "\\b($keywords)\\b" 2>/dev/null; then
  echo "[LazyTrae] LazyTrae workflow keyword detected. Ensure relevant skill is loaded."
fi

# Ulw-loop steering detection
if echo "$prompt" | grep -qiE '(LAZYTRAE_ULW_LOOP_STEER|lazytrae\.ulw-loop\.steer|lazytrae ulw-loop steer)' 2>/dev/null; then
  echo "[LazyTrae] Ulw-loop steering directive detected. Will be processed by loop engine."
fi

# Context-pressure detection
CONTEXT_MARKERS="context compacted|context_length_exceeded|skill descriptions were shortened|context_too_large|codex ran out of room|your input exceeds the context window|long threads and multiple compactions"
if echo "$prompt" | grep -qiE "($CONTEXT_MARKERS)" 2>/dev/null; then
  if [ -x "$RECOVERY" ]; then
    bash "$RECOVERY" mark "context-pressure marker in UserPromptSubmit" 2>/dev/null || true
  else
    echo "[LazyTrae] Context pressure detected. Recovery helper missing."
  fi
fi

exit 0
