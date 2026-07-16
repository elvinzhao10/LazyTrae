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
