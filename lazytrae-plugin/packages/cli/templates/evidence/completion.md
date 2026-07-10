# Completion Claim

> **Completion is invalid without evidence.**
> LazyCodex source: `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` (UlwLoopAggregateCompletion)

## Completion Gate Logic

Completion is **blocked** unless ALL of the following conditions are true:

1. **All tasks done**: Every task in the plan is marked `complete` (not `pending`, `in_progress`, `failed`, or `blocked`).
2. **Evidence exists**: Concrete evidence is recorded for each task in `.lazytraework/evidence/`.
3. **Verification passed**: All five evidence gates (plan reread, automated verification, manual-QA, adversarial QA, cleanup) have passed, or waivers are documented.
4. **Reviewer passed**: Oracle/reviewer has issued APPROVE, or caveats are accepted.
5. **Handoff exists**: A handoff summary exists at `.lazytraework/evidence/handoff.md`.

## Template

### Completion Claim

- **Plan file**: `.omo/plans/<plan-name>.md`
- **Completed at**: `<ISO 8601 timestamp>`
- **Completed by**: `<session id>`

### Task Completion Status

| Task ID | Description | Status | Evidence |
|---------|-------------|--------|----------|
| `<id>` | `<description>` | complete | `<evidence path>` |
| ... | ... | ... | ... |

### Evidence Gate Status

| # | Gate | Status | Evidence Path |
|---|------|--------|---------------|
| 1 | Plan Reread | PASS | — |
| 2 | Automated Verification | PASS | `.lazytraework/evidence/test-runs.md` |
| 3 | Manual-QA | PASS | `.lazytraework/evidence/verifier.md` |
| 4 | Adversarial QA | PASS | `.lazytraework/evidence/reviewer.md` |
| 5 | Cleanup | PASS | — |

### Reviewer Status

- **Oracle verdict**: APPROVE / ITERATE / REJECT
- **Oracle evidence**: `.lazytraework/evidence/oracle-review.md`

### Completion Declaration

```
COMPLETION CLAIMED

Plan: .omo/plans/<plan-name>.md
Tasks: <N>/<N> complete
Verification: ALL 5 GATES PASS
Reviewer: APPROVE
Handoff: .lazytraework/evidence/handoff.md

Evidence:
  - .lazytraework/evidence/test-runs.md
  - .lazytraework/evidence/verifier.md
  - .lazytraework/evidence/reviewer.md
  - .lazytraework/evidence/oracle-review.md
  - .lazytraework/evidence/handoff.md
```

---

## Example (filled)

### Completion Claim

- **Plan file**: `.omo/plans/v0.5-state-machine.md`
- **Completed at**: 2026-07-09T12:00:00Z
- **Completed by**: session-abc123

### Task Completion Status

| Task ID | Description | Status | Evidence |
|---------|-------------|--------|----------|
| task-1 | Create .lazytraework/config.json | complete | `.lazytraework/evidence/verifier.md` |
| task-2 | Create .lazytraework/state/ files | complete | `.lazytraework/evidence/test-runs.md` |
| task-3 | Create .lazytraework/evidence/ templates | complete | `.lazytraework/evidence/verifier.md` |
| task-4 | Create .lazytraework/schemas/ | complete | `.lazytraework/evidence/test-runs.md` |
| task-5 | Create .omo/ compatibility mirror | complete | `.lazytraework/evidence/verifier.md` |
| task-6 | Create docs/lazytrae-state-machine.md | complete | `.lazytraework/evidence/test-runs.md` |
| task-7 | Create .omo/plans/sample-plan.md | complete | `.lazytraework/evidence/verifier.md` |
| task-8 | Update parity ledger | complete | `.lazytraework/evidence/test-runs.md` |
| task-9 | Update command index | complete | `.lazytraework/evidence/test-runs.md` |
| task-10 | Update AGENTS.md | complete | `.lazytraework/evidence/test-runs.md` |

### Evidence Gate Status

| # | Gate | Status | Evidence Path |
|---|------|--------|---------------|
| 1 | Plan Reread | PASS | — |
| 2 | Automated Verification | PASS | `.lazytraework/evidence/test-runs.md` |
| 3 | Manual-QA | PASS | `.lazytraework/evidence/verifier.md` |
| 4 | Adversarial QA | PASS | `.lazytraework/evidence/reviewer.md` |
| 5 | Cleanup | PASS | — |

### Reviewer Status

- **Oracle verdict**: APPROVE
- **Oracle evidence**: `.lazytraework/evidence/oracle-review.md`

### Completion Declaration

```
COMPLETION CLAIMED

Plan: .omo/plans/v0.5-state-machine.md
Tasks: 10/10 complete
Verification: ALL 5 GATES PASS
Reviewer: APPROVE
Handoff: .lazytraework/evidence/handoff.md

Evidence:
  - .lazytraework/evidence/test-runs.md
  - .lazytraework/evidence/verifier.md
  - .lazytraework/evidence/reviewer.md
  - .lazytraework/evidence/oracle-review.md
  - .lazytraework/evidence/handoff.md
```