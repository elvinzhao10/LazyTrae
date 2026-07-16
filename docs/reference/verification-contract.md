# Verification contract

## What the package can establish

`lazytrae load-check --host <host>` checks copied canonical assets and
declarations. `lazytrae doctor` reports installation health. `lazytrae verify`
is the strict doctor form, and `lazytrae verify --must-pass` is the completion
gate when a task requires it. `tooling capability-status --json` reports
read-only capability and local evidence status.

These checks can support a claim that package assets and local contracts are
ready. The public tests cover template parity, packaged MCP parity,
init/load-check/doctor paths, tooling lifecycle, safe uninstall, Work skill
handling, and JSON-RPC discipline.

For release evidence only, an explicit-root learner-manifest comparison may
check that LazyTrae and LazyBuddy have the same documentation paths and page
titles while allowing host-specific prose. It is not a normal-CI, runtime, or
installation dependency.

## What still needs observation

No package check proves host discovery, hook execution, a running session, or
an MCP connection. Reopen an IDE project; reload and register Work; or start a
new registered CLI session, then observe the selected host. A core MCP
declaration exposes its 15 tools only after that connection.

Nor does package readiness prove an application change works. Verify the
requested behaviour through focused automated checks and the real user surface,
then record the result. [Evidence and completion](../05-evidence-and-completion.md)
explains the five evidence gates and the evidence record.

## Completion safeguards

Hooks are local, non-blocking advisory prompts: they always exit zero. The CLI
gate is separate. `lazytrae.mark_task_done` also requires existing non-empty
evidence paths before it changes a task status. It does not itself execute
tests or establish a host connection.

This boundary keeps claims specific: say “package readiness passed,” “the host
connection was observed,” or “the feature was manually verified,” rather than
collapsing those into one assertion. See [Mental model](../01-mental-model.md)
and the repository [verification evidence](../../lazytrae-evaluation.md).

## Claim matrix

| Evidence type | Establishes | Does not establish |
| --- | --- | --- |
| Template, init, and load checks | Canonical package assets and declarations were copied and inspected. | Discovery, a running host session, or MCP connection. |
| Schema and state checks | The recorded local state matches its supported contract. | That a task outcome is correct or user-visible. |
| Packaged MCP tests | The local JSON-RPC server handles its supported protocol behavior. | That a host launched or authorized it. |
| Focused tests and manual QA | The requested behavior was checked on the named surface. | Behavior outside the test or observation scope. |
| Host-session observation | The selected Trae surface exposed the observed integration. | A claim about another host, version, or operating system. |

Use the narrowest matching sentence in a release note or completion record.
Multiple evidence forms complement each other; one never silently upgrades
into another.
