# Learning path

Use this sequence when you are new to LazyTrae. It deliberately starts with a
small task so you can see the full loop before choosing a larger workflow.

1. Read the [mental model](01-mental-model.md). The important distinction is
   that installed files are package evidence, not proof of a live host session.
2. Pick a supported surface: Trae IDE, Trae Work, or Trae CLI. Follow the
   matching route in [install and host verification](03-install-and-host-verification.md).
3. Confirm the host-specific observation the route asks for: project reopen,
   Work reload and MCP registration, or a new CLI session.
4. Try the [first task](02-first-task.md) and verify the result where a user
   would use it.
5. For a broad, risky, or unfamiliar change, use the documented workflow:
   inspect, plan, approve, implement, and verify with evidence.

## Choose the smallest workflow

For a clear, limited change, describe the outcome and acceptance criteria in
ordinary language. For a larger change, LazyTrae provides `lazy-` skills and
commands for repository orientation, planning, execution, review, and
long-running work. The repository overview lists the common workflow commands
and their intended use in [README.md](../README.md).

Do not treat a passing package check as the final task check. Confirm the
feature on its real user surface, then use `lazytrae verify --must-pass` when
the task calls for the completion gate.
