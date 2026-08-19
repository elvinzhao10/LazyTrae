#!/usr/bin/env bash
# LazyTrae v1.1.0 — Stop hook
# Emits continuation reminder if active work is incomplete.
# Provide start-work continuation and executor evidence verification.
# Always exits 0 — never blocks a session.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$REPO_ROOT/.lazytrae/state"
BOULDER="$STATE_DIR/boulder.json"
LOOP="$STATE_DIR/active-loop.json"

gate_output=""
MCP_CONFIG="$REPO_ROOT/.trae/mcp.json"
if [ -f "$MCP_CONFIG" ]; then
  launcher="$(node -e '
try {
  const config = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const server = config.mcpServers && config.mcpServers.lazytrae;
  if (server && server.command === "node" && Array.isArray(server.args)
      && server.args.length === 4 && server.args[1] === "--root" && server.args[3] === "mcp") {
    process.stdout.write(server.args[0]);
  }
} catch (_) {}
' "$MCP_CONFIG" 2>/dev/null || true)"
  if [ -n "$launcher" ] && [ -f "$launcher" ]; then
    gate_output="$(node "$launcher" --root "$REPO_ROOT" completion-status 2>/dev/null || true)"
  fi
fi

if printf '%s\n' "$gate_output" | head -n 1 | grep -qx "blocked"; then
  echo ""
  echo "=== LazyTrae Completion Gate Reminder ==="
  echo ""
  printf '%s\n' "$gate_output"
  echo ""
  echo "========================================="
  echo ""
  exit 0
fi

has_incomplete=false
reminders=""

# Check boulder for incomplete tasks
if [ -f "$BOULDER" ]; then
  incomplete=$(node -e "
try{
  const d=require('$BOULDER');
  const wid=d.active_work_id;
  if(!wid){process.stdout.write('');return;}
  const w=d.works[wid];
  if(!w){process.stdout.write('');return;}
  const pending=w.tasks.filter(t=>t.status==='pending'||t.status==='in_progress');
  if(pending.length>0){
    process.stdout.write(pending[0].description+'|'+pending.length+'|'+w.plan_name);
  }
}catch(e){}" 2>/dev/null || true)
  if [ -n "$incomplete" ]; then
    has_incomplete=true
    task_desc=$(echo "$incomplete" | cut -d'|' -f1)
    task_count=$(echo "$incomplete" | cut -d'|' -f2)
    plan_name=$(echo "$incomplete" | cut -d'|' -f3)
    reminders="${reminders}[LazyTrae] Boulder has ${task_count} incomplete task(s) remaining in plan '${plan_name}'.
[LazyTrae] Next task: ${task_desc}
[LazyTrae] To resume: paste the handoff summary or run the release-owned launcher from .trae/mcp.json with --root and handoff.
"
  fi
fi

# Check active loop for in-progress goals
if [ -f "$LOOP" ]; then
  loop_status=$(node -e "
try{
  const d=require('$LOOP');
  const active=d.goals?d.goals.find(g=>g.status==='in_progress'):null;
  if(active)process.stdout.write(active.title+'|'+String(active.attempt||1));
  else if(d.active_goal_id)process.stdout.write(d.active_goal_id+'|1');
}catch(e){}" 2>/dev/null || true)
  if [ -n "$loop_status" ]; then
    has_incomplete=true
    loop_goal=$(echo "$loop_status" | cut -d'|' -f1)
    loop_iter=$(echo "$loop_status" | cut -d'|' -f2)
    reminders="${reminders}[LazyTrae] Active loop has in-progress goal: ${loop_goal} (iteration ${loop_iter}).
[LazyTrae] To continue the loop: use ulw-loop or start-work command.
"
  fi
fi

if [ "$has_incomplete" = true ]; then
  echo ""
  echo "=== LazyTrae Continuation Reminder ==="
  echo ""
  echo "$reminders"
  echo "======================================="
  echo ""
fi

exit 0
