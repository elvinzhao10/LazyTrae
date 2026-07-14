# LazyTrae Plugin

This is the release package for LazyTrae's three supported surfaces: Trae IDE, Trae Work, and Trae CLI.

Current release: **v0.16.0-alpha.1**, verified on macOS only. It provides an
explicit package-owned tooling lifecycle: `rg` for local search, `sg` for
structural search, a separate read-only LSP bridge for supported languages, and
CodeGraph only after an explicit architecture/dependency request. Optional
Context7 and `grep_app` selections remain disabled unless the project enables
them.

## Layout

| Path | Purpose |
| --- | --- |
| `.trae/` | Trae project configuration: skills, commands, agents, rules, hooks, and MCP configuration. |
| `.lazytrae/` | Versioned schema and default configuration assets. Runtime state is excluded by `.gitignore`. |
| `packages/cli/` | Installable `lazytrae` command, including the installer, doctor, verification gate, and MCP launcher. |
| `packages/mcp/` | The Node stdio MCP implementation used by `lazytrae mcp`. |
| `packages/cli/tooling/lsp/` | Locked TypeScript/JavaScript and Python provider manifests used only by the explicit managed LSP lifecycle. |

The CLI template tree in `packages/cli/templates/` is the installation source of truth. Run `npm test` from `packages/cli/` after changing it.

## Install

Copy or clone [LazyTrae](https://github.com/elvinzhao10/LazyTrae), open it in the target host, and type `onboard`. The generated setup guide selects Trae IDE, Trae Work, or Trae CLI and runs the matching `lazytrae init --host <host>` command when the companion CLI is already installed. That check proves package readiness only; host discovery and MCP connection are reported separately.

For Trae Work, `lazytrae init --host work` invokes the bounded Work skill installation, then inspect it with `lazytrae work status`. The verified built-in default targets macOS `~/.trae-cn/skills/`; restart/reload and host discovery must be confirmed manually. Then add the MCP server manually in **Settings → MCP** with command `lazytrae` and argument `mcp`. Trae Work does not auto-load the project `.trae/mcp.json` and has no global command registry, so use skills or natural-language requests. Linux and Windows locations are unverified; use `--skills-dir` only with the directory reported by the host.

Package readiness and capability-status reports are read-only evidence for
copied assets and local state. They do not activate optional providers or prove
a live host or MCP connection.

## Uninstall

`lazytrae uninstall --yes` removes only exact bundled project assets and preserves modified or unknown files plus normal runtime data. Use `--soft` for verified `.trae/` assets only, or `--purge-state` to also remove exact runtime templates; the two options cannot be combined. On macOS, `lazytrae work uninstall` removes only unmodified LazyTrae skills. Remove MCP registration manually in the host. Non-macOS host paths and behavior are unverified; provide an explicitly confirmed directory with `--skills-dir`.

See the repository [setup guide](../AGENTS.md) for the full workflow.
