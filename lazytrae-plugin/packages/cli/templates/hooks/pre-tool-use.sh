#!/usr/bin/env bash
# LazyTrae v1.2.1 — PreToolUse hook
# Warns on write-before-read and destructive git commands.
# Provide git-bash MCP guidance and ulw-loop goal-budget protection.
# Always exits 0 — never blocks a session.

set -euo pipefail

# Read stdin for tool call metadata
input=""
if [ ! -t 0 ]; then
  input=$(cat)
fi

if [ -z "$input" ]; then
  exit 0
fi

# Extract tool_name and tool_input
tool_name=$(echo "$input" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{const j=JSON.parse(d);process.stdout.write(j.tool_name||j.toolName||'')}catch(e){}
});" 2>/dev/null || true)

tool_input=$(echo "$input" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{const j=JSON.parse(d);process.stdout.write(JSON.stringify(j.tool_input||j.toolInput||{}))}catch(e){}
});" 2>/dev/null || true)

# Write-before-read detection
EDIT_WRITE_TOOLS="write|edit|multiedit|multi_edit|apply_patch|Write|Edit|MultiEdit|delete_files|DeleteFile"
if echo "$tool_name" | grep -qiE "^($EDIT_WRITE_TOOLS)$" 2>/dev/null; then
  echo "[LazyTrae] PreToolUse: Edit/write operation '${tool_name}' detected. Ensure target file was read first."
fi

# Destructive git command detection
if echo "$tool_name" | grep -qiE '^(bash|shell_command|exec_command|RunCommand)$' 2>/dev/null; then
  cmd=$(echo "$tool_input" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{const j=JSON.parse(d);process.stdout.write(j.command||j.cmd||'')}catch(e){}
});" 2>/dev/null || true)
  if echo "$cmd" | grep -qiE '(push\s+(-f|--force)|reset\s+--hard|clean\s+-f|branch\s+-D|checkout\s+--\s|restore\s+\.)' 2>/dev/null; then
    echo "[LazyTrae] WARNING: Destructive git command detected: ${cmd}"
    echo "[LazyTrae] Verify this is intentional before proceeding."
  fi
fi

exit 0
