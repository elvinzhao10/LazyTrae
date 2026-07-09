# Oracle Review Evidence

> **Oracle/Reviewer Pass** — The final gate before completion claim.
> LazyCodex source: `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts` (5-section quality gate validation)

## Template

### Review Context

- **Plan file**: `.omo/plans/<plan-name>.md`
- **Reviewer**: Oracle
- **Date**: `<ISO 8601 date>`
- **Review type**: Post-implementation gate review

### Five Evidence Gates Checklist

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Plan Reread | PASS / FAIL | `<path or summary>` |
| 2 | Automated Verification | PASS / FAIL | `.lazytrae/evidence/test-runs.md` |
| 3 | Manual-QA | PASS / FAIL | `.lazytrae/evidence/verifier.md` |
| 4 | Adversarial QA | PASS / FAIL | `.lazytrae/evidence/reviewer.md` |
| 5 | Cleanup | PASS / FAIL | `<receipt path>` |

### Verdict

- **Verdict**: APPROVE / ITERATE / REJECT
- **Confidence**: HIGH / MEDIUM / LOW
- **Blockers**: `<list of blocking issues, or "None">`

### Verdict Logic

- **APPROVE**: All five gates PASS. Work is complete, correct, secure, and clean.
- **ITERATE**: Minor issues found (max 3 fixable). Specific fixes listed below. Re-submit after fixes.
- **REJECT**: Blocking issues found. Cannot proceed without major rework. Blockers listed below.

### Fixes Required (ITERATE only)

1. `<fix 1>` — `<file>`, `<line>`
2. `<fix 2>` — `<file>`, `<line>`
3. `<fix 3>` — `<file>`, `<line>`

### Blockers (REJECT only)

1. `<blocker 1>` — `<reason>`
2. `<blocker 2>` — `<reason>`

### Recommendations (APPROVE, non-blocking)

- `<suggestion 1>`
- `<suggestion 2>`

---

## Example (filled)

### Review Context

- **Plan file**: `.omo/plans/v0.5-state-machine.md`
- **Reviewer**: Oracle
- **Date**: 2026-07-09
- **Review type**: Post-implementation gate review

### Five Evidence Gates Checklist

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Plan Reread | PASS | All deliverables listed in plan/v0.5-state-machine.md have been created. |
| 2 | Automated Verification | PASS | `.lazytrae/evidence/test-runs.md` — all state files are valid JSON. |
| 3 | Manual-QA | PASS | `.lazytrae/evidence/verifier.md` — config file is valid, state files exist. |
| 4 | Adversarial QA | PASS | `.lazytrae/evidence/reviewer.md` — malformed input probe passed, 8 classes N/A. |
| 5 | Cleanup | PASS | No QA resources to tear down. No AI slop in generated files. |

### Verdict

- **Verdict**: APPROVE
- **Confidence**: HIGH
- **Blockers**: None

### Recommendations (non-blocking)

- Consider adding a `lazytrae state validate` CLI command in v0.6 to validate state files against schemas.
- Consider adding automated schema validation in a pre-commit hook.