---
name: lazy-start-work
description: "Execute a Prometheus work plan one task at a time with Boulder state, evidence ledger, and the five evidence gates. Use after planning when the user says start work, execute plan, continue plan, or resume plan. Triggers: start work, execute plan, continue plan, resume plan, start-work."
---

# start-work

Execute a Prometheus work plan until every top-level checkbox is complete. You are an ORCHESTRATOR — you delegate implementation to subagents, never implement yourself.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/start-work/SKILL.md` — Boulder state persistence, parallel subagent dispatch, five evidence gates (plan reread, automated verification, manual-QA, adversarial QA, cleanup), Sisyphus-style completion contract, Global Review and Debugging Gate.

## Purpose

Execute an approved plan one checkbox at a time, with durable state tracking, evidence recording, and verification gates. The orchestrator delegates ALL implementation work to subagents and verifies their results independently.

## Required Context to Inspect

- The approved plan file at `.omo/plans/<slug>.md`.
- The Boulder state file at `.omo/boulder.json` (if resuming).
- The project's AGENTS.md and `.trae/rules/lazytrae.md`.
- The evidence ledger at `.omo/start-work/ledger.jsonl` (if resuming).
- Recent git history and branch state.

## Step-by-Step Procedure

### Phase 1: Select the Plan

1. Read `.omo/boulder.json` if it exists.
2. List plan files under `.omo/plans/`.
3. If a plan name was provided, select the matching plan.
4. If exactly one active or paused Boulder work exists for this session, resume it.
5. If exactly one plan exists, select it.
6. If multiple plans, ask one focused selection question.
7. **No-plan bootstrap**: If no selectable plan exists, invoke `ulw-plan` to create one first.

### Phase 2: Create or Update Boulder State

Write `.omo/boulder.json` before implementation starts:

```json
{
  "schema_version": 2,
  "active_work_id": "<work-id>",
  "works": {
    "<work-id>": {
      "work_id": "<work-id>",
      "active_plan": ".omo/plans/<plan-name>.md",
      "plan_name": "<plan-name>",
      "session_ids": ["trae:<session_id>"],
      "status": "active",
      "worktree_path": null
    }
  }
}
```

### Phase 3: Execute the Next Checkbox

1. Read the full plan. Find the first unchecked top-level checkbox.
2. Classify the checkbox tier: LIGHT (narrow change inside existing layers) or HEAVY (new module, auth, external integration, DB schema, concurrency, cross-domain refactor).
3. **DELEGATE EVERYTHING.** Use Trae Subagents to dispatch implementation. NEVER implement yourself.
4. Each sub-task must include:
   - Goal and exact files/directories in scope.
   - A failing-first proof (test or Manual-QA scenario) captured RED before production changes.
   - Implementation constraints from the plan.
   - Automated verification commands.
   - One Manual-QA channel with exact tool and invocation.
   - Adversarial QA classes that apply.

### Phase 4: Verify and Record Evidence

For each checkbox, complete all five gates before marking it done:

1. **Plan reread**: Confirm the checkbox and acceptance criteria.
2. **Automated verification**: Run tests, typecheck, lint, build.
3. **Manual-QA**: Capture a real artifact from a real surface (HTTP response, terminal output, browser screenshot).
4. **Adversarial QA**: Exercise edge cases, regression scenarios, adversarial inputs.
5. **Cleanup**: Tear down QA resources (servers, tmux sessions, browser contexts, temp files).

Append evidence to `.omo/start-work/ledger.jsonl`.

### Phase 5: Mark Progress

Only after verification passes:
1. Edit the plan checkbox from `- [ ]` to `- [x]`.
2. Re-read the plan and confirm the remaining count decreased.
3. Append a `task-completed` ledger entry.
4. Continue with the next checkbox. Do NOT ask whether to continue.

### Completion

When all top-level checkboxes are complete:
1. Run the plan's final verification commands.
2. Complete the **Global Review and Debugging Gate**:
   - Invoke `review-work` with the final diff, changed files, and verification evidence.
   - Run a debugging-oriented runtime audit (at least three plausible failure hypotheses).
   - If any review lane fails, fix and rerun.
3. Remove or mark the Boulder work as completed.
4. Print an `ORCHESTRATION COMPLETE` block.

## Allowed Edits

- Write to `.omo/boulder.json`, `.omo/start-work/ledger.jsonl`.
- Edit plan file checkboxes (from `[ ]` to `[x]`).
- Create evidence files under `.lazytraework/evidence/`.
- Read project files, run verification commands.

## Forbidden Behavior

- **NO DIRECT IMPLEMENTATION BY THE ORCHESTRATOR.** Root NEVER edits product files, writes tests, or runs QA itself — a spawned subagent does.
- No `--dry-run` as completion evidence.
- No tests-only completion claim. A Manual-QA artifact is required.
- No completion claim while an applicable adversarial QA class was never probed.
- No `ORCHESTRATION COMPLETE` before the Global Review and Debugging Gate passes.
- Never batch multiple checkboxes in a single step.

## Verification Gates

1. **Plan reread**: Every checkbox accounted for, acceptance criteria met.
2. **Automated verification**: All tests green, lint clean, typecheck passes.
3. **Manual-QA**: Real-surface proof captured for each task.
4. **Adversarial QA**: Every applicable class probed with captured result.
5. **Cleanup**: All QA resources torn down, receipts recorded.

## Failure Handling

- If a subagent fails: investigate the failure, record the reason, respawn with narrowed scope.
- If verification fails: diagnose the specific failure, fix, rerun verification.
- If a blocker is hit: record it in Boulder state, pause, surface to user.
- After 2 identical failed attempts: surface what was tried and ask.

## Output Format

```
ORCHESTRATION COMPLETE

Plan: .omo/plans/<plan-name>.md
Tasks completed: {N}/{N}
Verification: PASS
Global Review Gate: PASS
Cleanup: DONE

Evidence:
  - .lazytraework/evidence/verifier.md
  - .lazytraework/evidence/reviewer.md
```

## Handoff Target

After `ORCHESTRATION COMPLETE`, the work is done. If the plan is part of a larger loop, hand off to `ulw-loop` for the next iteration. If finished, produce a handoff summary with `handoff`.