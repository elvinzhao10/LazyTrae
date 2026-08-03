---
description: Review implementation evidence and report concrete blocking findings.
argument-hint: "[branch or diff range]"
---

# review-work

## Usage

`/lazy-review-work [branch or diff range]`

Triggers: `review-work`, `review my work`, `review changes`, `post-implementation review`, `QA my work`, `check my work`

## Inputs

- `branch or diff range`: The range to review (e.g., `feature-branch`, `HEAD~1..HEAD`). If omitted, reviews all uncommitted or unstaged changes.

## Outputs

- Review report at `.lazytrae/evidence/reviewer.md` with:
  - Overall verdict (PASSED/FAILED/INCONCLUSIVE).
  - Verdict per review lane.
  - Blocking issues with specific locations.
  - Key findings and recommendations.

## Success Criteria

- All five review lanes executed (Goal Verification, QA Execution, Code Quality, Security, Context Mining).
- Every finding is specific: file, line, problem, fix.
- No vague language or general advice.
- All findings from parallel reviewers are deduplicated and prioritized.

## Linked Skill

[lazy-reviewer](../skills/lazy-reviewer/SKILL.md) + [lazy-verifier](../skills/lazy-verifier/SKILL.md)

## Workflow Phase

Verify — multi-angle parallel review after implementation.
