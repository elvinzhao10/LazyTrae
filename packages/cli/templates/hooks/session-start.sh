#!/usr/bin/env bash
# LazyTrae v0.7 — SessionStart hook
# Reads state files and outputs active plan/loop/blockers/next action.
# Mirrors LazyCodex: rules loading, bootstrap, codegraph (simplified).
# Always exits 0 — never blocks a session.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$REPO_ROOT/.lazytrae/state"
BOULDER="$STATE_DIR/boulder.json"
LOOP="$STATE_DIR/active-loop.json"
SESSIONS="$STATE_DIR/sessions.json"

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
  active_work_id=$(node -e "try{const d=require('$BOULDER');process.stdout.write(d.active_work_id||'')}catch(e){}" 2>/dev/null || true)
  if [ -n "$active_work_id" ]; then
    active_plan=$(node -e "try{const d=require('$BOULDER');const w=d.works['$active_work_id'];if(w){process.stdout.write(w.plan_name||w.active_plan||'')}}catch(e){}" 2>/dev/null || true)
    # Find first in_progress or pending task
    task_info=$(node -e "
try{
  const d=require('$BOULDER');
  const w=d.works['$active_work_id'];
  if(!w||!w.tasks)return;
  const pending=w.tasks.filter(t=>t.status==='pending');
  const inprog=w.tasks.filter(t=>t.status==='in_progress');
  const blocked=w.tasks.filter(t=>t.status==='blocked');
  if(inprog.length>0)process.stdout.write('in_progress|'+inprog[0].description);
  else if(pending.length>0)process.stdout.write('pending|'+pending[0].description);
  else if(blocked.length>0)process.stdout.write('blocked|'+blocked[0].description);
  else process.stdout.write('complete|all tasks done');
}catch(e){}" 2>/dev/null || true)
    if [ -n "$task_info" ]; then
      current_task=$(echo "$task_info" | cut -d'|' -f2)
      next_action="execute task: $current_task"
    fi
    # Read blockers
    blockers=$(node -e "try{const d=require('$BOULDER');const w=d.works['$active_work_id'];if(w&&w.blockers&&w.blockers.length>0){process.stdout.write(w.blockers.map(b=>b.reason||b.description||'unnamed').join('; '))}}catch(e){}" 2>/dev/null || true)
  fi
fi

# Read active loop state
if [ -f "$LOOP" ]; then
  _goal=$(node -e "try{const d=require('$LOOP');const g=d.goals?d.goals.find(g=>g.status==='in_progress'):null;if(g)process.stdout.write(g.title);else if(d.active_goal_id)process.stdout.write(d.active_goal_id)}catch(e){}" 2>/dev/null || true)
  _iter=$(node -e "try{const d=require('$LOOP');const g=d.goals?d.goals.find(g=>g.status==='in_progress'):null;if(g)process.stdout.write(String(g.attempt||1))}catch(e){}" 2>/dev/null || true)
  [ -n "$_goal" ] && loop_goal="$_goal"
  [ -n "$_iter" ] && loop_iteration="$_iter"
fi

# Post-compact recovery detection
if [ -f "$SESSIONS" ]; then
  recovery_needed=$(node -e "try{const d=require('$SESSIONS');process.stdout.write(d.compaction_state&&d.compaction_state.post_compact_recovery_needed?'true':'false')}catch(e){}" 2>/dev/null || true)
  if [ "$recovery_needed" = "true" ]; then
    recovery_notice="[LazyTrae] Post-compact recovery needed. Re-injecting project rules and state context."
    # Reset the flag
    node -e "
try{
  const d=require('$SESSIONS');
  if(d.compaction_state)d.compaction_state.post_compact_recovery_needed=false;
  require('fs').writeFileSync('$SESSIONS',JSON.stringify(d,null,2)+'\n');
}catch(e){}" 2>/dev/null || true
  fi
fi

# Output
cat <<LAZYTRAE_SESSION_START
[LazyTrae v0.7] Session started.

Active plan: $active_plan
Current task: $current_task
Blockers:     $blockers
Next action:  $next_action
Loop goal:    $loop_goal (iteration $loop_iteration)

$recovery_notice
LAZYTRAE_SESSION_START

exit 0