---
name: lazy-verifier
description: "Verification gate enforcement. Runs automated tests, captures Manual-QA evidence, and exercises adversarial scenarios. Use after implementation to verify that work meets acceptance criteria. Triggers: verify, run verification, check my work, run tests, QA my work."
---

# verifier

Verification gate enforcement for LazyTrae. Runs automated verification, captures Manual-QA evidence, and exercises adversarial scenarios. This skill enforces the five evidence gates from the LazyCodex workflow.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/review-work/SKILL.md` — verification behavior: automated verification gate, Manual-QA channels, adversarial QA. Also `lazycodex/plugins/omo/components/ultrawork/directive.md` — Manual-QA channels (HTTP, tmux, browser, computer-use), failing-first proof, RED→GREEN→SURFACE→CLEAN.

## Purpose

Verify that implementation work is complete and correct before claiming done. The verifier is the gatekeeper — it runs the checks, captures the evidence, and only passes when all criteria are met with concrete proof.

## Required Context to Inspect

- The plan file with acceptance criteria and QA scenarios.
- The changed files (from git diff).
- The project's test runner and lint configuration.
- The project's build/typecheck commands.
- The evidence directory: `.lazytrae/evidence/`.
- The ledger file: `.omo/start-work/ledger.jsonl`.

## Step-by-Step Procedure

### Gate 1: Plan Reread

1. Re-read the plan file before claiming completion.
2. Confirm every checkbox is accounted for.
3. Verify every acceptance criterion is met.
4. Record the confirmation.

### Gate 2: Automated Verification

1. Run the project's test suite. All tests must pass (green).
2. Run the project's linter. Zero new errors (pre-existing warnings OK).
3. Run typecheck. Zero new errors.
4. Run build (if applicable). Build must succeed.
5. Record test output, lint results, build logs.

### Gate 3: Manual-QA

For each QA scenario in the plan:
1. Execute the scenario through the specified channel:
   - **HTTP**: `curl -i` against the live endpoint; capture status line + headers + body.
   - **Terminal**: `RunCommand` with exact command; capture exit code + stdout/stderr.
   - **Browser**: Trae Preview or browser automation; capture screenshot + action log.
   - **CLI/D**ata: Execute the exact invocation; capture the observable result.
2. Compare actual vs expected. Record PASS or FAIL.
3. Capture the evidence artifact.

Evidence must be concrete — a captured artifact, not a dry-run claim. `--dry-run`, printing the command, "should respond", and "looks correct" never count.

### Gate 4: Adversarial QA

Exercise edge cases, regression scenarios, and adversarial inputs:
1. For each applicable adversarial class, run the specific probe.
2. Adversarial classes:
   - **Malformed input**: New input parsing → test with invalid, empty, boundary, special characters.
   - **Prompt injection**: Untrusted external text → test with escape sequences, injection payloads.
   - **Cancel/resume**: Resumable flows → test cancel mid-operation, resume from checkpoint.
   - **Stale state**: Generated/cached artifacts → test with stale cache, expired data.
   - **Dirty worktree**: Uncommitted files → test with modified but unstaged files.
   - **Hung commands**: Long external commands → test timeout behavior.
   - **Flaky tests**: Timing-sensitive tests → run multiple times, check for non-determinism.
   - **Misleading output**: Log-based success → verify the actual observable, not just the log message.
   - **Repeated interruptions**: Mid-operation interrupts → test signal handling, partial writes.
3. Record each probed class with its observable result.
4. Record each skipped class with a one-line not-applicable reason.

### Gate 5: Cleanup

1. Tear down all QA resources: server PIDs, tmux sessions, browser contexts, containers, temp files.
2. Verify no QA assets are left running.
3. Record cleanup receipts.

## Allowed Edits

- Write evidence files to `.lazytrae/evidence/`.
- Append to `.omo/start-work/ledger.jsonl`.
- Run verification commands (tests, lint, typecheck, build).
- Execute curl commands, browser automation, terminal commands for Manual-QA.

## Forbidden Behavior

- Do NOT skip gates. All five must be exercised.
- Do NOT claim PASS without running the check and reading the output.
- Do NOT use `--dry-run` as completion evidence.
- Do NOT claim a test suite is green without running it.
- Do NOT skip adversarial QA classes that apply to the change.
- Do NOT leave QA resources running after verification.

## Verification Gates

The verifier itself follows the five gates:
1. **Plan reread**: All acceptance criteria verified.
2. **Automated verification**: All checks run and green.
3. **Manual-QA**: Real-surface proofs captured.
4. **Adversarial QA**: All applicable classes probed.
5. **Cleanup**: All resources torn down.

## Failure Handling

- If a test fails: record the failure, do NOT proceed to Manual-QA until fixed.
- If a Manual-QA scenario fails: record the specific discrepancy, hand back to implementer.
- If a quality gate is N/A (e.g., no security scanner configured): report `N/A` explicitly with reason.
- If the app cannot be started: that is an immediate FAIL.

## Output Format

```
VERIFICATION REPORT
===================

Plan: .omo/plans/<plan-name>.md
Overall Verdict: PASS | FAIL

Gate 1 - Plan Reread: PASS
Gate 2 - Automated Verification:
  - Tests: PASS ({N} tests, 0 failed)
  - Lint: PASS
  - Typecheck: PASS
  - Build: PASS
Gate 3 - Manual-QA:
  - Scenario 1: PASS (evidence: .lazytrae/evidence/...)
  - Scenario 2: PASS (evidence: .lazytrae/evidence/...)
Gate 4 - Adversarial QA:
  - Class 1 (malformed input): PASS
  - Class 2 (stale state): N/A - no cached artifacts
Gate 5 - Cleanup: PASS (receipts: ...)

Blocking Issues: [None] | [...]
```

## Handoff Target

After verification passes, hand off to `reviewer` for the Oracle/protocol review. If verification fails, hand back to `start-work` for fixes.