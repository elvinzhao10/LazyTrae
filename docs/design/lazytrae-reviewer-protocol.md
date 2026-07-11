# LazyTrae Reviewer/Oracle Protocol

> **v0.9 — Long-Horizon Execution Loop.** Part of the v0.x series.
> This document specifies when review runs, the five evidence gates, verdicts (APPROVE/ITERATE/REJECT), and what happens on each verdict.

## 1. When Review Runs

Review triggers after verification passes (step 9 of the loop cycle):

| Trigger | Condition |
|---------|-----------|
| After verification pass | Loop transitions `verifying` → `reviewing`. |
| After ITERATE fix | After Oracle ITERATE, fixes are applied, verification re-passes, re-review. |
| After LIGHT self-review | LIGHT tier records self-review in notepad; no Oracle subagent needed. |
| HEAVY tier mandatory | HEAVY tier ALWAYS requires Oracle review. Can also be triggered by user demanding strict/rigorous/proper review. |

The review MUST run:
1. For ALL HEAVY tier work.
2. When user explicitly demands review ("strict", "rigorous", "proper review").
3. On aggregate completion (final checkpoint).

Review is an Oracle gate — it is triggered, not optional. HEAVY tier tasks that skip review are incomplete.

Source: historical source record Verification gate section, historical source record.

## 2. The Five Evidence Gates

Before any task can be marked complete, it must pass ALL five evidence gates:

### Gate 1: Plan Reread

- Re-read the plan before claiming completion.
- Confirm the implementation matches the specification.
- Confirm all deliverables listed in the plan are produced.
- Confirm no extra features or scope creep.
- Evidence: Confirmation statement in reviewer report.

### Gate 2: Automated Verification

- All tests green (no skipped, xfail, `.only`).
- Linter clean (zero errors, zero warnings).
- Type checker clean (zero errors).
- Build passes.
- Evidence: Test output, lint output, typecheck output, build output.

### Gate 3: Manual-QA

- Real-surface proof captured for each criterion.
- Exact commands run, exact invocations recorded.
- PASS/FAIL observable clearly documented.
- Artifacts captured (screenshots, transcripts, HTTP dumps, data diffs).
- Evidence: Manual-QA scenarios with captured artifacts at `.lazytrae/evidence/verifier.md`.

### Gate 4: Adversarial QA

- 9 adversarial classes exercised (see §5).
- Edge cases tested.
- Regression scenarios verified.
- Adversarial inputs attempted.
- Evidence: Adversarial QA findings at `.lazytrae/evidence/reviewer.md`.

### Gate 5: Cleanup

- All QA resources torn down (servers, tmux sessions, browser contexts, containers, ports, temp files).
- Cleanup receipts recorded for each resource.
- No leftover QA state.
- AI slop removed (dead code, unused imports, stale comments).
- Evidence: Cleanup receipts at `.lazytrae/evidence/reviewer.md`.

Source: historical source record, historical source record.

## 3. Reviewer Verdicts

The Oracle issues exactly one of three verdicts:

### APPROVE

**Meaning**: All five gates pass. Task is complete. No blockers.

**Conditions**:
- Plan reread: Implementation matches specification.
- Automated verification: All checks green.
- Manual-QA: Real-surface proof captured for every criterion.
- Adversarial QA: All 9 adversarial classes covered or waived.
- Cleanup: All resources torn down, receipts recorded.

**What happens**:
- If more goals remain: loop transitions `reviewing` → `active`. Next task is selected.
- If all goals are complete: loop transitions `reviewing` → `complete`. Aggregate completion written.

### ITERATE

**Meaning**: Task has fixable issues. Not blocking, but must be fixed.

**Conditions**:
- One or more gates have minor issues.
- Issues are clearly fixable (max 3 fixable issues per review).
- No structural problems, security issues, or completion-weakening defects.

**What happens**:
- Reviewer lists specific issues with file paths and fix guidance.
- Loop transitions `reviewing` → `active`.
- Agent fixes each issue.
- Verification re-runs.
- Review re-runs (with same reviewer).
- Max 3 ITERATE cycles per task. After 3, escalate to REJECT.

**ITERATE violations** (from historical source record quality gate):
- Missing or empty evidence.
- Incomplete criteria (some still `pending`).
- Linter warnings.
- Missing cleanup receipts.
- Minor code quality issues.

### REJECT

**Meaning**: Task has blocking issues. Cannot proceed without external decision.

**Conditions**:
- Structural problems (incompatible with the plan).
- Security issues.
- Completion-weakening defects (proposed change makes verification easier to pass without actually fixing).
- Missing required external authorization.
- Same blocker occurring 3+ times.
- ITERATE exhausted (max 3 cycles).
- Non-retriable failure.

**What happens**:
- Reviewer records blocker with reason, signature, and required decision.
- Loop transitions `reviewing` → `blocked`.
- User must resolve the blocker before the task can proceed.
- Resolution: user provides decision, fixes external issue, or removes/rewords the task.

## 4. Reviewer Constraints

From historical source record and LazyTrae conventions:

1. **Reviewer is read-only by default** — The Oracle agent has `disallowed: [Edit, Write]`. It reads code, runs tests, checks evidence, but does NOT modify files.
2. **Binding verdicts** — There is NO "false positive". Every concern is real. Do not argue, minimise, or explain away.
3. **Unconditional approval required** — "Looks good but..." = REJECTION. Only unconditional APPROVE qualifies.
4. **Same reviewer for re-review** — After ITERATE, re-submit to the SAME reviewer. Do not change reviewers mid-cycle.
5. **Stopping early IS failure** — Do not declare done until unconditional approval is received.
6. **No self-review for HEAVY** — HEAVY tier always requires an independent Oracle subagent. LIGHT tier self-reviews in the notepad.

Source: `directive.md` Verification gate procedure, historical source record `validateQualityGate`.

## 5. Adversarial QA: 9 Adversarial Classes

The historical source record quality gate spec defines adversarial classes that must be covered:

| # | Class | Description |
|---|-------|-------------|
| 1 | Boundary conditions | Empty inputs, max-length inputs, boundary values |
| 2 | Malformed inputs | Invalid JSON, wrong types, missing fields |
| 3 | Concurrent access | Race conditions, parallel mutations, lock contention |
| 4 | Resource exhaustion | Large payloads, many concurrent requests, memory pressure |
| 5 | State corruption | Power loss during write, partial writes, corrupted state files |
| 6 | Authentication bypass | Missing credentials, invalid tokens, expired sessions |
| 7 | Authorization bypass | Insufficient permissions, role escalation |
| 8 | Injection attacks | SQL injection, command injection, path traversal |
| 9 | Information disclosure | Error messages leaking internals, stack traces in responses |

Not all classes apply to all tasks. The reviewer documents which classes were covered and which were waived with justification.

Source: historical source record `parseAdversarialCases` (line 236-257), `criteriaCoverage.adversarialClassesCovered`.

## 6. Completion Claim

The final completion promise is verified through the quality gate:

1. Agent completes all tasks and all criteria pass.
2. Agent emits `<promise>DONE</promise>`.
3. Oracle runs the quality gate validation (`validateQualityGate`).
4. If quality gate passes: `aggregate_completion` is written with `status: "complete"`, `completed_at`, and `evidence`.
5. If quality gate fails: "Oracle verification failed. Continuing ULTRAWORK loop." — loop stays in `active` state.

The quality gate structure (from `domain-types.ts` `UlwLoopQualityGate`):
- `codeReview`: code quality review (by, recommendation: APPROVE, codeQualityStatus: CLEAR, reportPath, evidence, blockers: empty).
- `manualQa`: manual QA results (by, status: passed, evidence, surfaceEvidence, adversarialCases, artifactRefs).
- `gateReview`: gate review (by, recommendation: APPROVE, reportPath, evidence, blockers: empty).
- `iteration`: iteration results (fullRerun: true, status: passed, rerunCommands, evidence).
- `criteriaCoverage`: criteria coverage (totalCriteria, passCount, originalIntent, desiredOutcome, userOutcomeReview, adversarialClassesCovered).

## 7. References

- historical source record quality gate: historical source record
- historical source record quality gate blockers: historical source record
- historical source record ultrawork directive: historical source record
- historical source record hooks lifecycle: historical source record
- historical source record manual QA: historical source record
- LazyTrae execution loop: `docs/lazytrae-execution-loop.md`
- LazyTrae verifier protocol: `docs/lazytrae-verifier-protocol.md`
