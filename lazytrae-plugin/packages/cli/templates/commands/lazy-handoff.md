---
description: Produce a factual resumable handoff from current LazyTrae state.
argument-hint: ""
---

# handoff

## Usage

`/lazy-handoff`

Triggers: `handoff`, `finish session`, `complete work`, `produce summary`

## Inputs

None — reads the current session state automatically.

## Outputs

- Handoff summary at `.lazytrae/evidence/handoff.md` with:
  - What was accomplished this session.
  - Current state of the plan (done, blocked, next).
  - Evidence produced.
  - Remaining gaps.
  - Next prompt to paste when resuming.

## Success Criteria

- Summary is concise and factual.
- Blockers are documented with reason and what was attempted.
- Next prompt is concrete — user can paste it directly to resume.
- All completed tasks are marked done.

## Linked Skill

(Reads current session state, uses existing plan context)

## Workflow Phase

Handoff — session completion and state handoff.
