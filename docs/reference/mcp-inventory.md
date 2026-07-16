# MCP inventory

The base `.trae/mcp.json` is an installation declaration. It becomes usable
only after the relevant Trae host starts and connects the core server.

## Base declarations

There are eight declarations: the executable `lazytrae` core server plus seven
disabled placeholders: `grep_app`, `context7`, `filesystem`, `git`,
`playwright`, `ast_grep`, and `lsp`. The disabled entries have no default
executable command. Supported optional persistent selections use explicit
`lazytrae tooling enable <capability>` commands and create managed namespaced
servers; they are not enabled by installation, doctor, or automatic routing.

## Core tool inventory

After a host connection, the core exposes 15 tools: active-plan, Boulder
status, next-task, evidence recording, task completion, blocker, review,
handoff, parity, symbol search, reference search, definition lookup,
diagnostics, documentation lookup, and dependency graph. These are local
state/evidence/context tools; their presence does not prove an external
provider is enabled.

Read [MCP lifecycle](../07b-mcp-lifecycle.md) for the order of operations.

## Tool groups and handler boundary

The core's 15 tools are intentionally grouped by local responsibility:

| Group | Tools | Handler/data boundary |
| --- | --- | --- |
| Plan/state reads | active plan, Boulder status, next task, parity status | Reads `.lazytrae` state through `state-access.js`; absence is local state information, not host failure. |
| Evidence/state writes | record evidence, mark task done, add blocker, request review | Uses runtime path boundary, atomic writes, and evidence checks before changing local state. |
| Workflow output | generate handoff | Produces a project-local handoff from existing state/evidence. |
| Local context | symbol search, find references, goto definition, diagnostics, docs lookup, dependency graph | Heuristic/local context helpers; availability does not imply an external provider is enabled. |

`packages/mcp/src/index.js` owns protocol dispatch. `tools.js` maps a namespaced tool name to a split handler module. `state-access.js` derives the repository root and constrains writes to `.lazytrae`; its runtime safe-write layer writes a temporary sibling then atomically renames where permitted. The CLI's `mcp` command launches this packaged implementation, so the server does not require a source checkout after installation.

## Disabled placeholders versus managed optional entries

The seven disabled base entries are declarations without a default executable command. They show possible integration categories, not bundled servers. An explicit `tooling enable <capability>` can create only a LazyTrae-managed, namespaced optional entry in an initialized project. It does not configure a provider account, insert credentials, or prove that the Trae host connected it.
