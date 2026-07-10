# LazyTrae Execution Loop

> **v0.9 — Long-Horizon Execution Loop.** Part of the v0.x series.
> This document specifies the durable, auditable, resumable execution loop — the LazyTrae equivalent of LazyCodex ulw-loop.

## 1. Loop States

A loop is always in exactly one of 10 states:

| # | State | Description |
|---|-------|-------------|
| 1 | `idle` | No loop is active. Default state. |
| 2 | `initializing` | Bootstrap phase: tier triage, goal creation, notepad open. |
| 3 | `planning` | Plan generation phase. Prometheus writes the plan to `.omo/plans/`. |
| 4 | `active` | Execution phase. Atlas or Hephaestus implements one task at a time. |
| 5 | `verifying` | Verification phase. Verifier runs automated tests, manual-QA. |
| 6 | `reviewing` | Review phase. Oracle runs the five evidence gates. |
| 7 | `blocked` | A blocker has stopped progress. External decision needed. |
| 8 | `paused` | Loop is paused by user via `lazytrae loop pause`. |
| 9 | `complete` | All goals completed. Aggregate completion declared with evidence. |
| 10 | `cancelled` | Loop was cancelled by user via `lazytrae loop cancel`. |

State is persisted in `.lazytraework/state/active-loop.json` field `loop_state`.

## 2. State Transitions

Valid transitions between loop states:

```
                     ┌──────────┐
                     │   idle   │
                     └────┬─────┘
                          │ ulw-loop invoked
                     ┌────▼─────┐
                     │initializ.│
                     └────┬─────┘
                          │ bootstrap complete
                     ┌────▼─────┐
                     │ planning │
                     └────┬─────┘
                          │ plan approved
                     ┌────▼─────┐
              ┌──────│  active  │◄─────────────────┐
              │      └────┬─────┘                  │
              │           │ task unit done          │
              │      ┌────▼─────┐                  │
              │      │verifying │                  │
              │      └────┬─────┘                  │
              │     ┌─────┼─────┐                  │
              │  pass│     │fail │                  │
              │      │  ┌──▼──┐ │                  │
              │      │  │block│─┼──► (max 3 retries)──┐
              │  ┌───▼──┐     │                  │    │
              │  │review│     │                  │    │
              │  └──┬───┘     │                  │    │
              │ ┌───┼───┐     │                  │    │
        APPROVE│   │REJECT    │                  │    │
              │  ITERATE     │                  │    │
              │   │(max 3)   │                  │    │
              │   │    ┌─────▼──────┐           │    │
              │   └────┤  blocked   │◄──────────┘    │
              │        └─────┬──────┘                │
              │              │ user resolves          │
              │              └───────────────────────┘
              │
         ┌────▼─────┐     ┌─────────┐     ┌───────────┐
         │ complete │     │ paused  │     │ cancelled │
         └──────────┘     └─────────┘     └───────────┘
              ▲                ▲                 ▲
              │                │                 │
         all goals      lazytrae loop      lazytrae loop
         complete       pause              cancel
```

**Transition rules:**

| From | To | Condition |
|------|----|-----------|
| `idle` | `initializing` | A `ulw-loop` is invoked with a task brief. |
| `initializing` | `planning` | Bootstrap completes: tier triaged, goal created, notepad open. |
| `planning` | `active` | Plan is written and approved (Momus APPROVE for HEAVY, self-review for LIGHT). |
| `active` | `verifying` | One bounded implementation unit is complete. |
| `verifying` | `reviewing` | All verification checks pass (automated + manual-QA). |
| `verifying` | `active` | Verification failed but retry count < 3. Fix and re-implement. |
| `verifying` | `blocked` | Verification failed and retry count >= 3, or non-retriable failure. |
| `reviewing` | `active` | Oracle verdict ITERATE (fixable issues, max 3 cycles). |
| `reviewing` | `blocked` | Oracle verdict REJECT (blocking issues) or ITERATE exhausted. |
| `reviewing` | `complete` | Oracle verdict APPROVE and all goals are complete. |
| `reviewing` | `active` | Oracle verdict APPROVE but more goals remain. |
| `blocked` | `active` | Blocker resolved by user. Clear blocker fields, increment attempt. |
| `active` | `paused` | `lazytrae loop pause` invoked. |
| `paused` | `active` | `lazytrae loop resume` invoked. |
| `active` | `cancelled` | `lazytrae loop cancel` invoked. |
| `blocked` | `cancelled` | `lazytrae loop cancel` invoked. |
| `paused` | `cancelled` | `lazytrae loop cancel` invoked. |

## 3. Loop Cycle (13 Steps)

From plan/v0.9-long-horizon-loop.md, verified against LazyCodex `directive.md`:

1. **Load project memory** — Read `AGENTS.md`, `.trae/rules/`, `.lazytraework/state/active-loop.json`.
2. **Expand user goal** — Normalize goal text into a completion promise. Record in `completion_promise` field.
3. **Run init-deep** — If project memory is missing or stale, run init-deep first.
4. **Generate or load plan** — HEAVY tier: delegate to Prometheus. LIGHT tier: plan directly. Write to `.omo/plans/<slug>.md`.
5. **Select next task** — From the plan, select the first pending checklist item. Update `current_task_index`.
6. **Implement one bounded unit** — Delegate to Atlas or Hephaestus. One checklist item only.
7. **Run verifier** — Automated tests, linters, type checks, builds. Record evidence.
8. **If verification fails** — Diagnose the failure. Retry up to 3 times. If still failing, mark blocker and transition to `blocked`.
9. **Run reviewer/Oracle** — Submit to Oracle for five-evidence-gate review.
10. **If review fails** — ITERATE: fix issues, re-verify, re-review (max 3). REJECT: mark blocker, transition to `blocked`.
11. **Update Librarian/memory** — After approved task, update `AGENTS.md`, command index, parity ledger.
12. **Check completion promise** — Are all goals complete? Are all criteria passing?
13. **Continue or complete** — If more goals remain, return to step 5. If all goals complete, set `loop_state` to `complete` and write aggregate completion.

## 4. Completion Promise

The loop knows it is done through a formal completion mechanism, matching LazyCodex semantics:

- The agent emits `<promise>DONE</promise>` when it believes all work is complete.
- This does NOT end the loop. The Oracle must verify.
- The Oracle checks: all tasks complete, all criteria PASS, all evidence captured, quality gate valid.
- If Oracle APPROVEs, the loop writes `aggregate_completion` to `active-loop.json` with status `"complete"`, `completed_at` timestamp, and `evidence` path.
- If Oracle rejects: "Oracle verification failed. Continuing ULTRAWORK loop." — loop stays in `active` state.

Source: `lazycodex/packages/web/content/docs/ulw-loop.md` lines 5-6.

## 5. Iteration Caps

From `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (line 500/100) and `lazycodex/packages/web/content/docs/ulw-loop.md` (line 25):

| Mode | Max Iterations | Source |
|------|---------------|--------|
| Ultrawork (HEAVY) | 500 | `ulw-loop.md` line 25 |
| Normal (LIGHT) | 100 | `ulw-loop.md` line 25 |

An iteration is one pass through steps 5-12 of the loop cycle. If the cap is reached without completion, the loop transitions to `blocked` with reason "iteration cap reached".

## 6. Checkpointing

State is persisted after each step so the loop survives restarts:

- **NDJSON event log**: `.lazytraework/logs/loop-events.ndjson` — every state transition produces an event line.
- **JSON state**: `.lazytraework/state/active-loop.json` — full loop state, updated on every transition.
- **Checkpoints**: The `checkpoints` array in `active-loop.json` records snapshots at key points (task completion, verification pass, reviewer approval).

**Checkpoint structure:**
```json
{
  "id": "cp-001",
  "iteration": 1,
  "created_at": "2026-07-09T00:00:00Z",
  "goal_id": "G001",
  "status": "checkpointed",
  "summary": "Completed task 1 of 3. State saved.",
  "evidence_paths": [".lazytraework/evidence/test-runs.md"]
}
```

Source: checkpoint structure from `lazycodex/plugins/omo/components/ulw-loop/src/checkpoint.ts` (CheckpointUlwLoopArgs/CheckpointUlwLoopResult).

## 7. Resumption

The loop resumes after interruption by reading durable state:

1. Read `.lazytraework/state/active-loop.json` — get `loop_state`, `current_task_index`, `iteration`, `run_id`.
2. Read `.lazytraework/logs/loop-events.ndjson` — get last event to determine exact position in cycle.
3. If `loop_state` is `paused` or `active`, resume from the step after the last completed event.
4. If `loop_state` is `idle` or `cancelled`, do not resume — await user instruction.
5. If `loop_state` is `complete`, print completion summary — no further work.

The notepad (`.lazytraework/notepad.md` for the LazyTrae adaptation of the ultrawork `mktemp` notepad) provides conversation-level recovery after context compaction.

## 8. Concurrency

Mutation locks prevent concurrent loop modifications, matching LazyCodex `plan-io.ts`:

- **In-memory plan mutation lock**: `withUlwLoopMutationLock()` serializes all writes to `active-loop.json` within a process. Keyed by `repoRoot + "\0" + relativePath`. Uses promise chaining, not file-system locks.
- **File-based session lock**: `mkdir`-based atomic lock for session state. 20 retries with 5ms delay. Returns contention error after 20 failures.
- **Atomic writes**: Plan writes use `writeFile` to tmp + `rename` to target. Ledger writes use `appendFile` (append-only, no conflicts).

## 9. Steering Mutations

All 7 mutation types from `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` are supported and can be applied during the loop:

| # | Mutation | When Allowed | Description |
|---|----------|-------------|-------------|
| 1 | `add_subgoal` | Any time (except `complete`/`cancelled`) | Add a new goal with title and objective |
| 2 | `split_subgoal` | When target is `pending` | Split a pending goal into child goals |
| 3 | `reorder_pending` | When goals are `pending` | Reorder pending goals |
| 4 | `revise_pending_wording` | When target is `pending` | Revise title or objective of pending goal |
| 5 | `revise_criterion` | Any time | Revise a success criterion |
| 6 | `annotate_ledger` | Any time | Append a note to the ledger |
| 7 | `mark_blocked_superseded` | When goal is superseded or blocked | Mark a goal as blocked or superseded by children |

**Steering invariant** (from `steering.ts` `validateUlwLoopSteeringProposal`):
- Structural validation must pass.
- Evidence and rationale must be non-empty.
- Proposal must not weaken completion requirements.
- Cannot modify protected fields: `aggregateCompletion`, `codexObjective`, `codexObjectiveAliases`, `originalConstraints`, `qualityGate`, `status`, `completedAt`, `completionStatus`.

## 10. .omo Compatibility Mirror

| LazyTrae Path | .omo Mirror | Description |
|---------------|-------------|-------------|
| `.lazytraework/state/active-loop.json` | `.omo/ulw-loop/<run-id>/goals.json` | Plan with goals, criteria, statuses |
| `.lazytraework/logs/loop-events.ndjson` | `.omo/ulw-loop/<run-id>/ledger.jsonl` | Audit trail |
| `.omo/ulw-loop/<run-id>/brief.md` | `.omo/ulw-loop/<run-id>/brief.md` | Task brief (same path) |
| `.lazytraework/evidence/` | `.omo/ulw-loop/<run-id>/evidence.jsonl` | Evidence entries |

Design principle: `.lazytraework/state/` is the primary source of truth. `.omo/` is a compatibility mirror. Write to `.lazytraework/` first, mirror to `.omo/`.

## 11. Event Types

17 event types recorded in `loop-events.ndjson`:

| # | Event Type | When Emitted |
|---|------------|-------------|
| 1 | `loop_started` | Loop transitions from `idle` to `initializing` |
| 2 | `loop_resumed` | Loop transitions from `paused` to `active` |
| 3 | `task_started` | A task is selected for implementation |
| 4 | `task_completed` | A task implementation unit is complete |
| 5 | `verification_started` | Verification phase begins |
| 6 | `verification_passed` | All verification checks pass |
| 7 | `verification_failed` | Verification check fails |
| 8 | `review_started` | Review phase begins |
| 9 | `review_approved` | Oracle issues APPROVE verdict |
| 10 | `review_iterate` | Oracle issues ITERATE verdict |
| 11 | `review_rejected` | Oracle issues REJECT verdict |
| 12 | `blocker_added` | A blocker is recorded |
| 13 | `blocker_resolved` | A blocker is resolved |
| 14 | `checkpoint_saved` | A checkpoint is written |
| 15 | `loop_completed` | Loop transitions to `complete` |
| 16 | `loop_cancelled` | Loop transitions to `cancelled` |
| 17 | `loop_paused` | Loop transitions to `paused` |

Each event is a single NDJSON line: `{ "timestamp": "<ISO>", "run_id": "<id>", "event_type": "<type>", "loop_state": "<state>", "task_index": <n>, "details": "<description>" }`.

## 12. References

- LazyCodex ulw-loop docs: `lazycodex/packages/web/content/docs/ulw-loop.md`
- LazyCodex ultrawork directive: `lazycodex/plugins/omo/components/ultrawork/directive.md`
- LazyCodex domain types: `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts`
- LazyCodex constants: `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts`
- LazyCodex plan CRUD: `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts`
- LazyCodex plan I/O: `lazycodex/plugins/omo/components/ulw-loop/src/plan-io.ts`
- LazyCodex evidence: `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts`
- LazyCodex quality gate: `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts`
- LazyCodex steering: `lazycodex/plugins/omo/components/ulw-loop/src/steering.ts`
- LazyCodex checkpoint: `lazycodex/plugins/omo/components/ulw-loop/src/checkpoint.ts`
- LazyTrae state machine: `docs/lazytrae-state-machine.md`
