#!/usr/bin/env bash
# LazyTrae v1.0.3 — UserPromptSubmit hook
# Detects ulw/ultrawork keywords, ulw-loop steering, and context-pressure markers.
# Detect ultrawork triggers, ulw-loop steering, and rule reinjection needs.
# Always exits 0 — never blocks a session.

set -euo pipefail

adaptive_suppress_legacy="${LAZYTRAE_ADAPTIVE_SUPPRESS_LEGACY:-0}"
fallback='{"lazytraeAdaptive":{"version":1,"kind":"workflow-decision","mode":null,"stages":[],"responsibilities":[],"capabilityClasses":[],"verificationLevel":null,"approval":{"requiredClasses":[],"status":"not-required"},"workflowSurfaces":[],"hostQualification":"degraded","dispatch":"blocked:host-unverified","hostExecution":"not-observed","persistence":"skipped:no-runtime","requestDigest":null,"continuation":{"status":"fresh"}}}'
malformed_fallback='{"lazytraeAdaptive":{"version":1,"kind":"workflow-decision","mode":null,"stages":[],"responsibilities":[],"capabilityClasses":[],"verificationLevel":null,"approval":{"requiredClasses":[],"status":"not-required"},"workflowSurfaces":[],"hostQualification":"unverified","dispatch":"blocked:malformed-input","hostExecution":"not-observed","persistence":"skipped:malformed-input","requestDigest":null,"continuation":{"status":"fresh"}}}'
MAX_HOOK_INPUT_BYTES=1048576

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
RECOVERY="$REPO_ROOT/.trae/hooks/context-recovery.sh"

input_file=""
cleanup_input() {
  if [ -n "$input_file" ]; then
    rm -f -- "$input_file"
  fi
}
trap cleanup_input EXIT

if [ ! -t 0 ]; then
  if ! input_file=$(mktemp "${TMPDIR:-/tmp}/lazytrae-hook-input.XXXXXX"); then
    printf '%s\n' "$malformed_fallback"
    printf '%s\n' '[LazyTrae hook warning] Hook input could not be buffered safely.' >&2
    exit 0
  fi
  if ! head -c "$((MAX_HOOK_INPUT_BYTES + 1))" > "$input_file"; then
    printf '%s\n' "$malformed_fallback"
    printf '%s\n' '[LazyTrae hook warning] Hook input could not be read safely.' >&2
    exit 0
  fi
  input_size=$(LC_ALL=C wc -c < "$input_file")
  if [ "$input_size" -gt "$MAX_HOOK_INPUT_BYTES" ]; then
    printf '%s\n' "$malformed_fallback"
    printf '%s\n' '[LazyTrae hook warning] Hook input exceeds the safe size limit.' >&2
    exit 0
  fi
fi

if [ "${LAZYTRAE_ADAPTIVE_EMITTED:-0}" != "1" ]; then
  launcher=__LAZYTRAE_RELEASE_LAUNCHER__
  launcher=$(node -e '
const fs=require("fs"),path=require("path");
try {
  const candidate=process.argv[1];
  const stat=fs.lstatSync(candidate);
  const packageJson=JSON.parse(fs.readFileSync(path.join(path.dirname(candidate),"..","package.json"),"utf8"));
  const valid=path.isAbsolute(candidate)
    && path.basename(candidate)==="lazytrae.js"
    && path.basename(path.dirname(candidate))==="bin"
    && stat.isFile() && !stat.isSymbolicLink()
    && fs.realpathSync(candidate)===candidate
    && packageJson.name==="lazytrae-ai"
    && packageJson.version==="1.0.3";
  if(valid) process.stdout.write(candidate);
} catch (_) {}
' "$launcher" 2>/dev/null || true)
  if [ -n "$launcher" ]; then
    if [ -n "$input_file" ]; then
      if adaptive_output=$(LAZYTRAE_ADAPTIVE_ONLY=1 node "$launcher" --root "$REPO_ROOT" hook user-prompt-submit < "$input_file"); then :; else adaptive_output=""; fi
    else
      if adaptive_output=$(LAZYTRAE_ADAPTIVE_ONLY=1 node "$launcher" --root "$REPO_ROOT" hook user-prompt-submit "$@"); then :; else adaptive_output=""; fi
    fi
    if adaptive_stop=$(printf '%s' "$adaptive_output" | node -e '
let data="";process.stdin.on("data",chunk=>data+=chunk);process.stdin.on("end",()=>{try{const lines=data.split(/\r?\n/).filter(Boolean);const value=JSON.parse(lines[0]);const directive=value.lazytraeAdaptive;if(lines.length!==1||directive?.kind!=="workflow-decision"){process.exitCode=1;return}process.stdout.write(directive.dispatch==="blocked:malformed-input"?"malformed":"1")}catch(_){process.exitCode=1}});
'); then
      printf '%s\n' "$adaptive_output"
      if [ "$adaptive_stop" = "malformed" ]; then
        exit 0
      fi
      if [ "$adaptive_stop" = "1" ]; then
        adaptive_suppress_legacy="1"
      fi
    else
      printf '%s\n' "$fallback"
      exit 0
    fi
  else
    printf '%s\n' "$fallback"
    exit 0
  fi
fi

# Extract prompt from hook event JSON
prompt=""
if [ -n "$input_file" ]; then
  prompt=$(node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{const j=JSON.parse(d);process.stdout.write(j.prompt||j.user_prompt||'')}catch(e){}
});" < "$input_file" 2>/dev/null || true)
fi

# Merge with possible command-line argument
if [ -z "$prompt" ] && [ $# -gt 0 ]; then
  prompt="$*"
fi

# ULTRAWORK trigger detection
if [ "$adaptive_suppress_legacy" != "1" ] && echo "$prompt" | grep -qiE '\b(ultrawork|ulw)\b' 2>/dev/null; then
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
if [ "$adaptive_suppress_legacy" != "1" ] && echo "$prompt" | grep -qiE "\\b($keywords)\\b" 2>/dev/null; then
  echo "[LazyTrae] LazyTrae workflow keyword detected. Ensure relevant skill is loaded."
fi

# Ulw-loop steering detection
if [ "$adaptive_suppress_legacy" != "1" ] && echo "$prompt" | grep -qiE '(LAZYTRAE_ULW_LOOP_STEER|lazytrae\.ulw-loop\.steer|lazytrae ulw-loop steer)' 2>/dev/null; then
  echo "[LazyTrae] Ulw-loop steering directive detected. Will be processed by loop engine."
fi

# Context-pressure detection
CONTEXT_MARKERS="context compacted|context_length_exceeded|skill descriptions were shortened|context_too_large|codex ran out of room|your input exceeds the context window|long threads and multiple compactions"
if echo "$prompt" | grep -qiE "($CONTEXT_MARKERS)" 2>/dev/null; then
  if [ -x "$RECOVERY" ]; then
    bash "$RECOVERY" mark "context-pressure marker in UserPromptSubmit" >/dev/null 2>&1 || true
  else
    echo "[LazyTrae] Context pressure detected. Recovery helper missing."
  fi
fi

exit 0
