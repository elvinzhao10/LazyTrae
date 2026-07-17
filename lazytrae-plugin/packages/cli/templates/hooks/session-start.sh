#!/usr/bin/env bash
# LazyTrae v1.0.1 — SessionStart hook
# Reads state files and outputs active plan/loop/blockers/next action.
# Load rules and bootstrap the session; CodeGraph remains optional.
# Always exits 0 — never blocks a session.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$REPO_ROOT/.lazytrae/state"
BOULDER="$STATE_DIR/boulder.json"
LOOP="$STATE_DIR/active-loop.json"
RECOVERY="$REPO_ROOT/.trae/hooks/context-recovery.sh"

# Defaults
active_plan="(none)"
current_task="(none)"
blockers="(none)"
next_action="(none)"
loop_goal="(none)"
loop_iteration="0"
recovery_notice=""

# Read boulder state
if [ -f "$BOULDER" ]; then
  boulder_info=$(node -e "
const fs=require('fs');
try{
  const d=JSON.parse(fs.readFileSync(process.argv[1],'utf-8'));
  const w=d.active_work_id&&d.works?d.works[d.active_work_id]:null;
  let plan='', task='', blockers='';
  if(w){
    plan=w.plan_name||w.active_plan||'';
    const tasks=Array.isArray(w.tasks)?w.tasks:[];
    const next=tasks.find(t=>t.status==='in_progress')||tasks.find(t=>t.status==='pending')||tasks.find(t=>t.status==='blocked');
    task=next?(next.description||''):(tasks.length?'all tasks done':'');
    blockers=Array.isArray(w.blockers)?w.blockers.map(b=>b.reason||b.description||'unnamed').join('; '):'';
  fi
  process.stdout.write([plan,task,blockers].map(v=>String(v).replace(/\n/g,' ')).join('\t'));
}catch(e){}" "$BOULDER" 2>/dev/null || true)
  if [ -n "$boulder_info" ]; then
    IFS=$'\t' read -r active_plan current_task blockers <<< "$boulder_info"
    [ -n "$current_task" ] && next_action="execute task: $current_task"
  fi
fi

# Read active loop state
if [ -f "$LOOP" ]; then
  loop_info=$(node -e "
const fs=require('fs');
try{
  const d=JSON.parse(fs.readFileSync(process.argv[1],'utf-8'));
  const g=Array.isArray(d.goals)?d.goals.find(g=>g.status==='in_progress'):null;
  const goal=g?(g.title||''):(d.active_goal_id||'');
  const iter=g?String(g.attempt||1):'';
  process.stdout.write([goal,iter].map(v=>String(v).replace(/\n/g,' ')).join('\t'));
}catch(e){}" "$LOOP" 2>/dev/null || true)
  IFS=$'\t' read -r _goal _iter <<< "$loop_info"
  [ -n "$_goal" ] && loop_goal="$_goal"
  [ -n "$_iter" ] && loop_iteration="$_iter"
fi

# Post-compact recovery detection
if [ -x "$RECOVERY" ]; then
  recovery_notice=$(bash "$RECOVERY" recover-if-needed 2>/dev/null || true)
fi

# Output
cat <<LAZYTRAE_SESSION_START
[LazyTrae v1.0.1] Session started.

Active plan: $active_plan
Current task: $current_task
Blockers:     $blockers
Next action:  $next_action
Loop goal:    $loop_goal (iteration $loop_iteration)

$recovery_notice
LAZYTRAE_SESSION_START

exit 0
