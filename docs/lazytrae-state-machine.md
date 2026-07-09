# LazyTrae State Machine

> **v0.5 — Runtime State Machine.** Part of the v0.x series.
> This document describes the state machine behavior of LazyTrae: how plans are parsed, how state transitions, how evidence is recorded, and how completion is enforced.

## 1. Plan Parser

### How Markdown Plans Are Parsed into Boulder State

LazyTrae reads Markdown plan files (`.omo/plans/*.md`) and extracts checklist items into boulder state tasks.

**Parser behavior:**

1. Read the plan file from `.omo/plans/<plan-name>.md`.
2. Find all top-level checkbox lines matching `- [ ]` or `- [x]`.
3. For each checkbox:
   - Extract the description text after the checkbox.
   - Assign a unique task ID.
   - Map `- [ ]` → `status: "pending"`, `- [x]` → `status: "complete"`.
4. Write the extracted tasks to `.lazytrae/state/boulder.json` under the work entry.

**Example:**

```markdown
## Deliverables

- [x] Create config file
- [ ] Create state files
- [ ] Create schemas
```

Parses to:

```json
{
  "tasks": [
    {"id": "task-1", "description": "Create config file", "status": "complete"},
    {"id": "task-2", "description": "Create state files", "status": "pending"},
    {"id": "task-3", "description": "Create schemas", "status": "pending"}
  ]
}
```

**Constraints:**
- Only top-level checkboxes are extracted (not nested lists).
- Checkbox status is inferred from the Markdown: `[ ]` = pending, `[x]` = complete.
- A task cannot be marked complete in boulder state without evidence recorded.

## 2. Boulder State Lifecycle

### State Transitions

```
pending → in_progress → complete
  ↓                      ↓
  └──────→ blocked ──────┘
             ↓
          failed
```

**Valid transitions:**

| From | To | Condition |
|------|----|-----------|
| `pending` | `in_progress` | Task is selected as next actionable item. `started_at` and `started_by` set. |
| `in_progress` | `complete` | All five evidence gates pass. `completed_at` set. `evidence_paths` populated. |
| `in_progress` | `blocked` | Blocker encountered. `blocked_reason` set. `blocker` added to blockers array. |
| `blocked` | `in_progress` | Blocker resolved. Blocker fields cleared. |
| `in_progress` | `failed` | Maximum retries exceeded. `failure_reason` set. |
| `failed` | `in_progress` | Retry requested (max 2). |

**Invalid transitions (rejected):**
- `pending` → `complete` (must go through `in_progress` with evidence)
- `complete` → `in_progress` (cannot undo completion)
- `complete` → `blocked` (a completed task cannot be blocked)
- `in_progress` → `complete` without evidence (evidence required)

### Boulder State File Structure

The boulder state is stored in `.lazytrae/state/boulder.json` with `schema_version: 2` (matching LazyCodex).

**Key fields:**
- `active_work_id`: The currently active work (or null).
- `works`: Map of work IDs to work entries.
- Each work entry contains: `active_plan`, `plan_name`, `session_ids`, `status`, `tasks`, `blockers`.

**Schema**: `.lazytrae/schemas/boulder.schema.json`

## 3. Loop State Lifecycle

### Loop Iteration Cycle

The ulw-loop runs the following cycle until completion or max iterations:

```
1. Load project memory (AGENTS.md + rules)
2. Expand user goal into completion promise
3. Run init-deep if project memory is missing
4. Generate or load plan (.omo/plans/)
5. Select next actionable task from boulder
6. Implement one bounded unit (delegated to subagent)
7. Run verifier (automated + manual-QA)
8. If verification fails, diagnose and retry or mark blocker
9. Run reviewer/Oracle
10. If review fails, re-enter active state with reviewer blockers
11. Update Librarian/memory
12. Check completion promise
13. Continue until complete, blocked, paused, or max-iteration reached
```

### Loop States

| State | Description |
|-------|-------------|
| `idle` | No loop is active. |
| `initializing` | Bootstrap phase: tier triage, goal creation, notepad open. |
| `planning` | Plan generation phase. Prometheus writes the plan. |
| `active` | Execution phase. Atlas or Hephaestus implements tasks. |
| `verifying` | Verification phase. Verifier runs gates. |
| `reviewing` | Review phase. Oracle runs quality gate. |
| `blocked` | A blocker has stopped progress. User decision needed. |
| `paused` | Loop is paused by user. |
| `complete` | All goals are complete, aggregate completion declared. |
| `cancelled` | Loop was cancelled by user. |

### Goal Statuses

From `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts`:

| Status | Description |
|--------|-------------|
| `pending` | Goal not yet started. |
| `in_progress` | Goal is currently being worked on. |
| `complete` | Goal has passed all criteria and evidence gates. |
| `failed` | Goal has failed (non-retriable or max retries exceeded). |
| `blocked` | Goal is blocked by an external issue. |
| `review_blocked` | Goal is blocked by reviewer (ITERATE/REJECT). |
| `needs_user_decision` | Goal requires an external user decision. |

### Criterion Statuses

| Status | Description |
|--------|-------------|
| `pending` | Criterion not yet proven. |
| `pass` | Evidence captured, criterion passes. |
| `fail` | Evidence captured, criterion fails. |
| `blocked` | Criterion cannot be proven due to a blocker. |

### Criterion User Models

| Model | Description |
|-------|-------------|
| `happy` | Normal happy-path usage. |
| `edge` | Boundary conditions, edge cases. |
| `regression` | Regression against previous behavior. |
| `adversarial` | Adversarial/attack scenarios. |

### Iteration Caps

From `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts`:
- **Ultrawork mode**: 500 iterations max.
- **Normal mode**: 100 iterations max.

## 4. Evidence Recording Format

### Evidence Gates

Before any step can close, it must pass five evidence gates:

| # | Gate | Evidence Type | Template |
|---|------|---------------|----------|
| 1 | Plan reread | Confirmation that plan was re-read | `.lazytrae/evidence/reviewer.md` |
| 2 | Automated verification | Commands, outputs, exit status, changed files | `.lazytrae/evidence/test-runs.md` |
| 3 | Manual-QA | Real-surface proof (HTTP, CLI, browser, data) | `.lazytrae/evidence/verifier.md` |
| 4 | Adversarial QA | Edge cases, regression, adversarial inputs | `.lazytrae/evidence/reviewer.md` |
| 5 | Cleanup | QA resources torn down, receipts recorded | `.lazytrae/evidence/reviewer.md` |

### Evidence Record Structure

Each evidence record contains:
- `gate_type`: Which gate this evidence is for.
- `commands`: List of commands executed (with descriptions).
- `outputs`: Captured output from each command.
- `exit_status`: Exit status codes.
- `changed_files`: Files changed in this step.
- `manual_checks`: Manual-QA scenario results (channel, invocation, expected, actual, verdict).
- `reviewer_findings`: Adversarial QA findings (category, finding, severity).

**Schema**: `.lazytrae/schemas/evidence.schema.json`

### Evidence is Non-Negotiable

From LazyCodex `evidence.ts`:
- Evidence must be a non-empty string.
- `recordEvidence()` requires `goalId`, `criterionId`, `status`, and `evidence`.
- `requireAllCriteriaPass()` throws if any criterion is not `pass`.
- `requireEssentialCriteriaPass()` throws if any essential criterion is not `pass`.

## 5. Completion Gates

### The 5 Conditions for Completion

Completion is **blocked** unless ALL of the following conditions are true:

1. **All tasks done**: Every task in the plan is marked `complete` (not `pending`, `in_progress`, `failed`, or `blocked`).
2. **Evidence exists**: Concrete evidence is recorded for each task in `.lazytrae/evidence/`.
3. **Verification passed**: All five evidence gates have passed, or waivers are documented.
4. **Reviewer passed**: Oracle/reviewer has issued APPROVE, or caveats are accepted.
5. **Handoff exists**: A handoff summary exists at `.lazytrae/evidence/handoff.md`.

### Completion is Invalid Without Evidence

Attempting to mark a task complete without evidence is a violation. The completion gate logic enforces:
- `task.status = "complete"` requires `task.evidence_paths.length > 0`.
- At least one evidence file must be referenced.
- Evidence files must exist on disk.

### Aggregate Completion

From LazyCodex `domain-types.ts` (UlwLoopAggregateCompletion):
```typescript
{
  status: "complete",
  completedAt: "<ISO timestamp>",
  evidence: "<path to completion evidence>"
}
```

## 6. Blocker Handling

### Recording a Blocker

When a task cannot proceed:
1. Record the blocker in the boulder state work entry's `blockers` array.
2. Set the task `status` to `blocked`.
3. Record `blocked_reason` and `blocker_signature` (for deduplication).
4. Track `blocker_occurrence_count` for repeated blockers.

### Blocker Fields

From LazyCodex `domain-types.ts` (UlwLoopItem):
- `blockedReason`: Human-readable reason for blocking.
- `blockerSignature`: Unique signature string for deduplication.
- `blockerOccurrenceCount`: How many times this same blocker has occurred.
- `requiredExternalDecision`: What external decision is required from the user.
- `nonRetriable`: Whether this blocker is permanent (cannot be retried).
- `steeringStatus`: `"blocked"` for blocked goals, `"superseded"` for superseded goals.

### Resolving a Blocker

1. User resolves the blocker (provides decision, fixes external issue).
2. Clear blocker fields: `blockedReason`, `blockerSignature`, `blockerOccurrenceCount`, `requiredExternalDecision`, `nonRetriable`, `failedAt`, `failureReason`.
3. Set task `status` back to `in_progress`.
4. Increment `attempt` counter.

## 7. Handoff Format

### Session Handoff

When handing off a session, produce a summary at `.lazytrae/evidence/handoff.md` containing:

1. **What was accomplished this session** — list of completed deliverables.
2. **Current state of the plan** — tasks completed, current task, active loop status.
3. **Evidence produced** — list of evidence file paths.
4. **Remaining gaps** — what still needs to be done.
5. **Blockers** — any current blockers with reasons.
6. **Next prompt to paste** — the exact text to paste in the next session.

### Handoff Template

See `.lazytrae/evidence/handoff.md` for the full template.

## 8. .omo Compatibility Mirror

### What Mirrors What

LazyTrae maintains a `.omo/` compatibility mirror so that LazyCodex tooling can read LazyTrae state:

| LazyCodex Path | LazyTrae Equivalent | Mirror Direction |
|----------------|---------------------|------------------|
| `.omo/plans/*.md` | `.omo/plans/*.md` | Direct read/write (same path) |
| `.omo/boulder.json` | `.lazytrae/state/boulder.json` | Mirror from primary |
| `.omo/ulw-loop/goals.json` | `.lazytrae/state/active-loop.json` (goals array) | Mirror from primary |
| `.omo/ulw-loop/brief.md` | `.omo/ulw-loop/brief.md` | Direct read/write (same path) |
| `.omo/ulw-loop/ledger.jsonl` | `.lazytrae/logs/loop-events.ndjson` | Mirror from primary |

**Design principle**: `.lazytrae/state/` is the primary source of truth. `.omo/` is a compatibility mirror for LazyCodex tooling. Write operations go to `.lazytrae/` first, then mirror to `.omo/`.

## 9. State File Locking

### Mutation Lock Pattern

Mirrors LazyCodex `plan-io.ts` `withUlwLoopMutationLock`:

```
function withUlwLoopMutationLock(repoRoot, scope, fn):
  lockKey = repoRoot + "\0" + relativePath
  wait for prior lock to resolve
  execute fn() under exclusive lock
  return result
```

**Implementation in LazyTrae:**
- File-based locking using `mkdir` as atomic operation (same as LazyCodex `session-state-lock.ts`).
- 20 retries with 5ms delay between attempts.
- Returns `SESSION_STATE_LOCK_CONTENDED` if lock cannot be acquired after 20 attempts.
- Lock is released by removing the lock directory.

### Concurrent Access Prevention

Two operations cannot mutate the same state file simultaneously:
- `writePlan()` uses atomic rename (`writeFile` to tmp + `rename` to target).
- `appendLedger()` uses `appendFile` (append-only, no conflicts).
- `withUlwLoopMutationLock()` serializes all mutations to the same scope.

## 10. Steering Mutations

### All 7 Mutation Types

From `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts`:

| # | Mutation | Description | Validation |
|---|----------|-------------|------------|
| 1 | `add_subgoal` | Add a new goal to the plan | Requires `title`, `objective` |
| 2 | `split_subgoal` | Split a goal into child goals | Requires target goal (must be `pending`), requires children with `title`/`objective` |
| 3 | `reorder_pending` | Reorder pending goals | Requires `pendingOrder` list of IDs; all IDs must exist and be `pending` |
| 4 | `revise_pending_wording` | Revise title/objective of pending goal | Requires target goal (must be `pending`), requires at least one of `revisedTitle`/`revisedObjective` |
| 5 | `revise_criterion` | Revise a success criterion | Requires target goal, `criterionId`, and at least one update field (`scenario`, `expectedEvidence`, `userModel`) |
| 6 | `annotate_ledger` | Append a note to the ledger | No structural validation (always accepted) |
| 7 | `mark_blocked_superseded` | Mark a goal as blocked/superseded | Requires target goal (any status), requires children with `title`/`objective` for superseded; if no children, goal is `blocked` |

### Steering Invariant

All steering proposals are validated against invariants:
- `structuralInvariantAccepted`: Structural validation passed.
- `evidenceBackedNecessity`: Evidence and rationale are non-empty.
- `noEasierCompletion`: Proposal does not weaken completion requirements.
- `rejectedReasons`: List of reasons for rejection (empty = accepted).

**Protected fields** (cannot be modified by steering):
- `aggregateCompletion`, `codexObjective`, `codexObjectiveAliases`, `originalConstraints`, `qualityGate`, `status`, `completedAt`, `completionStatus`.

### Steering Sources

- `user_prompt_submit`: Steering directive from user message.
- `finding`: Steering from a discovered finding (e.g., during exploration).
- `cli`: Steering from CLI command.

## 11. References

- LazyCodex domain types: `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts`
- LazyCodex constants: `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts`
- LazyCodex plan CRUD: `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts`
- LazyCodex evidence: `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts`
- LazyCodex quality gate: `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts`
- LazyCodex steering: `lazycodex/plugins/omo/components/ulw-loop/src/steering.ts`
- LazyCodex plan I/O: `lazycodex/plugins/omo/components/ulw-loop/src/plan-io.ts`
- LazyCodex session state lock: `lazycodex/plugins/omo/components/rules/src/session-state-lock.ts`
- LazyCodex start-work docs: `lazycodex/packages/web/content/docs/start-work.md`
- LazyCodex discipline agents: `lazycodex/packages/web/content/docs/discipline-agents.md`
- LazyCodex hooks lifecycle: `lazycodex/packages/web/content/docs/hooks-lifecycle.md`
- LazyTrae architecture: `docs/lazytrae-architecture-plan.md`
- LazyTrae parity ledger: `docs/lazytrae-parity-ledger.md`