# Learning guide

LazyTrae is a learning project and workflow harness for Trae IDE, Trae Work,
and Trae CLI. These pages are a source-reading route: they explain the
template-to-project copy pipeline, durable-state validation, local stdio MCP
boundary, and the separate proof needed for a host to load those assets.

LazyTrae is verified on macOS only. If you use another operating system, treat
host behavior as something to confirm locally rather than as a supported claim.

Read the implementation in this order:

1. [Package map](07-package-map.md) — locate the CLI, templates, state, packaged MCP, and host-facing assets.
2. [Security and authority](06a-security-and-authority.md) and [receipts](06b-receipts-and-owned-tooling.md) — understand the safe ownership boundary.
3. [State and validation](07a-state-and-validation.md) — trace schemas, doctor, durable plans, loop records, and evidence validation.
4. [MCP lifecycle](07b-mcp-lifecycle.md) — trace a declaration through a stdio server and distinguish it from a connected host.
5. [Test and release verification](09-test-and-release-verification.md) — see how template parity, packed-install tests, JSON-RPC tests, and manual observation contribute different evidence.

For command-by-command procedures for Trae IDE, Trae Work, and Trae CLI, see
[Host routes](reference/host-routes.md). The repository's
[setup guide](../AGENTS.md) is the operational reference, while the
[verification evidence](../lazytrae-evaluation.md) records what package tests
do and do not establish.

## The implementation loop

The CLI templates are canonical input. `init` and `sync` copy or merge those
assets into a project while preserving caller-owned content. State schemas make
durable records inspectable by `doctor`. The packaged MCP server reads and
writes through the same path and receipt boundaries. The host is the last
layer: it may discover a declaration and start the server, but that runtime
fact is deliberately not inferred from package files.
