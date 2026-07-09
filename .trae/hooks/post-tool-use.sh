#!/usr/bin/env bash
# LazyTrae v0.7 — PostToolUse hook
# Records changed files, runs comment-checker, captures verification output.
# Always exits 0 — never blocks a session.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SESSIONS="$REPO_ROOT/.lazytrae/state/sessions.json"

input=""
[ ! -t 0 ] && input=$(cat)
[ -z "$input" ] && exit 0

# Extract tool metadata, changed files, and record session in one pass
eval "$(echo "$input" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try{
    const j=JSON.parse(d);
    const name=j.tool_name||j.toolName||'';
    const ti=j.tool_input||j.toolInput||{};
    const tr=j.tool_response||j.toolResponse||{};
    const paths=[];
    for(const k of ['filePath','file_path','path','target','targetPath','target_path'])
      if(typeof ti[k]==='string')paths.push(ti[k]);
    if(Array.isArray(ti.filePaths)||Array.isArray(ti.file_paths))
      for(const p of(ti.filePaths||ti.file_paths||[]))if(typeof p==='string')paths.push(p);
    const ec=tr.exitCode||tr.exit_code||tr.status;
    process.stdout.write('tool_name='+JSON.stringify(name)+';');
    process.stdout.write('changed_files='+JSON.stringify(paths.join(';;'))+';');
    process.stdout.write('exit_code='+JSON.stringify(ec!==undefined&&ec!==null?String(ec):'')+';');
  }catch(e){}
});" 2>/dev/null || echo "tool_name='';changed_files='';exit_code=''")"

# Only process edit/write tools
EDIT_TOOLS="write|edit|multiedit|multi_edit|apply_patch|Write|Edit|MultiEdit|delete_files|DeleteFile"
if ! echo "$tool_name" | grep -qiE "^($EDIT_TOOLS)$" 2>/dev/null; then
  # Check RunCommand exit code
  if echo "$tool_name" | grep -qiE '^(bash|shell_command|exec_command|RunCommand)$' 2>/dev/null; then
    [ -n "$exit_code" ] && [ "$exit_code" != "0" ] && echo "[LazyTrae] Command exited with code: ${exit_code}"
  fi
  exit 0
fi

# Record changed files in sessions.json
if [ -n "$changed_files" ] && [ -f "$SESSIONS" ]; then
  node -e "
try{
  const fs=require('fs');
  const d=require('$SESSIONS');
  const paths='$changed_files'.split(';;').filter(Boolean);
  const sid=d.current_session_id;
  if(sid&&d.sessions&&d.sessions[sid]){
    if(!d.sessions[sid].changed_files)d.sessions[sid].changed_files=[];
    for(const p of paths)if(!d.sessions[sid].changed_files.includes(p))d.sessions[sid].changed_files.push(p);
    d.sessions[sid].last_active_at=new Date().toISOString();
    fs.writeFileSync('$SESSIONS',JSON.stringify(d,null,2)+'\n');
  }
}catch(e){}" 2>/dev/null || true
fi

# Comment-checker: grep for AI-slop patterns in changed files
AI_SLOP_PATTERNS="// This function does|// This class represents|// This file contains|// TODO: implement|// TODO: remove|// removed code here|# This function does|# TODO: implement|# FIXME: implement|// FIXME: implement"
for f in $(echo "$changed_files" | tr ';;' '\n'); do
  if [ -f "$f" ]; then
    ext="${f##*.}"
    case "$ext" in
      ts|js|py|rs|go|java|swift|kt|tsx|jsx|mjs|cjs)
        grep -n -i -E "$AI_SLOP_PATTERNS" "$f" 2>/dev/null && echo "[LazyTrae] AI-slop pattern detected in: $f"
        ;;
    esac
  fi
done

# Dynamic rule matching (delegated to companion script to keep this hook under 100 lines)
bash "$REPO_ROOT/.trae/hooks/dynamic-rules.sh" "$changed_files" 2>/dev/null || true

exit 0
