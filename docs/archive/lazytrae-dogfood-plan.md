# LazyTrae v0.12 Dogfood — Decision-Complete Plan

> **Plan slug**: `v0.12-dogfood-coding-agent-sessions`
> **Plan author**: Sisyphus (orchestrator)
> **Date**: 2026-07-09
> **Version**: v0.12 (dogfood)

## Objective

Fix parity-ledger item 8.15: **coding-agent-sessions skill**, currently DESIGN, by creating `.trae/skills/coding-agent-sessions/SKILL.md`. This moves the item from DESIGN → COMPLETE and improves the parity ledger coverage.

## Background

The LazyCodex `coding-agent-sessions` skill (`lazycodex/plugins/omo/skills/coding-agent-sessions/SKILL.md`) is a cross-platform session finder that uses a Python script (`scripts/find-agent-sessions.py`) to search transcripts across Codex, Claude, OpenCode, Senpi, and other coding agents. In LazyTrae, the equivalent is session tracking via `.lazytraework/state/sessions.json`, which is simpler but lacks a formal skill definition.

The LazyTrae SKILL.md will adapt the LazyCodex concept for the Trae environment:
- Document how to use Trae session tracking (`.lazytraework/state/sessions.json`)
- Provide guidance on searching/reconstructing past work from Trae sessions
- Reference the LazyCodex canonical source for parity documentation
- Follow the same structure as other LazyTrae skills (frontmatter, canonical source, purpose, procedure, etc.)

## Deliverables

1. **`.trae/skills/coding-agent-sessions/SKILL.md`** — new skill file (~60-100 lines)
2. **Updated `docs/lazytrae-parity-ledger.md`** — item 8.15: DESIGN → COMPLETE, summary table recomputed
3. **Updated `docs/lazytrae-dogfood-run.md`** — dogfood report (separate file)
4. **Updated `docs/lazytrae-dogfood-plan.md`** — this file
5. **Updated `docs/lazytrae-dogfood-review.md`** — reviewer output (separate file)

## Deliverable 1: SKILL.md Structure

The SKILL.md must follow the LazyTrae convention established by existing skills (librarian, verifier, init-deep). Required sections:

1. **Frontmatter** (YAML): name, description with triggers
2. **Title**: `# coding-agent-sessions`
3. **Brief intro**: What the skill does
4. **Canonical LazyCodex Source**: Reference to the LazyCodex source file
5. **Purpose**: Why this skill exists
6. **Required Context to Inspect**: What files/state to read before using
7. **Step-by-Step Procedure**: How to use the skill
   - List recent sessions
   - Find sessions by keyword/date/platform
   - Read session details
   - Export/reconstruct past work
8. **Allowed Edits**: What the skill is permitted to do
9. **Forbidden Behavior**: What the skill must not do
10. **Verification Gates**: The five gates applied to this skill's outputs
11. **Failure Handling**: What to do when things go wrong
12. **Output Format**: How results should be presented
13. **Handoff Target**: Where to go after this skill completes

### Acceptance Criteria for SKILL.md

- [ ] Frontmatter has `name: coding-agent-sessions` and triggers line matching LazyCodex description
- [ ] Canonical source reference cites `lazycodex/plugins/omo/skills/coding-agent-sessions/SKILL.md`
- [ ] Procedure references LazyTrae-native tools (SearchCodebase, Grep, Read) instead of Python scripts
- [ ] Procedure references `.lazytraework/state/sessions.json` as the LazyTrae session store
- [ ] Procedure covers: listing, searching, reading, and exporting sessions
- [ ] All five standard sections present (Allowed Edits, Forbidden Behavior, Verification Gates, Failure Handling, Output Format, Handoff Target)
- [ ] File is 60-100 lines (not counting frontmatter)
- [ ] Follows the same structural pattern as `.trae/skills/librarian/SKILL.md` and `.trae/skills/verifier/SKILL.md`

## Deliverable 2: Parity Ledger Update

- Item 8.15: Status DESIGN → COMPLETE
- Evidence: `.trae/skills/coding-agent-sessions/SKILL.md` created
- Summary table recomputed:
  - Skills (Shared): 22 → still 22 total, but 21 COMPLETE + 1 DESIGN → 22 COMPLETE + 0 DESIGN
  - TOTAL: 125 → still 125, but COMPLETE: 113 → 114, DESIGN: 3 → 2

### Acceptance Criteria for Parity Ledger

- [ ] Item 8.15 status updated from DESIGN to COMPLETE
- [ ] LazyTrae Artifact column shows `.trae/skills/coding-agent-sessions/SKILL.md`
- [ ] Summary table Skills row: COMPLETE 21→22, DESIGN 1→0
- [ ] Summary table TOTAL row: COMPLETE 113→114, DESIGN 3→2
- [ ] Coverage text updated: "113/125 (90.4%)" → "114/125 (91.2%)"
- [ ] Coverage detail text updated to reflect new counts

## Steps (execution order)

### Step 1: Create SKILL.md
- Write `.trae/skills/coding-agent-sessions/SKILL.md`
- Follow the structure defined above
- Keep within 60-100 lines (body, excluding frontmatter)

### Step 2: Run doctor verification
- `node packages/cli/src/index.js doctor`
- Must report all checks passing

### Step 3: Update parity ledger
- Edit `docs/lazytrae-parity-ledger.md`
- Item 8.15: DESIGN → COMPLETE
- Recompute summary table

### Step 4: Create dogfood run report
- Write `docs/lazytrae-dogfood-run.md` with full evidence

### Step 5: Create reviewer report
- Write `docs/lazytrae-dogfood-review.md` with five-gate analysis

## Acceptance Criteria (overall)

- [ ] `.trae/skills/coding-agent-sessions/SKILL.md` exists and passes acceptance criteria above
- [ ] `lazytrae doctor` exits 0, reports all checks pass
- [ ] Parity ledger item 8.15 is COMPLETE
- [ ] Parity ledger summary table arithmetic is correct
- [ ] No file exceeds 250 LOC (check with `wc -l`)
- [ ] AGENTS.md managed blocks intact (doctor reports "3 blocks intact")
- [ ] All deliverable files created

## Rollback

If the SKILL.md is found to be incorrect or incomplete:
1. Delete `.trae/skills/coding-agent-sessions/SKILL.md`
2. Revert parity ledger item 8.15 to DESIGN
3. Recompute summary table

## References

- LazyCodex canonical source: `lazycodex/plugins/omo/skills/coding-agent-sessions/SKILL.md`
- LazyTrae session state: `.lazytraework/state/sessions.json`
- Existing skill templates: `.trae/skills/librarian/SKILL.md`, `.trae/skills/verifier/SKILL.md`
- Parity ledger: `docs/lazytrae-parity-ledger.md`
- Command index: `docs/lazytrae-command-index.md`
