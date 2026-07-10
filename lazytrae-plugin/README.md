# LazyTrae Plugin

This is the release package for LazyTrae's three supported surfaces: Trae IDE, Trae Work, and Trae CLI.

## Layout

| Path | Purpose |
| --- | --- |
| `.trae/` | Trae project configuration: skills, commands, agents, rules, hooks, and MCP configuration. |
| `.lazytrae/` | Versioned schema and default configuration assets. Runtime state is excluded by `.gitignore`. |
| `packages/cli/` | Installable `lazytrae` command, including the installer, doctor, verification gate, and MCP launcher. |
| `packages/mcp/` | The Node stdio MCP implementation used by `lazytrae mcp`. |

The CLI template tree in `packages/cli/templates/` is the installation source of truth. Run `npm test` from `packages/cli/` after changing it.

## Install

```bash
cd packages/cli
npm install
npm install -g .
cd /path/to/your/project
lazytrae init
lazytrae doctor
```

For Trae Work, run `lazytrae work install` to copy the skills globally into `~/.trae-cn/skills/` on macOS, then restart or reload Trae Work. The host has no global command registry, so use skills or natural-language requests. Add the MCP server manually in **Settings → MCP** with command `lazytrae` and argument `mcp`; Trae Work does not auto-load `.trae/mcp.json`.

See the repository [setup guide](../AGENTS.md) for the full workflow.
