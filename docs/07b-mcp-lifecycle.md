# MCP lifecycle

MCP has distinct stages: a copied declaration, host registration where needed,
a host connection, and a tool call. Do not collapse a passing package check
into proof of the later stages.

## Declaration is not connection

`lazytrae init` copies the project declaration and `lazytrae load-check` checks
that package asset. Trae IDE still needs a project reopen and observation.
Trae Work needs manual **Settings → MCP** registration with command `lazytrae`
and argument `mcp`. Trae CLI needs `trae-cli mcp add-json` before a new session.
Only a host connection makes the core server's tools available.

The companion package is self-contained: its tarball includes the CLI, local
MCP implementation, templates, package-local legal notices, and production
dependency closure. A cold offline install tests that distribution layer; it
does not prove a host launched or connected the server.

## Core server and optional declarations

The base `.trae/mcp.json` contains eight declarations: one executable local
`lazytrae` core server and seven disabled placeholders. After host connection,
the core server exposes 15 tools for local state, evidence, handoff, and
context work. The exact inventory is in [MCP inventory](reference/mcp-inventory.md).

Optional providers are disabled by default. `lazytrae tooling enable
<capability>` is an explicit persistent selection for supported optional
capabilities; it is not part of normal install or automatic routing. Follow
[Host routes](reference/host-routes.md) and finish with [Test and release
verification](09-test-and-release-verification.md).
