# LazyTrae Operating Manual

> **v0.2 — Project Constitution, Rules, and Memory.** Part of the v0.x series.
> This is the detailed operating manual for agents working on LazyTrae.

## 1. Workflow Phases

Every LazyTrae execution follows five phases, matching the LazyCodex workflow:

### 1.1 Explore
- Understand the codebase before making changes.
- Use `lazycodex/` as the canonical source of truth.
- Run read-only subagents for parallel exploration when the scope is large.
- Verify every claim against actual source files, not memory.
- Output: clear understanding of what exists and what needs to change.

### 1.2 Plan
- Read the versioned plan file from `plan/` for the current version.
- Generate a decision-complete plan with references, acceptance criteria, and commit boundaries.
- Never implement during planning.
- The plan must be reviewable by another agent without additional context.
- Output: a plan file or checklist with actionable items.

### 1.3 Implement
- Execute one checklist item at a time.
- Read the actual LazyCodex source before implementing any feature.
- Preserve LazyCodex semantics; document deviations.
- Never batch multiple tasks in a single step.
- Reconcile every plan step: completed, blocked (reason), or removed (reason).
- Output: changed files, commands run, evidence produced.

### 1.4 Verify
- Run automated verification: tests, linters, type checks, builds.
- Produce manual-QA evidence: real-surface proof from CLI, HTTP, browser, files.
- Pass adversarial QA: edge cases, regression scenarios, adversarial inputs.
- Clean up AI slop, dead code, unused imports, stale comments.
- Output: evidence files, test results, QA reports.

### 1.5 Manually QA
- Real-surface proof through channels: HTTP, tmux, browser, CLI, data.
- Evidence must be concrete: a captured artifact, not a dry-run claim.
- A step does not close on a status string — it closes on a captured artifact.
- Output: verifier evidence, reviewer evidence, oracle review.

## 2. The Five Evidence Gates

Before any step can close, it must pass five gates (from LazyCodex `hooks-lifecycle.md`):

### Gate 1: Plan Reread
- Re-read the plan before claiming completion.
- Does the implementation match the specification?
- Are all checklist items accounted for?
- Evidence: confirmation that the plan was reread and matched.

### Gate 2: Automated Verification
- Run tests, linters, type checks, builds.
- No regressions allowed.
- All automated checks must pass.
- Evidence: test output, lint results, build logs.

### Gate 3: Manual-QA
- Real-surface proof through channels.
- Not "I think it works" — show it working.
- Evidence: CLI output, HTTP responses, file contents, screenshots, terminal sessions.

### Gate 4: Adversarial QA
- Edge cases: what happens at boundaries?
- Regression scenarios: did we break anything that was working?
- Adversarial inputs: what happens with unexpected input?
- Evidence: list of tested scenarios and results.

### Gate 5: Cleanup
- Remove AI-generated slop: unnecessary comments, verbose logging, dead code.
- Remove unused imports, stale variables, commented-out code.
- Preserve behavior — cleanup must not change functionality.
- Evidence: diff showing removals only, confirmation that tests still pass.

## 3. How to Use the Command Index

- See `docs/lazytrae-command-index.md` for the full table of canonical LazyCodex commands and their LazyTrae equivalents.
- Each command entry includes: original name, source path, LazyTrae equivalent, implementation status, and notes.
- Before implementing any command:
  1. Read the LazyCodex source doc for that command.
  2. Check the command index for the designed LazyTrae equivalent.
  3. Verify the implementation status — if already COMPLETE, do not re-implement.
  4. If DESIGN, follow the architecture plan for implementation.
  5. If DEFERRED or N/A, document the reason and move on.

## 4. How to Update the Parity Ledger

- See `docs/lazytrae-parity-ledger.md` for the full ledger.
- After implementing any feature:
  1. Find the corresponding entry in the parity ledger.
  2. Update the status from DESIGN to COMPLETE (or PARTIAL if gaps remain).
  3. Add evidence: files changed, tests run, verification output.
  4. Update the summary table at the bottom of the ledger.
- Statuses:
  - **COMPLETE**: Fully implemented and verified.
  - **PARTIAL**: Partially implemented; known gaps documented.
  - **DESIGN**: Designed in architecture; not yet implemented.
  - **DEFERRED**: Intentionally deferred; rationale documented.
  - **N/A**: Not applicable to Trae platform.

## 5. How to Record Evidence

- Evidence goes in `.lazytraework/evidence/` (once the runtime is implemented in v0.5).
- For now (v0.2), evidence is recorded in:
  - The version plan file (e.g., `plan/v0.2-rules-memory.md` verification notes).
  - Commit messages.
  - The parity ledger status updates.
- Evidence includes:
  - Commands run and their output.
  - Exit status codes.
  - Changed files with paths.
  - Manual checks performed.
  - Reviewer findings.
  - Test results.

## 6. How to Handle Blockers and Failures

- If a task cannot be completed:
  1. Mark it as **blocked** with a clear reason.
  2. Document the blocker in the plan file.
  3. Update the parity ledger if the blocker affects parity status.
  4. Propose a path forward or alternative approach.
- Never silently skip a task.
- Every plan step is reconciled: completed, blocked (reason), or removed (reason).
- If a blocker requires external input (user decision, missing dependency, platform limitation), surface it clearly.

## 7. Handoff Format

When handing off a session, produce a summary containing:

```
## What was accomplished
- [List of completed items with evidence]

## Current state
- [What's done, what's blocked, what's next]

## Evidence produced
- [Files changed, commands run, test results, verification output]

## Remaining gaps
- [Known issues, blockers, unfinished items]

## Next prompt to paste
- [The exact prompt for the next session to continue]
```

## 8. Session Lifecycle

### Session Start
1. Read `AGENTS.md` for the project constitution.
2. Read `.trae/rules/lazytrae.md` for operating rules.
3. Read the current version plan file from `plan/`.
4. Read the parity ledger for current status.
5. Identify the next actionable task.

### During Session
1. Execute one task at a time.
2. Record evidence as you go.
3. Update the parity ledger after each completed feature.
4. If blocked, document the blocker and continue with next task.

### Session End
1. Produce a handoff summary.
2. Commit changes with a conventional commit message.
3. Ensure all evidence is recorded.
4. Leave the repo in a clean state (no uncommitted changes unless intentional).

## 9. Architecture Reference

- **Layer 1** (Trae-native interface): `.trae/rules/`, `.trae/skills/`, `.trae/commands/`, `.trae/agents/`, `.trae/mcp.json`, `.trae/hooks/`
- **Layer 2** (LazyTrae runtime): `.lazytraework/config.json`, `.lazytraework/state/`, `.lazytraework/evidence/`, `.lazytraework/logs/`, `.lazytraework/schemas/`, CLI
- **Layer 3** (OmO compatibility): `.omo/plans/`, `.omo/boulder.json`, `.omo/ulw-loop/`

See `docs/lazytrae-architecture-plan.md` for the full architecture design.

## 10. Known Gaps

| Gap | Impact | Mitigation | Version |
| --- | --- | --- | --- |
| PostCompact hook | No native Trae event for post-compaction recovery | SessionStart detection + UserPromptSubmit context-pressure markers | v0.7 |
| Dynamic rule matching | Trae rules are static (session start only) | Hook-based PostToolUse extraction writes to state file | v0.7 |
| LSP daemon | No built-in LSP MCP | Optional external LSP MCP server; degrade gracefully | v0.8 |
| Codegraph | No built-in code graph | Optional external tool; degrade gracefully | v0.8 |