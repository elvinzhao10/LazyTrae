---
name: lazy-init-deep
description: "Hierarchical repo understanding and AGENTS.md generation. Use when onboarding a new repository, after major refactors, or when agents keep picking wrong files. Triggers: init-deep, initialize repo, generate AGENTS.md, understand this codebase."
---

# init-deep

Generate hierarchical AGENTS.md files for a project. Root AGENTS.md + complexity-scored subdirectory AGENTS.md files.


## Purpose

Give agents local, scoped, telegraphic context before they touch code. A root AGENTS.md orients to the project; nested AGENTS.md files in high-complexity directories give scoped guidance. The first session pays for every session after it.

## Required Context to Inspect

- The repository root directory and its layout.
- Existing AGENTS.md / CLAUDE.md / CONTEXT.md files.
- Project config files (package.json, tsconfig.json, pyproject.toml, etc.).
- LSP symbol inventory (if available via Trae built-in tools).
- Git history (recent commits, branch structure).
- Build/test/dev commands.

## Mandatory host load check

Before any repository discovery, identify the current host and run its status check. This is required every time `lazy-init-deep` is invoked, including an existing project:

```bash
# Trae IDE
lazytrae load-check --host ide

# Trae Work
lazytrae load-check --host work

# Trae CLI
lazytrae load-check --host cli
```

Record the exact result in the final report. If project components are missing, run `lazytrae init --host <host>`; use `lazytrae sync` for an existing installation. For Trae Work, run `lazytrae work install` if global skills are missing. Re-run the check before continuing. Do not claim the project is initialized while the host load check fails. The Trae Work MCP setting remains manual.

## Step-by-Step Procedure

### Phase 1: Discovery + Analysis

1. **Confirm host readiness** — run the mandatory host load check above and report its observed counts before modifying or mapping the repository.
2. **Fire parallel read-only exploration** — use Trae Subagents or parallel tool calls to explore:
   - Project structure (directory layout, file counts, code concentration).
   - Entry points (main files, CLI entry, server bootstrap).
   - Conventions (config files, lint rules, formatting standards).
   - Anti-patterns (DO NOT, NEVER, DEPRECATED comments).
   - Build/CI pipeline (.github/workflows, Makefile, CI config).
   - Test patterns (test directories, test frameworks, coverage).
3. **Main session analysis** — while sub-agents run:
   - Run directory structure analysis (depth, file counts per directory, code concentration by extension).
   - Read existing AGENTS.md / CLAUDE.md files.
   - Use Trae built-in tools (SearchCodebase, Grep, Glob) to map symbols and references.
4. **Collect and merge** all findings.

### Phase 2: Scoring & Location Decision

Score each directory using this matrix:

| Factor | Weight | High Threshold |
|--------|--------|----------------|
| File count | 3x | >20 files |
| Subdir count | 2x | >5 subdirectories |
| Code ratio | 2x | >70% code files |
| Unique patterns | 1x | Has own config |
| Module boundary | 2x | Has index.ts / __init__.py |
| Symbol density | 2x | >30 symbols |
| Export count | 2x | >10 exports |
| Reference centrality | 3x | >20 references |

Decision rules:
- **Root (.)** — ALWAYS create.
- **Score >15** — Create AGENTS.md.
- **Score 8-15** — Create if distinct domain.
- **Score <8** — Skip (parent covers).

### Phase 3: Generate AGENTS.md

**Root AGENTS.md** (50-150 lines, telegraphic style):
- OVERVIEW (1-2 sentences: what + core stack)
- STRUCTURE (directory tree, non-obvious purposes only)
- WHERE TO LOOK (task → location mapping)
- CODE MAP (key symbols, types, locations, roles)
- CONVENTIONS (ONLY deviations from standard)
- ANTI-PATTERNS (explicitly forbidden in this project)
- COMMANDS (dev/test/build)
- NOTES (gotchas)

**Subdirectory AGENTS.md** (30-80 lines, never repeat parent content):
- OVERVIEW (1 line)
- STRUCTURE (if >5 subdirs)
- WHERE TO LOOK
- CONVENTIONS (if different from parent)
- ANTI-PATTERNS

### Phase 4: Review & Deduplicate

- Remove generic advice that applies to all projects.
- Remove parent duplicates from child AGENTS.md files.
- Trim to size limits.
- Verify telegraphic style.

## Allowed Edits

- Create new AGENTS.md files.
- Edit existing AGENTS.md files (update mode).
- Delete all AGENTS.md and regenerate (--create-new mode).
- Only write under the project root and its subdirectories.

## Forbidden Behavior

- Do NOT generate AGENTS.md for node_modules, .git, dist, build, vendor directories.
- Do NOT exceed 150 lines for root AGENTS.md or 80 lines for subdirectory.
- Do NOT include generic advice (e.g., "write clean code", "follow best practices").
- Do NOT repeat parent content in child AGENTS.md.
- Do NOT skip Phase 1 discovery — never plan blind.

## Verification Gates

1. **Plan reread**: Confirm all planned AGENTS.md locations were created.
2. **Automated verification**: Check file sizes, no empty files, no duplicates.
3. **Manual-QA**: Read each generated AGENTS.md and verify it is telegraphic, non-generic, and scoped.
4. **Adversarial QA**: Verify subdirectory AGENTS.md do not repeat parent content. Verify no stale information from outdated existing files.
5. **Cleanup**: Remove any temporary notes or scratch files.

## Failure Handling

- If exploration cannot complete (e.g., no tools available for symbol analysis): proceed with file-based analysis only, note the limitation.
- If existing AGENTS.md is corrupted or unparseable: treat as --create-new.
- If project is too small (<10 files): only generate root AGENTS.md.

## Output Format

```
=== init-deep Complete ===

Mode: {update | create-new}

Host load check: {PASS | repaired then PASS}
Host: {Trae IDE | Trae Work | Trae CLI}

Files:
  [OK] ./AGENTS.md (root, {N} lines)
  [OK] ./src/hooks/AGENTS.md ({N} lines)

Dirs Analyzed: {N}
AGENTS.md Created: {N}
AGENTS.md Updated: {N}

Hierarchy:
  ./AGENTS.md
  └── src/hooks/AGENTS.md
```

## Handoff Target

After init-deep completes, the project is ready for `ulw-plan` (planning) or `start-work` (execution). The generated AGENTS.md files provide context for all subsequent agents.

## Anti-Patterns

- **Static exploration**: Must vary exploration depth based on project size.
- **Skipping host status**: Never begin discovery before the mandatory load check passes.
- **Sequential execution**: Must parallelize independent discoveries.
- **Ignoring existing**: Always read existing AGENTS.md first, even with --create-new.
- **Over-documenting**: Not every directory needs AGENTS.md.
- **Redundancy**: Child never repeats parent.
- **Generic content**: Remove anything that applies to ALL projects.
- **Verbose style**: Telegraphic or die.
