# LazyTrae v0.13 — Dogfood Run Report

> **Version**: v0.13 diagnostics and fixes
> **Plan**: `.workflow/plans/lazytrae-v0-13-diagnosis.md`
> **Dogfood fixture**: `/var/folders/m6/mmqh7djx5z94rjrtfqdshftw0000gp/T/lazytrae-task-6-0pYk3K`

## Objective

Run LazyTrae against itself with a real three-subtask workflow, prove completion is blocked without evidence, repair the failure, exercise MCP and hook surfaces, and produce a handoff only after `verify --must-pass` passes.

## Subtasks

| Task | Description | Completion surface | Evidence |
| --- | --- | --- | --- |
| dogfood-1 | Seed three-task work item and prove missing evidence blocks completion | `lazytrae verify --must-pass` | `.lazytrae/evidence/dogfood-task-1.md` |
| dogfood-2 | Use MCP `mark_task_done` with artifact-backed evidence | JSON-RPC `lazytrae.mark_task_done` | `.lazytrae/evidence/dogfood-task-2.md` |
| dogfood-3 | Run final verifier and handoff after all task evidence exists | `lazytrae verify --must-pass`, `lazytrae handoff` | `.lazytrae/evidence/dogfood-task-3.md`, `.lazytrae/evidence/dogfood-manual-qa.md` |

## CLI Output

Initial verification failed because task 1 pointed at a missing evidence file:

```text
$ node packages/cli/src/index.js verify --must-pass
exit=1
LazyTrae Doctor v0.11.0
Repo root: /private/var/folders/.../lazytrae-task-6-0pYk3K
...
```

After restoring task 1 evidence, verification still failed because task 2 and task 3 were unfinished:

```text
$ node packages/cli/src/index.js verify --must-pass
exit=1
LazyTrae Doctor v0.11.0
Repo root: /private/var/folders/.../lazytrae-task-6-0pYk3K
...
```

After MCP closed task 2 and task 3 with evidence, the completion gate became ready:

```text
$ node packages/cli/src/index.js completion-status
exit=0
ready
Completion gates satisfied.
```

Final verification ran before handoff:

```text
$ node packages/cli/src/index.js verify --must-pass
exit=0
LazyTrae Doctor v0.11.0
Repo root: /private/var/folders/.../lazytrae-task-6-0pYk3K
...
```

The final handoff was generated only after the verifier passed:

```text
$ node packages/cli/src/index.js handoff
exit=0
# Session Handoff

## What Was Accomplished

- Seed three-task work item and prove missing evidence blocks completion (dogfood-1)
- Use MCP mark_task_done with artifact-backed evidence (dogfood-2)
- Run final verifier and handoff after all task evidence exists (dogfood-3)

## Completion Gate

ready
Completion gates satisfied.
```

## MCP Output

Task 2 was completed through the MCP JSON-RPC server:

```text
$ node packages/cli/test/json-rpc-call.js --cwd <fixture> --method lazytrae.mark_task_done --arguments '{...}'
exit=0
{
  "marked_complete": true,
  "work_id": "dogfood-work",
  "task_id": "dogfood-2",
  "task_index": 1,
  "evidence_paths": [".lazytrae/evidence/dogfood-task-2.md"]
}
```

Task 3 used two evidence files, including the manual-QA artifact:

```text
$ node packages/cli/test/json-rpc-call.js --cwd <fixture> --method lazytrae.mark_task_done --arguments '{...}'
exit=0
{
  "marked_complete": true,
  "work_id": "dogfood-work",
  "task_id": "dogfood-3",
  "task_index": 2,
  "evidence_paths": [
    ".lazytrae/evidence/dogfood-task-3.md",
    ".lazytrae/evidence/dogfood-manual-qa.md"
  ]
}
```

The v0.13 context tooling was also exercised through MCP:

```text
$ node packages/cli/test/json-rpc-call.js --cwd <fixture> --method lazytrae.symbol_search --arguments '{...}'
exit=0
{
  "provenance": "heuristic",
  "query": "completion",
  "results": [
    { "file": ".lazytrae/config.json", "line": 33 },
    { "file": ".lazytrae/evidence/completion.md", "line": 1 }
  ]
}
```

## State Diff

The dogfood fixture started with this active work item:

```json
{
  "active_work_id": "dogfood-work",
  "tasks": [
    { "id": "dogfood-1", "status": "complete", "evidence_paths": [".lazytrae/evidence/dogfood-task-1.md"] },
    { "id": "dogfood-2", "status": "in_progress", "evidence_paths": [] },
    { "id": "dogfood-3", "status": "pending", "evidence_paths": [] }
  ]
}
```

After repair and MCP completion, all three tasks were complete with non-empty evidence paths. Deleting `.lazytrae/evidence/dogfood-task-2.md` inside the fixture changed the completion status back to blocked:

```text
$ node packages/cli/src/index.js completion-status
exit=1
blocked
- [boulder_task_evidence] Boulder task dogfood-2: evidence missing: .lazytrae/evidence/dogfood-task-2.md
Next command: lazytrae verify --must-pass
```

## Hook Output

SessionStart was executed against the fixture:

```text
$ bash .trae/hooks/session-start.sh
exit=0
[LazyTrae v0.7] Session started.

Active plan: lazytrae-v0-13-diagnosis
Current task: (none)
Blockers:
Next action:  (none)
Loop goal:    (none) (iteration 0)
```

Hook syntax was also covered by `doctor`, which reported all 8 scripts executable and `bash -n` clean for each hook script.

## Repair Cycle

| Step | Result |
| --- | --- |
| Missing task-1 evidence | `verify --must-pass` blocked completion |
| Restored task-1 evidence | `verify --must-pass` still blocked unfinished task 2 and task 3 |
| Closed task 2 through MCP | JSON-RPC accepted only after `.lazytrae/evidence/dogfood-task-2.md` existed |
| Closed task 3 through MCP | JSON-RPC accepted final evidence plus manual-QA artifact |
| Ran final verify | `verify --must-pass` exited 0 |
| Ran handoff | Handoff generated with ready completion gate |
| Deleted task-2 evidence in fixture | `completion-status` and `verify --must-pass` blocked again |

## Reviewer Blocker and Resolution

The v0.13 review loop produced a real blocker during T4:

| Blocker | Evidence | Resolution |
| --- | --- | --- |
| `lazytrae.dependency_graph` allowed `..` path traversal outside the repo | `.workflow/evidence/lazytrae-v0-13-t4-context-tooling-mcp-code-review.md` | Added `safeProjectPath` boundary enforcement and an adversarial test for `../../.codex/skills/.system/openai-docs/SKILL.md`; final rereview passed in `.workflow/evidence/lazytrae-v0-13-t4-context-tooling-mcp-final-rereview-code-review.md` |

## Final Status

PASS. The dogfood run exercised LazyTrae through CLI, MCP, state, hook, failure, repair, manual-QA, and handoff surfaces. Runtime completion remained blocked until evidence existed, and the final handoff was produced only after `verify --must-pass` exited 0.
