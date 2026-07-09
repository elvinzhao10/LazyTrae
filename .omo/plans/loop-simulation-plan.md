# Loop Simulation Plan

> Part of v0.9 — Simulate a ulw-loop run to verify loop semantics.

## Objective

Simulate a full ulw-loop run walking through all 10 loop states, with a forced verification failure on task 2, to verify the loop mechanism is auditable and correct.

## Tasks

- [x] Bootstrap: set loop state to initializing, create goals for 4 documentation tasks
- [x] Generate plan: 4 tasks create execution-loop.md, verifier-protocol.md, reviewer-protocol.md, failure-recovery.md
- [x] Task 1 (execution-loop.md): implement → verify → review → APPROVE
- [x] Task 2 (verifier-protocol.md): implement → verify → FAIL (forced) → fix → verify → review → APPROVE
- [x] Task 3 (reviewer-protocol.md): implement → verify → review → APPROVE
- [x] Task 4 (failure-recovery.md): implement → verify → review → APPROVE → complete
- [x] Write completion evidence at .lazytrae/evidence/loop-simulation.md

## Evidence

Events recorded in .lazytrae/logs/loop-events.ndjson (32 events total).
Goals recorded in .omo/ulw-loop/sample-run/goals.json (4 goals, all complete).
Ledger entries recorded in .omo/ulw-loop/sample-run/evidence.jsonl (19 entries).
Checkpoints recorded in .omo/ulw-loop/sample-run/checkpoints.jsonl (3 checkpoints).

## Verification

- [x] loop-events.ndjson contains start → failure → recovery → completion events
- [x] Task 2 has verification_failed followed by verification_passed (retry evidence)
- [x] Loop concludes with loop_completed event
- [x] goals.json has all 4 goals with status "complete"
- [x] aggregateCompletion is present in goals.json
