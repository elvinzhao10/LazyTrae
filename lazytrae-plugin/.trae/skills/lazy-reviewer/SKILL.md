---
name: lazy-reviewer
description: "Post-implementation reviewer/Oracle protocol. Launches parallel review sub-agents covering goal verification, code quality, security, QA execution, and context mining. All must pass for review to pass. Use after completing significant implementation work. Triggers: review work, review my work, review changes, QA my work, verify implementation, check my work, validate changes, post-implementation review."
---

# reviewer

Post-implementation review orchestrator. Launches multiple parallel review sub-agents covering complementary concerns. Together they form a comprehensive review that no single reviewer could match. All must pass for the review to pass.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/review-work/SKILL.md` — 5-agent parallel review orchestrator: Goal & Constraint Verification (Oracle), QA Execution (hands-on), Code Quality Review (Oracle), Security Review (Oracle), Context Mining (investigative). All must pass for review to pass.

## Purpose

Provide a comprehensive, multi-angle review of completed implementation work. The reviewer is the gatekeeper that ensures the work is complete, correct, secure, well-written, and context-aware before claiming done.

## Required Context to Inspect

- The original goal (what the user was trying to achieve).
- Constraints and requirements discussed.
- Background and business context.
- Changed files (from `git diff --name-only`).
- Full diff (from `git diff`).
- Full file contents of changed files.
- How to run/start the application.
- Plan file with acceptance criteria.
- Verification evidence from the verifier.

## Step-by-Step Procedure

### Phase 0: Gather Review Context

Collect all required inputs:
1. **GOAL**: The original objective. Pull from the initial request.
2. **CONSTRAINTS**: Rules, requirements, limitations, tech stack restrictions.
3. **BACKGROUND**: Why this work was needed. Business context, user stories.
4. **CHANGED_FILES**: `git diff --name-only` against the appropriate base.
5. **DIFF**: `git diff` against the appropriate base.
6. **FILE_CONTENTS**: Full content of each changed file.
7. **RUN_COMMAND**: How to start/run the application.
8. **VERIFICATION_EVIDENCE**: Evidence from the verifier (test results, Manual-QA artifacts).

### Phase 1: Launch Review Agents

Launch ALL review agents in parallel. Each covers a complementary concern:

| # | Agent | Focus | Key Questions |
|---|-------|-------|---------------|
| 1 | Goal & Constraint Verification | Did we build what was asked? | Goal completeness, constraint compliance, requirement gaps, over-engineering, edge cases, behavioral correctness |
| 2 | QA Execution | Does it actually work? | Happy paths, boundary conditions, error paths, regression scenarios, state transitions, integration points |
| 3 | Code Quality Review | Is the code well-written? | Correctness, pattern consistency, naming, error handling, type safety, performance, abstraction, testing, API design, tech debt |
| 4 | Security Review | Is it secure? | Input validation, auth/authz, secrets, data exposure, dependencies, cryptography, file/path, network, error leakage, supply chain |
| 5 | Context Mining | Did we miss any context? | Git history, related issues/PRs, codebase cross-references, design docs, past decisions |

### Phase 2: Wait & Collect

Wait for all review agents to complete. Track each agent's verdict independently:

| Agent | Verdict | Notes |
|-------|---------|-------|
| 1. Goal Verification | pending/PASS/FAIL/INCONCLUSIVE | - |
| 2. QA Execution | pending/PASS/FAIL/INCONCLUSIVE | - |
| 3. Code Quality | pending/PASS/FAIL/INCONCLUSIVE | - |
| 4. Security | pending/PASS/FAIL/INCONCLUSIVE | - |
| 5. Context Mining | pending/PASS/FAIL/INCONCLUSIVE | - |

### Phase 3: Deliver Verdict

**Verdict logic:**
- ALL agents returned PASS → **REVIEW PASSED**
- ANY agent returned FAIL → **REVIEW FAILED**
- ANY lane is INCONCLUSIVE and none failed → **REVIEW INCONCLUSIVE**

## Allowed Edits

- Read files, run commands, search codebase.
- Collect diffs, file contents, and evidence.
- Write review evidence to `.lazytrae/evidence/reviewer.md`.
- On FAIL: specify exactly what to fix and in what order.

## Forbidden Behavior

- Do NOT claim a lane as PASS without reading its output.
- Do NOT treat a timeout, missing deliverable, or ack-only response as PASS.
- Do NOT mark a lane as PASS when it returned INCONCLUSIVE.
- Do NOT skip any review lane. All five must be exercised.
- Do NOT include raw tokens, credentials, auth headers, or PII in review evidence.

## Verification Gates

1. **Plan reread**: All review lanes completed, all criteria addressed.
2. **Automated verification**: Review evidence is concrete and verifiable.
3. **Manual-QA**: Review findings are actionable and specific.
4. **Adversarial QA**: Review considers edge cases and regression scenarios.
5. **Cleanup**: Review evidence is redacted of secrets, well-structured.

## Failure Handling

- If a lane is INCONCLUSIVE: respawn a smaller reviewer for that exact lane. If still inconclusive, name the lane as INCONCLUSIVE in the final report.
- If review fails: be specific. State the problem, the file, and the fix. Do not use vague language.
- If a security vulnerability is found: this is a blocking issue regardless of other lanes.

## Output Format

```markdown
# Review Work - Final Report

## Overall Verdict: PASSED / FAILED / INCONCLUSIVE

| # | Review Area | Verdict | Confidence |
|---|------------|---------|------------|
| 1 | Goal & Constraint Verification | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 2 | QA Execution | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 3 | Code Quality | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |
| 4 | Security (supplementary) | PASS/FAIL/INCONCLUSIVE | Severity |
| 5 | Context Mining | PASS/FAIL/INCONCLUSIVE | HIGH/MED/LOW |

## Blocking Issues
[Aggregated from all agents - deduplicated, prioritized]

## Key Findings
[Top 5-10 most important findings across all agents]

## Recommendations
[If FAILED: exactly what to fix, in priority order]
[If PASSED: non-blocking suggestions worth considering]
```

## Handoff Target

If PASSED, hand off to `remove-ai-slops` for cleanup, then produce a handoff summary with `handoff`. If FAILED, hand back to `start-work` with specific fixes.