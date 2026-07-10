# ulw-plan

## Usage

`/ulw-plan [user request]`

Triggers: `ulw-plan`, `plan this`, `make a plan`, `plan before coding`, `plan this request`

## Inputs

- The user's request: what they want to accomplish, any constraints, any background.
- Optional: specify path for the plan file. Default: `.omo/plans/<slug>.md`.

## Outputs

- A single decision-complete plan file with:
  - TL;DR summary, scope, and effort/risk estimates.
  - Dependency matrix.
  - Todos with task descriptions, references, acceptance criteria, QA scenarios, and commit guidance.
  - Final verification wave.
- A brief summary with next-step instruction.

## Success Criteria

- Plan is decision-complete — executor can implement with zero interview.
- Every task has: what to do, what NOT to do, references, acceptance criteria, QA scenario, commit guidance.
- Dependency matrix is consistent (no circular dependencies).
- Scope is clear: must-have and must-not-have are explicit.

## Linked Skill

[ulw-plan](../skills/ulw-plan/SKILL.md)

## Workflow Phase

Plan — exploration → decision-complete work plan.