# Completion Claim

> **Completion is invalid without evidence.**

## Completion Gate Logic

Completion is **blocked** unless ALL of the following conditions are true:

1. **All tasks done**: Every task in the plan is marked `complete` (not `pending`, `in_progress`, `failed`, or `blocked`).
2. **Evidence exists**: Concrete evidence is recorded for each task in `.lazytrae/evidence/`.
3. **Verification passed**: All five evidence gates (plan reread, automated verification, manual-QA, adversarial QA, cleanup) have passed, or waivers are documented.
4. **Reviewer passed**: Oracle/reviewer has issued APPROVE, or caveats are accepted.
5. **Handoff exists**: A handoff summary exists at `.lazytrae/evidence/handoff.md`.

## Template

### Completion Claim

- **Plan file**: `.lazytrae/plans/<plan-name>.md`
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
| 2 | Automated Verification | PASS | `.lazytrae/evidence/test-runs.md` |
| 3 | Manual-QA | PASS | `.lazytrae/evidence/verifier.md` |
| 4 | Adversarial QA | PASS | `.lazytrae/evidence/reviewer.md` |
| 5 | Cleanup | PASS | — |

### Reviewer Status

- **Oracle verdict**: APPROVE / ITERATE / REJECT
- **Oracle evidence**: `.lazytrae/evidence/oracle-review.md`

### Completion Declaration

```
COMPLETION CLAIMED

Plan: .lazytrae/plans/<plan-name>.md
Tasks: <N>/<N> complete
Verification: ALL 5 GATES PASS
Reviewer: APPROVE
Handoff: .lazytrae/evidence/handoff.md

Evidence:
  - .lazytrae/evidence/test-runs.md
  - .lazytrae/evidence/verifier.md
  - .lazytrae/evidence/reviewer.md
  - .lazytrae/evidence/oracle-review.md
  - .lazytrae/evidence/handoff.md
```

---

## Example (filled)

### Completion Claim

- **Plan file**: `<plan-file>`
- **Completed at**: 2026-07-09T12:00:00Z
- **Completed by**: session-abc123

### Task Completion Status

| Task ID | Description | Status | Evidence |
|---------|-------------|--------|----------|
| task-1 | Create .lazytrae/config.json | complete | `.lazytrae/evidence/verifier.md` |
| task-2 | Create .lazytrae/state/ files | complete | `.lazytrae/evidence/test-runs.md` |
| task-3 | Create .lazytrae/evidence/ templates | complete | `.lazytrae/evidence/verifier.md` |
| task-4 | Create .lazytrae/schemas/ | complete | `.lazytrae/evidence/test-runs.md` |
| task-5 | Create canonical runtime directories | complete | `.lazytrae/evidence/verifier.md` |
| task-6 | Record state-machine evidence | complete | `.lazytrae/evidence/test-runs.md` |
| task-7 | Create .lazytrae/plans/sample-plan.md | complete | `.lazytrae/evidence/verifier.md` |
| task-8 | Update parity ledger | complete | `.lazytrae/evidence/test-runs.md` |
| task-9 | Update command index | complete | `.lazytrae/evidence/test-runs.md` |
| task-10 | Update AGENTS.md | complete | `.lazytrae/evidence/test-runs.md` |

### Evidence Gate Status

| # | Gate | Status | Evidence Path |
|---|------|--------|---------------|
| 1 | Plan Reread | PASS | — |
| 2 | Automated Verification | PASS | `.lazytrae/evidence/test-runs.md` |
| 3 | Manual-QA | PASS | `.lazytrae/evidence/verifier.md` |
| 4 | Adversarial QA | PASS | `.lazytrae/evidence/reviewer.md` |
| 5 | Cleanup | PASS | — |

### Reviewer Status

- **Oracle verdict**: APPROVE
- **Oracle evidence**: `.lazytrae/evidence/oracle-review.md`

### Completion Declaration

```
COMPLETION CLAIMED

Plan: <plan-file>
Tasks: 10/10 complete
Verification: ALL 5 GATES PASS
Reviewer: APPROVE
Handoff: .lazytrae/evidence/handoff.md

Evidence:
  - .lazytrae/evidence/test-runs.md
  - .lazytrae/evidence/verifier.md
  - .lazytrae/evidence/reviewer.md
  - .lazytrae/evidence/oracle-review.md
  - .lazytrae/evidence/handoff.md
```
