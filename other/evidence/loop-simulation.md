# Loop Simulation Results

> **v0.9 — Loop Simulation.** Evidence from a fully simulated ulw-loop run.

## Simulation Overview

**Goal**: Simulate a full ulw-loop run through all 10 loop states.
**Tasks**: 4 documentation-only tasks.
**Forced Failure**: Verification failure on task 2 (missing cleanup section).
**Outcome**: All 4 tasks completed, verified, and reviewed. Loop completed successfully.

## State Walkthrough

| Step | Loop State | Action |
|------|-----------|--------|
| 1 | `idle` → `initializing` | Loop started with objective |
| 2 | `initializing` → `planning` | Bootstrap complete, 4 goals created |
| 3 | `planning` → `active` | Plan approved, task 1 selected |
| 4 | `active` → `verifying` | Task 1 implementation complete |
| 5 | `verifying` → `reviewing` | Task 1 verification passed |
| 6 | `reviewing` → `active` | Task 1 APPROVED by Oracle |
| 7 | `active` → `verifying` | Task 2 implementation complete |
| 8 | `verifying` (stays) | Task 2 verification FAILED (retry 1/3) |
| 9 | `verifying` → `active` | Task 2 fix applied |
| 10 | `active` → `verifying` | Task 2 re-verification (retry 2) |
| 11 | `verifying` → `reviewing` | Task 2 verification PASSED after fix |
| 12 | `reviewing` → `active` | Task 2 APPROVED by Oracle |
| 13-17 | `active` → `verifying` → `reviewing` (×2) | Tasks 3, 4 pass verification and review |
| 18 | `reviewing` → `complete` | All tasks complete, loop completed |

## Verification Failure Evidence

Task 2 (`verifier-protocol.md`) experienced a verification failure:
- **Failure**: Missing cleanup section references in the verifier document.
- **Retry 1**: Diagnose, fix (add cleanup section with resource teardown protocol), re-verify.
- **Retry 2**: Verification passed.
- **Event**: `verification_failed` → `task_completed` (fix) → `verification_started` → `verification_passed`.

This proves the loop correctly handles verification failure with retry.

## Evidence Files

| File | Contents |
|------|----------|
| `.lazytrae/logs/loop-events.ndjson` | 33 events across the full simulation |
| `.omo/ulw-loop/sample-run/goals.json` | 4 goals, all complete with criteria passed |
| `.omo/ulw-loop/sample-run/evidence.jsonl` | 19 ledger entries |
| `.omo/ulw-loop/sample-run/checkpoints.jsonl` | 3 checkpoints |
| `.lazytrae/state/active-loop.json` | Current state: idle (post-simulation) |

## Automated Verification

- `node packages/cli/src/index.js loop status` — works, shows loop state
- `node packages/cli/src/index.js loop log -n 5` — works, shows last 5 events
- `node packages/cli/src/index.js doctor` — all checks pass
- `.lazytrae/state/active-loop.json` validates against updated schema

## Completion Status

Simulation complete. All loop semantics verified: state transitions, retry behavior, evidence recording, checkpointing, completion gate.
