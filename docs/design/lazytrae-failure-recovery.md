# LazyTrae Failure and Recovery

> **v0.9 — Long-Horizon Execution Loop.** Part of the v0.x series.
> This document specifies how blockers are handled, how the loop recovers from interruption, how retries work, and how to cancel, pause, or roll back.

## 1. Blocker Handling

### Recording a Blocker

When a task cannot proceed (verification fails 3+ times, Oracle REJECT, or external dependency):

1. Record in `active-loop.json` under the goal's blocker fields:
   - `blocked_reason`: Human-readable reason.
   - `blocker_signature`: Unique signature for deduplication.
   - `blocker_occurrence_count`: How many times this blocker has occurred.
   - `required_external_decision`: What decision the user needs to make.
   - `non_retriable`: Whether this blocker is permanent.

2. Record in boulder state under the work entry's `blockers` array.

3. Emit a `blocker_added` event in `loop-events.ndjson`.

4. Transition loop state to `blocked`.

Source: `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` (UlwLoopItem blocker fields), `lazycodex/plugins/omo/components/ulw-loop/src/checkpoint.ts` (applyBlockedOrFailed lines 94-118).

### Blocker Classification

From `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate-blockers.ts`:

External authorization blockers are classified by `classifyExternalAuthorizationBlocker(evidence)`:
- If the evidence string matches a known external auth pattern, a signature is generated.
- Same blocker signature across goals increments `blocker_occurrence_count`.
- After 3 occurrences of the same signature, goal status changes to `needs_user_decision` and `non_retriable` is set to `true`.

### Resolving a Blocker

1. User resolves the blocker (provides decision, fixes external issue, or gives new direction).
2. Call `clearGoalBlockerFields(goal)` to clear: `blockedReason`, `blockerSignature`, `blockerOccurrenceCount`, `requiredExternalDecision`, `nonRetriable`, `failedAt`, `failureReason`.
3. Set goal `status` back to `pending` or `in_progress`.
4. Increment `attempt` counter.
5. Emit `blocker_resolved` event.
6. Transition loop state to `active`.

Source: `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts` `clearGoalBlockerFields` (lines 45-56).

## 2. Max Retries

From LazyCodex `plan-crud.ts` `startNextUlwLoop` and `checkpoint.ts`:

| Scope | Max Retries | Behavior When Exceeded |
|-------|------------|------------------------|
| Verification failure per task | 3 | Task marked `blocked`, loop → `blocked` |
| Oracle ITERATE per task | 3 | Escalated to REJECT, loop → `blocked` |
| Goal attempt (retryFailed) | unlimited* | User must explicitly pass `--retry-failed` |
| Identical blocker occurrences | 3 | Goal → `needs_user_decision`, `non_retriable = true` |

*Attempt count increments but is not capped. Failed goals require explicit user action to retry.

From `directive.md` Stop rules: "After 2 identical failed attempts at one step, surface what was tried and ask the user before another retry."

## 3. Session Interruption

### Crash/Disconnect Recovery

When a session crashes or disconnects:

1. **Durable state survives** — All state is in `.lazytrae/state/` and `.lazytrae/logs/`, not in conversation memory.
2. **Recovery procedure**:
   a. Read `.lazytrae/state/active-loop.json` — get `loop_state`, `run_id`, `current_task_index`, `iteration`.
   b. Read `.lazytrae/logs/loop-events.ndjson` — get the last event to determine the exact position in the cycle.
   c. Read the notepad — get current `## Now`, `## Todo`, and `## Findings` sections.
   d. Determine next action based on `loop_state`:
      - `idle`/`cancelled`: Await user instruction.
      - `paused`: Ask user whether to resume.
      - `active`: Resume from the step after the last completed event.
      - `verifying`: Re-run verification for the current task.
      - `reviewing`: Re-submit to Oracle.
      - `blocked`: Report blocker to user.
      - `complete`: Print completion summary.
   e. Re-read `AGENTS.md` and rules before resuming.

### Context Compaction Recovery

Trae may compact context (equivalent to LazyCodex PostCompact). When this happens:

1. The `SessionStart` hook detects compaction via `sessions.json` `compaction_state` field.
2. After compaction, STOP and re-read the whole notepad FIRST before any action.
3. Recover state from the notepad and `.lazytrae/state/` — do not re-plan from scratch.
4. Resume from `## Now` in the notepad.

Source: `directive.md` notepad recovery section (line 154-160), LazyCodex PostCompact gap documented in `AGENTS.md`.

## 4. Loop Cancellation and Pausing

### Pause (`lazytrae loop pause`)

1. Set `loop_state` to `paused` in `active-loop.json`.
2. Emit `loop_paused` event in `loop-events.ndjson`.
3. Save checkpoint of current progress.
4. Loop is suspended. No further task execution until resume.
5. Can only pause from `active`, `verifying`, or `blocked` states.

### Resume (`lazytrae loop resume`)

1. Verify `loop_state` is `paused`.
2. Set `loop_state` to `active` in `active-loop.json`.
3. Emit `loop_resumed` event in `loop-events.ndjson`.
4. Read notepad to regain context.
5. Continue from the step after the last completed event.

### Cancel (`lazytrae loop cancel`)

1. Set `loop_state` to `cancelled` in `active-loop.json`.
2. Emit `loop_cancelled` event in `loop-events.ndjson`.
3. Save final checkpoint.
4. Write cancellation timestamp: `cancelled_at` in `active-loop.json`.
5. Loop is terminated. Cannot be resumed — must start a new loop with a new `run_id`.
6. Can cancel from `active`, `verifying`, `reviewing`, `blocked`, or `paused` states.
7. Cannot cancel from `complete` or `cancelled` states (no-op).

## 5. Emergency Rollback

### Rollback to Previous Checkpoint

If the current task has gone wrong and cannot be salvaged:

1. Read `checkpoints` array from `active-loop.json`.
2. Identify the last checkpoint before the current task.
3. Restore the loop state to that checkpoint:
   - Reset `loop_state` to the state at checkpoint time.
   - Reset `current_task_index` to the checkpoint's task.
   - Revert any file changes since the checkpoint (using git).
   - Clear evidence files produced since the checkpoint.
4. Record rollback in the ledger as an `annotate_ledger` event.
5. Resume from the checkpoint.

### Audit Trail

The NDJSON event log provides a complete audit trail for recovery:

- Every state transition is recorded.
- Every event has a timestamp, run_id, and loop_state.
- Events can be replayed to reconstruct the exact sequence of operations.
- The log is append-only — no events are ever deleted.

```json
{"timestamp":"2026-07-09T00:00:01Z","run_id":"run-001","event_type":"loop_started","loop_state":"initializing","task_index":0,"details":"Loop started with objective: Implement v0.9"}
{"timestamp":"2026-07-09T00:00:05Z","run_id":"run-001","event_type":"task_started","loop_state":"active","task_index":1,"details":"Task 1: Create execution loop spec"}
```

## 6. References

- LazyCodex checkpoint: `lazycodex/plugins/omo/components/ulw-loop/src/checkpoint.ts`
- LazyCodex plan CRUD: `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts`
- LazyCodex quality gate blockers: `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate-blockers.ts`
- LazyCodex ultrawork directive: `lazycodex/plugins/omo/components/ultrawork/directive.md`
- LazyTrae execution loop: `docs/lazytrae-execution-loop.md`
- LazyTrae verifier protocol: `docs/lazytrae-verifier-protocol.md`
- LazyTrae reviewer protocol: `docs/lazytrae-reviewer-protocol.md`
