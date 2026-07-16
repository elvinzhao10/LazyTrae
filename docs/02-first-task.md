# Your first task

Choose one small, observable improvement in a project you can safely change.
State the result, acceptance criteria, and how you will inspect it. For
example:

> Add project search. It must work on a real project, include focused tests,
> and be exercised in the user interface before it is called done.

This gives the agent an outcome to verify instead of a vague implementation
checklist. It can choose a light workflow for a simple change or use planning
and review for work with more uncertainty or risk.

## A practical loop

1. Describe the desired outcome and the user-visible check.
2. Ask the agent to inspect the repository and make the smallest effective
   change.
3. Run the relevant focused checks.
4. Exercise the result on the real user surface: a page, CLI, API, or other
   interface the user will actually use.
5. Record the evidence and, when appropriate, run `lazytrae verify --must-pass`
   before reporting the task complete.

LazyTrae's verification gate is intentionally outside Trae hooks, because hooks
are advisory. The CLI gate and `mark_task_done` MCP tool require evidence before
completion is reported.

Before trying this loop, complete the host observation in
[install and host verification](03-install-and-host-verification.md). A package
check alone is not evidence that your selected Trae surface has loaded LazyTrae.
