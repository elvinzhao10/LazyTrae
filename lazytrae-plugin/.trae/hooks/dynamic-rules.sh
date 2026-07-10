#!/usr/bin/env bash
# LazyTrae v0.7 — Dynamic rule matching (companion to post-tool-use.sh)
# Extracts file types from changed files and reminds about relevant rules.
# LazyCodex uses file fingerprint matching; LazyTrae uses extension/path-based matching.
# Always exits 0 — never blocks a session.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RULES_DIR="$REPO_ROOT/.trae/rules"

# Args: changed_files (semicolon-delimited string)
changed_files="${1:-}"
[ -z "$changed_files" ] && exit 0

matched_rules=""

for f in $(echo "$changed_files" | tr ';;' '\n'); do
  if [ -f "$f" ]; then
    basename_f=$(basename "$f")
    ext="${f##*.}"
    if [ -d "$RULES_DIR" ]; then
      for rule_file in "$RULES_DIR"/*.md; do
        [ -f "$rule_file" ] || continue
        rule_name=$(basename "$rule_file" .md)
        [ "$rule_name" = "lazytrae" ] && continue
        if grep -q "^pattern:" "$rule_file" 2>/dev/null; then
          pattern=$(grep "^pattern:" "$rule_file" | sed 's/^pattern:\s*//')
          echo "$basename_f" | grep -qiE "$pattern" 2>/dev/null && matched_rules="$matched_rules $rule_name"
        fi
        echo "$rule_name" | grep -qiE "($ext)" 2>/dev/null && matched_rules="$matched_rules $rule_name"
      done
    fi
  fi
done

if [ -n "$matched_rules" ]; then
  unique_rules=$(echo "$matched_rules" | tr ' ' '\n' | sort -u | tr '\n' ' ')
  echo "[LazyTrae] Dynamic rules matched:${unique_rules}"
  echo "[LazyTrae] Review relevant rules before proceeding with changes."
fi

exit 0
