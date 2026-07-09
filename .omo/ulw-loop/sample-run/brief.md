# Loop Simulation Brief — run-sample-001

> **v0.9 — Loop Simulation Brief**

## Objective

Simulate a full ulw-loop run through all 10 loop states with 4 documentation-only tasks, including a forced verification failure on task 2 to demonstrate retry behavior.

## Goals

1. G001: Create execution loop specification (docs/lazytrae-execution-loop.md)
2. G002: Create verifier protocol (docs/lazytrae-verifier-protocol.md)
3. G003: Create reviewer protocol (docs/lazytrae-reviewer-protocol.md)
4. G004: Create failure recovery doc (docs/lazytrae-failure-recovery.md)

## Success Criteria

- All 4 tasks complete with APPROVE verdict from Oracle
- Verification failure on task 2 recovered via retry
- 33 events in loop-events.ndjson
- 3 checkpoints saved
- State file validates against schema

## Outcome

Simulation complete. All tasks APPROVED, loop state: complete.
