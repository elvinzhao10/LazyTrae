---
name: lazy-start-work
description: "Execute a Prometheus work plan one task at a time with Boulder state, evidence ledger, and the five evidence gates. Use after planning when the user says start work, execute plan, continue plan, or resume plan. Triggers: start work, execute plan, continue plan, resume plan, start-work."
---

# start-work

Execute a Prometheus work plan until every top-level checkbox is complete. You are an ORCHESTRATOR — you delegate implementation to subagents, never implement yourself.


## Purpose

Execute an approved plan one checkbox at a time, with durable state tracking, evidence recording, and verification gates. The orchestrator delegates ALL implementation work to subagents and verifies their results independently.

## Required Context to Inspect

- The approved plan file at `.lazytrae/plans/<slug>.md`.
- The Boulder state file at `.lazytrae/state/boulder.json` (if resuming).
- The project's AGENTS.md and `.trae/rules/lazytrae.md`.
- The evidence ledger at `.lazytrae/logs/start-work-ledger.jsonl` (if resuming).
- Recent git history and branch state.

## Step-by-Step Procedure

### Phase 1: Select the Plan

1. Read `.lazytrae/state/boulder.json` if it exists.
2. List plan files under `.lazytrae/plans/`.
3. If a plan name was provided, select the matching plan.
4. If exactly one active or paused Boulder work exists for this session, resume it.
5. If exactly one plan exists, select it.
6. If multiple plans, ask one focused selection question.
7. **No-plan bootstrap**: If no selectable plan exists, invoke `ulw-plan` to create one first.

### Phase 2: Create or Update Boulder State

Write `.lazytrae/state/boulder.json` before implementation starts:

```json
{
  "schema_version": 2,
  "active_work_id": "<work-id>",
  "works": {
    "<work-id>": {
      "work_id": "<work-id>",
      "active_plan": ".lazytrae/plans/<plan-name>.md",
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
3. Capture `git status --short` and the state of every owned path without mutation. Store only this pre-task provenance, not file contents.
4. Convert safe plan checks to argv, validate them once, and record `commandValidation`. Reject shell operators, mutating Git/dependency commands, remote actions, and approval-gated commands.
5. **DELEGATE EVERYTHING.** Use Trae Subagents to dispatch implementation. NEVER implement yourself.
6. Dispatch the fixed execution contract plus only the task delta and artifact references: task id/revision, criterion ids, owned paths, validated command argv, RED/QA scenarios, changed constraints, and evidence destinations. Reference the plan and prior artifacts by path; do not paste the full plan, repository tour, role description, or unchanged policy.
7. Require a compact terminal report with task id, execution revision, per-criterion PASS plus artifact refs, and a real entrypoint/state transition for every runtime criterion. Recover a lost conversational result only from that complete task/revision/criterion-bound report.

### Phase 4: Verify and Record Evidence

For each checkbox, complete all five gates before marking it done:

1. **Plan reread**: Confirm the checkbox and acceptance criteria.
2. **Automated verification**: Run tests, typecheck, lint, build.
3. **Manual-QA**: Capture a real artifact from a real surface (HTTP response, terminal output, browser screenshot).
4. **Adversarial QA**: Exercise edge cases, regression scenarios, adversarial inputs.
5. **Cleanup**: Tear down QA resources (servers, tmux sessions, browser contexts, temp files).

Before verification starts, create `.lazytrae/evidence/<work-id>/<task-id>.verification.md` with the current task, full HEAD, criteria, and `status: in-progress`. Append each check as it completes. Only a complete report tied to the current revision and criteria can support a verdict or checkbox update; a subagent final message alone cannot. Use focused checks for intermediate stages and the full matrix once at task closure. After each stage, write a compact `.lazytrae/context/run-digest.md` with HEAD, green scope, blockers, fold-in IDs, and host constraints. Wait for completion events; do not actively poll or re-dispatch a worker merely because its final reply is delayed while owned paths or evidence are changing.

Before a new dispatch, check shell access, the dependency store, and any available quota/reset signal. Record a working dependency command once in the run digest; after a sandbox or store failure, stop heavy dispatch until the host is healthy. Narrow a timed-out search by path or symbol instead of repeating the same broad query. Do not start a heavy verifier within 60 minutes of a known quota reset. Keep the digest under 2,000 tokens and ship its path rather than the full plan. Read each target before writing it and re-read after another actor changes it.

Before marking a task done, compare current HEAD and dirty paths with the dispatch, reconcile plan checkboxes with Boulder task state, and confirm every fold-forward ID has a landed artifact or remains an explicit blocker. Check that the plan's owner decision gates are closed for this task; a recommendation is not approval. If a task was split, update the plan's task IDs, dependencies, owner, and baseline HEAD before further dispatch. Corrections to prior ledger events must append a machine-readable superseding event naming the old event ID; do not rewrite or silently reinterpret history.

Append evidence to `.lazytrae/logs/start-work-ledger.jsonl`.

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
   - Fix failures and rerun only lanes whose prior result is FAIL, MISSING, STALE, or whose inputs changed. Preserve unaffected PASS receipts; all five current lanes must be PASS before completion.
3. Remove or mark the Boulder work as completed.
4. Print an `ORCHESTRATION COMPLETE` block.

## Allowed Edits

- Write to `.lazytrae/state/boulder.json`, `.lazytrae/logs/start-work-ledger.jsonl`.
- Edit plan file checkboxes (from `[ ]` to `[x]`).
- Create evidence files under `.lazytrae/evidence/`.
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

## Verification tiers (v1.3.0)

Scale verification to the changed boundary and risk — never to test/file/plan
counts, agent counts, or a request merely called "complex". Select ONE tier per
changed boundary (see `src/lib/verification-tiers.js` and the shared LazySeries
contract):

- **V0 inspect** — docs, metadata, formatting, inert fixtures. Syntax/schema/static checks only when applicable; no new test by default.
- **V1 focused** — localized reversible behavior. The smallest existing test or direct user-surface scenario for the changed boundary.
- **V2 integrated** — cross-module, state, parser, migration, lifecycle, or host-routing. Focused checks plus one real consumer/integration scenario.
- **V3 comprehensive** — security/trust boundaries, release packaging, shared contract/schema changes, broad infra, or an unexplained focused failure. The comprehensive gate, once, normally in protected CI.

Rules:
- **Select once.** After choosing a tier for a boundary, run its check once. Do not rerun an already-green command against the same tree, environment, and inputs just to produce another artifact or satisfy another agent role.
- **Reuse green receipts.** A green verification receipt (tier, argv/surface, covered behavior, tree/revision, environment fingerprint, result, artifact ref) is reusable while its declared inputs and covered behavior are unchanged. Store one receipt; reference it from ledgers rather than copying output into multiple ledgers.
- **Reviewers inspect, do not rerun.** Verifier/reviewer/gate agents inspect the diff and existing evidence first; rerun only a missing, stale, contradictory, failed, or untrusted check. A code change invalidates only checks whose declared inputs or covered behavior changed.
- **A failed focused check does not cascade.** Diagnose the failure; rerun only the failed check, then any directly affected integration check. Do NOT trigger the full V2/V3 suite.
- **One comprehensive gate.** Run V3 once after the final relevant change, preferably in protected CI. Do not duplicate it locally when protected CI will run it on the exact commit.

## Failure Handling

- If a subagent fails: investigate the failure, record the reason, respawn with narrowed scope.
- If verification fails: diagnose the specific failure, fix, rerun verification.
- If a blocker is hit: record it in Boulder state, pause, surface to user.
- After 2 identical failed attempts: surface what was tried and ask.

## Output Format

```
ORCHESTRATION COMPLETE

Plan: .lazytrae/plans/<plan-name>.md
Tasks completed: {N}/{N}
Verification: PASS
Global Review Gate: PASS
Cleanup: DONE

Evidence:
  - .lazytrae/evidence/verifier.md
  - .lazytrae/evidence/reviewer.md
```

## Handoff Target

After `ORCHESTRATION COMPLETE`, the work is done. If the plan is part of a larger loop, hand off to `ulw-loop` for the next iteration. If finished, produce a handoff summary with `handoff`.
