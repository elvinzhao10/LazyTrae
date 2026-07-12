# LazyTrae documentation handoff

## Purpose

Write new, current documentation here. Treat the ignored material in
`dev/docs/root/` as historical reference only: it may describe superseded
workflows, assumptions, or release states and must not be presented as current
behavior without verification against source and tests.

## Current release state

The current LazySeries tooling release is **v0.16.0-alpha.1**. Package
validation is verified on macOS only. The local foundation selects `rg` for
text/file search, `sg` for structural search, the separate read-only LSP MCP
for supported JavaScript/TypeScript and Python semantic navigation, and
repository-native verification only when the caller explicitly runs a declared
check. CodeGraph is a separate, explicit architecture/dependency MCP: it
requires a receipt-owned tooling root and a caller-created project index.
Context7 and `grep_app` stay disabled, offline, and optional until enabled by
the project. Do not document any optional capability as a required install
dependency or as verified on a non-macOS host.

## Repository map

| Area | Responsibility |
| --- | --- |
| `lazytrae-plugin/packages/cli/` | The distributable `lazytrae` CLI, templates, install/sync/doctor/verify/uninstall commands, and CLI tests. |
| `lazytrae-plugin/packages/mcp/` | The standalone MCP server source and its tests. |
| `lazytrae-plugin/packages/cli/src/mcp/` | The packaged CLI mirror of the MCP implementation; keep it aligned with `packages/mcp/`. |
| `lazytrae-plugin/.trae/` | Repository development configuration used to exercise the harness. |
| `lazytrae-plugin/packages/cli/templates/` | Files copied into user projects by `lazytrae init`; they must be self-contained. |
| `docs/` | Current learning-oriented documentation. |
| `dev/` | Ignored personal working material. It is never a package, runtime, test, or installation input. |

## Documentation rules

1. Verify a claim against the CLI/MCP source and its tests before documenting it.
2. Keep package instructions self-contained: do not direct installed users or
   package code to repository-root `docs/` or `dev/`.
3. Document only macOS as verified. Describe other host operating systems as
   unverified unless new evidence is added.
4. Preserve the distinction between package readiness checks and live host MCP
   registration or connection checks.
5. When source and template behavior differ, treat that as a defect to resolve
   before publishing guidance.

## Useful validation entry points

Run commands from `lazytrae-plugin/packages/cli/` unless a command says
otherwise:

```bash
npm test
node src/index.js --help
node src/index.js doctor
node src/index.js verify
node src/index.js tooling --help
```

The package README and `AGENTS.md` remain the concise current starting points
while this documentation set is rebuilt. Do not restore the ignored legacy tree
as a dependency of these commands.
