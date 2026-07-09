---
name: ulw-loop
description: "Long-horizon execution loop with ultrawork mode. Decomposes work into systematic, evidence-bound steps and runs until verified completion. Use for durable goal execution, evidence-led work, manual QA, or checkpointed long-running delivery. Triggers: ulw-loop, ulw, ultrawork, durable execution, evidence-led work."
---

# ulw-loop

Long-horizon execution loop that decomposes work into systematic, evidence-bound steps and runs until verified completion. Combines the LazyCodex ulw-loop skill and ultrawork directive into a single Trae-native workflow.

## Canonical LazyCodex Source

- `lazycodex/plugins/omo/components/ulw-loop/skills/ulw-loop/SKILL.md` — loop execution with CLI state, evidence recording, delegation to subagents.
- `lazycodex/plugins/omo/components/ultrawork/skills/ultrawork/SKILL.md` — ultrawork mode directive: tier triage, Manual-QA channels, execution loop (PIN→RED→GREEN→SURFACE→CLEAN), verification gate, constraints.

## Purpose

Execute a long-horizon task with systematic decomposition, evidence-bound verification, and durable checkpointing. The loop continues until every success criterion passes with captured evidence, the reviewer approves (when triggered), and cleanup is complete.

## Required Context to Inspect

- The task brief or goal.
- AGENTS.md and `.trae/rules/lazytrae.md`.
- The loop state file: `.lazytrae/state/active-loop.json`.
- The evidence directory: `.lazytrae/evidence/`.
- The ultrawork notepad (if running): persists across turns.

## Step-by-Step Procedure

### Bootstrap (DO ALL BEFORE ANY OTHER WORK)

1. **Survey the skills and size the work** — Read the loaded skill list. Decide which skills this task will use. Name them with a one-line reason each.
2. **Tier triage** — Classify ONCE:
   - **LIGHT**: Narrow change inside existing layers. 1-2 success criteria. Self-review.
   - **HEAVY**: New module, auth, external integration, DB schema, concurrency, cross-domain refactor. 3+ success criteria. Reviewer loop until unconditional approval.
   - When unsure, take HEAVY. Upgrade if a HEAVY fact surfaces mid-task; never downgrade.
3. **Create the goal with binding success criteria** — List the user-visible deliverable, the tier with justification, and success criteria sized by tier. Each criterion names its exact scenario: the literal command/page action/payload and the binary PASS/FAIL observable.
4. **Open the durable notepad** — Create a notepad file with sections: Plan, Success criteria + QA scenarios, Now, Todo, Findings, Learnings. APPEND only, never rewrite. This notepad OUTLIVES the context window.
5. **Register todos** — Use Trae's TodoWrite to track every atomic work unit. Exactly ONE in_progress at a time. Mark completed IMMEDIATELY.

### Execution Loop (PIN → RED → GREEN → SURFACE → CLEAN)

Until every success criterion PASSES with its evidence captured:

1. **Pick next criterion** → mark in_progress → update notepad.
2. **PIN + RED**: When touching existing behavior, first pin it with a characterization test. Then capture the failing-first proof through the cheapest faithful channel. It must fail for the RIGHT reason.
3. **GREEN**: Write the SMALLEST production change that flips RED→GREEN. Re-run the proof. Capture GREEN output.
4. **SURFACE**: Run the real-surface proof the criterion named, end-to-end. Capture the artifact path.
5. **CLEANUP**: Register teardown as its own todo. Tear down every runtime artifact (server PIDs, tmux sessions, browser contexts, containers, temp files). Record a cleanup receipt.
6. **Verify**: LSP diagnostics clean on changed files + full test suite green.
7. **Mark completed**. Re-run every criterion's scenario. Loop until all PASS.

### Manual-QA Channels

Run real-surface proof through the channel that faithfully exercises the surface. Capture the artifact.

| Channel | Tool | Artifact |
|---------|------|----------|
| HTTP call | `curl -i` against live endpoint | Status line + headers + body |
| Terminal | `RunCommand` with exact command | Terminal output |
| Browser | Trae Preview or browser automation | Screenshot + action log |
| CLI | CLI command with arguments | Exit code + stdout/stderr |
| Data | DB query, config dump, file read | Diff or parsed output |

Auxiliary surfaces (CLI stdout, DB state diff, parsed config dump) are first-class evidence for CLI- or data-shaped criteria. `--dry-run` and "looks correct" never count.

### Verification Gate (TRIGGERED, NOT OPTIONAL)

Trigger when: Tier is HEAVY, or user demanded strict/rigorous/proper review.

Procedure:
1. Spawn a reviewer subagent with the goal, success criteria, scenario evidence, full diff, and notepad path.
2. Treat the reviewer's verdict as binding. Every concern is real. Do not argue.
3. Fix every issue. Re-run the FULL scenario QA. Capture fresh evidence.
4. Re-submit to the SAME reviewer. Loop until UNCONDITIONAL approval.
5. Only on unconditional approval may you declare done.

LIGHT tier: Record a self-review in the notepad instead.

## Allowed Edits

- Write to `.lazytrae/state/active-loop.json`.
- Write evidence files to `.lazytrae/evidence/`.
- Create and edit the ultrawork notepad.
- Delegate code edits to subagents.
- Run verification commands.

## Forbidden Behavior

- Never mark a step complete while a child agent owns evidence for that step.
- Never suppress lints, errors, or test failures. Never delete, skip, or comment out tests.
- Never claim done from inference — only from captured evidence.
- Never parallelize RED and GREEN of the same criterion.
- Never leave QA state (live process, tmux session, browser context, bound port, temp file) running. Tear it down, record the receipt.
- After 2 identical failed attempts at one step, surface what was tried and ask.

## Verification Gates

1. **Plan reread**: Every criterion has evidence captured.
2. **Automated verification**: Tests green, lint clean, typecheck passes.
3. **Manual-QA**: Real-surface artifact captured for every criterion.
4. **Adversarial QA**: Edge cases and regression scenarios exercised.
5. **Cleanup**: All QA resources torn down, receipts recorded.

## Failure Handling

- If a subagent fails: investigate, record the reason, respawn with narrowed scope.
- If verification fails: diagnose, fix, rerun.
- After 2 identical failed attempts: surface what was tried and ask the user.
- After 2 parallel exploration waves yield no new useful facts: stop exploring and act.

## Output Format

```
ULTRAWORK MODE ENABLED!

Plan: <1-2 paragraph summary>
Notepad: <path>

[During execution: state changes only — RED captured, GREEN captured, scenario PASS/FAIL with evidence paths]

Final:
- Outcome: <result>
- Success criteria checklist with evidence refs
- Notepad path
- Reviewer approval (if gate triggered)
- Commit list
```

## Handoff Target

After loop completion, produce a handoff summary with `handoff`. If the loop is part of a larger plan, hand off to `start-work` for the next plan phase.