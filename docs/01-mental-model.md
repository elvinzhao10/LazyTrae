# Mental model

LazyTrae has three layers:

| Layer | What it does | What it cannot prove by itself |
| --- | --- | --- |
| Package | Supplies project assets, the `lazytrae` companion CLI, and the local MCP server. | That Trae discovered the assets or connected to MCP. |
| Host | Trae IDE, Trae Work, or Trae CLI loads configuration and starts a session. | That your requested feature works. |
| Evidence | Records checks such as `load-check`, `doctor`, and task verification. | A host event or connection that you have not observed. |

## Package readiness is not host proof

`lazytrae load-check --host <ide|work|cli>` checks the copied package assets
and declarations. `lazytrae doctor` reports installation health. Both are
useful, but neither proves host discovery, hook execution, a running session,
or an MCP connection.

The required final observation depends on the host:

- **Trae IDE:** reopen the project and observe discovery and the MCP connection.
- **Trae Work:** on macOS, reload Work, confirm skill discovery, and manually
  add or confirm `lazytrae mcp` in **Settings → MCP**.
- **Trae CLI:** add the registration, start a new session, and observe the
  connection.

The exact routes are in [Host routes](reference/host-routes.md). Package tests
cover local behavior; their boundary is described in
[verification evidence](../lazytrae-evaluation.md).

## The companion boundary

A copied repository is useful for reading the workflow files. The installed
`lazytrae` companion supplies the portable installer, verification gate, and
local MCP server. If that command is absent, the repo-only fallback can copy
project configuration, but it does not create a global executable; the MCP
declaration remains pending until the companion is installed.

That boundary keeps an installation claim honest: package readiness means the
local assets are present; host proof means you saw the selected host load or
connect them. Continue with [install and host verification](03-install-and-host-verification.md),
then see [MCP lifecycle](07b-mcp-lifecycle.md) for the declaration-to-connection
boundary.
