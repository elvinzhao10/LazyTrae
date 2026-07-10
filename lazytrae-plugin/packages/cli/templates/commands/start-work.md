# start-work

## Usage

`/start-work [plan-name]`

Triggers: `start-work`, `execute plan`, `continue plan`, `resume plan`, `start executing`, `continue executing`

## Inputs

- `plan-name`: Name of the plan to execute (without .md extension). If omitted, selects the only active plan or asks for selection.

## Outputs

- Boulder state file at `.omo/boulder.json`.
- Evidence ledger at `.omo/start-work/ledger.jsonl`.
- Completed checkboxes in the plan file.
- Orchestration complete report when all tasks done.

## Success Criteria

- One checkbox executed at a time.
- All five evidence gates (plan reread, automated verification, manual-QA, adversarial QA, cleanup) complete before marking checkbox done.
- All implementation delegated to subagents — orchestrator never implements directly.
- Global Review and Debugging Gate passes before completion.
- No unrecorded evidence.

## Linked Skill

[start-work](../skills/start-work/SKILL.md)

## Workflow Phase

Implement — one task at a time, delegated implementation with verification.