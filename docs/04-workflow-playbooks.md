# Workflow playbooks

Choose the lightest workflow that makes the result trustworthy. A skill gives
the agent guidance, a slash command is a convenient entry point, an agent
definition describes a role, and hooks offer local reminders. None of them
replace acceptance criteria or evidence.

## Pick a route

| Situation | Start with | Finish with |
| --- | --- | --- |
| Small, clear change | Describe the outcome; inspect and implement directly. | Focused automated check and a real-surface check. |
| Unfamiliar repository | `lazy-init-deep` or the `lazy-librarian` skill. | A concise map of relevant files before changing them. |
| Ambiguous or multi-part work | `lazy-ulw-plan`; Prometheus plans and Metis/Momus can challenge the plan. | An executable plan with concrete checks. |
| Approved plan | `lazy-start-work`; Atlas executes one checklist item at a time. | Boulder state and evidence for each completed item. |
| Significant implementation | `lazy-review-work` / `lazy-reviewer`; Oracle reviews. | Review findings plus automated and manual QA evidence. |
| Long-running, checkpointed outcome | `lazy-ulw-loop` (or `lazy-ralph-loop` where appropriate). | A durable state, blocker, and handoff trail. |
| Debugging, refactoring, migration, or AI-cleanup | The matching `lazy-debugging`, `lazy-refactor`, `lazy-migration-planner`, or `lazy-remove-ai-slops` skill. | Behaviour-preserving checks or targeted regression evidence. |

The first-task loop in [Your first task](02-first-task.md) is the default for
a straightforward request. Do not introduce a plan merely for ceremony; do
plan when scope, dependencies, risks, or acceptance checks are unclear.

## What the installed parts are for

The package supplies 17 skills, 9 commands, and 11 role definitions. Skills
cover programming, debugging, frontend work, structural search, Git discipline,
repository orientation, planning, execution, verification, review, refactoring,
migration, session reconstruction, research, bug reporting, long-horizon work,
and cleanup. The commands expose the common routes: `lazy-init-deep`,
`lazy-ulw-plan`, `lazy-start-work`, `lazy-review-work`, `lazy-ulw-loop`,
`lazy-ralph-loop`, `lazy-handoff`, `lazy-stop-continuation`, and
`lazy-remove-ai-slops`.

The role definitions separate concerns: Explorer and Librarian gather context;
Prometheus plans; Metis and Momus examine plan risks and executability; Atlas
implements a checklist item; Oracle reviews; Sisyphus coordinates; Hephaestus
handles deep work; Cleaner targets AI-generated smells; and Migration Planner
maps a workflow to another host. These are workflow aids, not proof that a host
actually ran them. Host discovery and hook execution must be observed as
described in [Host routes](reference/host-routes.md).

## A repeatable evidence-led route

1. State the outcome, constraints, and the user-facing check.
2. Inspect local code and documentation first. Use `rg` for exact search and
   `sg` for structural search when that is the question.
3. Make the smallest change consistent with the result.
4. Run focused project-native checks, then exercise the real interface.
5. Record commands, output, changed files, manual checks, and review findings.
6. Run the completion gate when it applies; only then report completion.

For an implementation that needs an explicit plan, use the five evidence gates:
plan reread, automated verification, manual QA, adversarial QA, and cleanup.
Their record format and enforcement boundary are in
[Evidence and completion](05-evidence-and-completion.md).

## Hooks are reminders, not enforcement

Five configured events invoke eight local hook scripts: `SessionStart`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`. They always exit
zero, do not block Trae operations, and make no network calls. They can recover
context, surface rules or completion status, and prompt for evidence, but a
passing or silent hook is not a completion claim. The enforceable boundary is
the CLI completion check and the MCP task-completion tool; see
[Verification contract](reference/verification-contract.md).

Next: learn how to distinguish useful evidence from a package-only check in
[Evidence and completion](05-evidence-and-completion.md).
