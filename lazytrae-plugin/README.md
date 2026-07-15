# LazyTrae plugin

This is the self-contained distributable package for LazyTrae on Trae IDE,
Trae Work, and Trae CLI. It includes the project configuration, companion CLI,
and local MCP server needed for its package lifecycle.

The package contains Trae configuration, the `lazytrae` CLI, and the local
stdio MCP server. It is verified on macOS only. Package readiness verifies
copied assets and declarations; it does not prove host discovery or an MCP
connection.

The current package version is `0.17.0`. For Trae Work,
`lazytrae init --host work` invokes the bounded Work skill installation; use
`lazytrae work status` to inspect the copied package assets.

## Layout

| Path | Purpose |
| --- | --- |
| `.trae/` | Trae project configuration: skills, commands, agents, rules, hooks, and MCP declaration. |
| `.lazytrae/` | Versioned schemas and default configuration assets. |
| `packages/cli/` | Installable CLI: installer, doctor, verification gate, lifecycle, tooling, and MCP launcher. |
| `packages/mcp/` | Node stdio MCP implementation used by `lazytrae mcp`. |
| `packages/cli/tooling/lsp/` | Locked LSP provider manifests used by the managed LSP lifecycle. |

`packages/cli/templates/` is the source of truth for files copied into consumer
projects. Keep it self-contained and run the CLI test suite after changes.

## Install, verify, and remove

With the companion command installed, initialize only the host in use:

```bash
lazytrae init --host ide|work|cli
lazytrae load-check --host ide
lazytrae doctor
```

`load-check` reports package readiness only. It does not prove that a host has
discovered the files or connected to MCP. Trae IDE requires reopening the
project; Trae Work requires reload plus a manual **Settings → MCP** entry with
command `lazytrae` and argument `mcp`; Trae CLI requires
`trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'`
before starting a new session. Work's default skill location is verified only
on macOS (`~/.trae-cn/skills/`).

Automatic local tooling is temporary and receipt-owned: `rg`, `sg`, and the
read-only LSP bridge may be selected for a task without changing host or
project configuration. CodeGraph and remote providers remain explicit optional
lifecycles; onboarding, doctor, and InitDeep do not enable them.

Remove only receipt-owned package assets:

```bash
lazytrae uninstall --yes
lazytrae uninstall --yes --soft
lazytrae uninstall --yes --purge-state
lazytrae work uninstall
```

These commands preserve modified, unknown, caller-owned, linked, and
host-managed paths. Remove MCP registrations manually: Work through
**Settings → MCP**, CLI with `trae-cli mcp remove lazytrae`, and IDE through its
project MCP UI. Never guess a host-managed location.

## For package contributors

```bash
cd packages/cli
npm test
node src/index.js --help
```

For contributors, keep source/template mirrors aligned, preserve receipt
ownership boundaries, and run the CLI suite before changing package behavior.
