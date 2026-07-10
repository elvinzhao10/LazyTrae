# remove-ai-slops

## Usage

`/remove-ai-slops [file1 file2 ... | --branch]`

Triggers: `remove-ai-slops`, `clean ai code`, `deslop`, `cleanup ai generated`, `remove ai slop`, `strip slop`

## Inputs

- `file1 file2 ...`: Explicit list of files to clean.
- `--branch`: Clean all changed files from current branch vs merge-base main.

## Outputs

- New regression tests (if needed to lock behavior).
- Cleaned files with AI slop removed.
- Slop removal report showing what was removed and why.
- Quality gate results.

## Success Criteria

- Behavior locked by green regression tests before any cleanup.
- All 10 slop categories applied systematically.
- No functional changes — only slop removal.
- All quality gates pass after cleanup.
- All changes are within the specified scope.

## Linked Skill

[remove-ai-slops](../skills/remove-ai-slops/SKILL.md)

## Workflow Phase

Cleanup — remove AI-generated code smells after implementation.