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

## Mandatory package load check

Before any repository discovery, identify the target host and resolve the
release-owned local command from the current project's `.trae/mcp.json`. The
managed `mcpServers.lazytrae` entry must provide:

- `command`: `node`
- `args`: `[<absolute-release-launcher>, "--root", <absolute-project-root>, "mcp"]`

For package commands, keep `node`, the absolute launcher, `--root`, and the
absolute project root; replace the final `mcp` argument with the requested
command. Never call a bare `lazytrae` executable or search `PATH`:

```bash
# Trae IDE
node <absolute-release-launcher-from-.trae/mcp.json> --root <absolute-project-root-from-.trae/mcp.json> load-check --host ide

# Trae Work
node <absolute-release-launcher-from-.trae/mcp.json> --root <absolute-project-root-from-.trae/mcp.json> load-check --host work

# Trae CLI
node <absolute-release-launcher-from-.trae/mcp.json> --root <absolute-project-root-from-.trae/mcp.json> load-check --host cli
```

This is package readiness only: it verifies skills, commands, agents, hooks,
and the MCP declaration. It does not establish host discovery or a live MCP
connection. Record the actual result in the final report. If project components
are missing, use the same release-owned command with `init --host <host>`; use
`sync` for an existing installation. For Trae Work, use `work install` if
global skills are missing. Re-run the check before continuing. If the managed
declaration is missing or modified, stop and report it; recover the command from
the known permanent release and current project root, never from `PATH`. Do not
claim the project is initialized while the package load check fails. The Trae
Work MCP setting remains manual.

## Optional Integration Boundary

The load check and any repair above handle core LazyTrae assets only: installed
skills, commands, rules, hooks, agents, schemas, and the base LazyTrae MCP
declaration. Do NOT invoke the release-owned local command with `tooling ...`.
Do NOT enable optional MCP
capabilities or install external dependencies during InitDeep. If an optional
tool is genuinely needed, report its explicit lifecycle command and wait for a
separate user-triggered request before provisioning it. Leave optional capabilities unchanged unless separately explicitly requested.

## Required Readiness Evidence

Record actual observations with these exact keys in the final report:

- `readiness_result`: the final package load-check result.
- `readiness_host`: the host argument used for that check.
- `capability_statuses`: read-only optional-capability observations, or `not inspected` when unavailable.
- `optional_policy`: `unchanged; no optional lifecycle invoked` unless a separate explicit request authorized it.
- `receipt_state`: observed receipt state, or `not inspected` when no receipt check was requested.
- `evidence_paths`: paths to the load-check output and generated AGENTS.md files.

Never substitute assumptions for observations. InitDeep may report package readiness, but it cannot establish host discovery or a live MCP connection.

## Step-by-Step Procedure

### Phase 1: Discovery + Analysis

1. **Confirm package readiness** — run the mandatory package load check above first, verify skills, commands, agents, hooks, and the MCP declaration, then report the observed result before modifying or mapping the repository.
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
   - Use Trae built-in tools (an available host capability, Grep, Glob) to map symbols and references.
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

- Create only missing AGENTS.md files.
- Only write under the project root and its subdirectories.

## User-Owned AGENTS.md Safety

Content outside every delimited `lazytrae:managed:start` /
`lazytrae:managed:end` managed block is user-owned. Preserve it byte-for-byte,
including malformed or unparseable content, and report its exact path; never
delete, replace, regenerate, or edit that user-owned content automatically. A
complete delimited managed block itself is package-owned.

`--create-new` only requests a destructive-recovery proposal; it is not
authorization. Before full-file replacement, list the exact AGENTS.md files and
obtain separate confirmation naming that same list. Before replacement, make a
byte-for-byte backup of every confirmed original at
`.lazytrae/backups/init-deep/<timestamp>/<relative-path>` and report each backup
path. Leave every unlisted AGENTS.md unchanged.

The release-owned local command with `init` updates a complete delimited package-owned
`lazytrae:managed:start` / `lazytrae:managed:end` block in AGENTS.md, or
appends a new delimited managed block when none is present, preserving all
existing surrounding bytes.

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
- If existing AGENTS.md is corrupted or unparseable: preserve all content
  outside complete delimited managed blocks byte-for-byte, report the exact
  file and parse problem, and continue without full-file replacement. Offer
  destructive recovery only through the separately confirmed, backed-up
  process above.
- If project is too small (<10 files): only generate root AGENTS.md.

## Output Format

```
=== init-deep Complete ===

Mode: {update | create-new}

Readiness:
  readiness_result: {PASS | repaired then PASS | FAIL}
  readiness_host: {ide | work | cli}
  capability_statuses: {read-only observed values | not inspected}
  optional_policy: unchanged; no optional lifecycle invoked
  receipt_state: {observed value | not inspected}
  evidence_paths:
    - {load-check output path}
    - {generated AGENTS.md path}

Package readiness does not establish host discovery or a live MCP connection.

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
- **Skipping package status**: Never begin discovery before the mandatory load check passes.
- **Sequential execution**: Must parallelize independent discoveries.
- **Ignoring existing**: Always read existing AGENTS.md first, even with --create-new.
- **Over-documenting**: Not every directory needs AGENTS.md.
- **Redundancy**: Child never repeats parent.
- **Generic content**: Remove anything that applies to ALL projects.
- **Verbose style**: Telegraphic or die.
