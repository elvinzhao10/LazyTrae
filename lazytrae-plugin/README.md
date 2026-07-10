# LazyTrae Plugin

This is the release package for LazyTrae's three supported surfaces: Trae IDE, Trae Work, and Trae CLI.

## Layout

| Path | Purpose |
| --- | --- |
| `agents/`, `commands/`, `hooks/`, `rules/`, `skills/`, `.mcp.json` | Top-level navigation aliases for the Trae project configuration. Each points to the canonical file in `.trae/`. |
| `config.json`, `schemas/` | Top-level navigation aliases for the versioned LazyTrae defaults in `.lazytrae/`. Runtime state is excluded by `.gitignore`. |
| `templates/` | Top-level navigation alias for the CLI installer templates. |
| `.trae/` | Canonical Trae project configuration, retained because Trae IDE and Trae Work use this exact path. |
| `.lazytrae/` | Canonical versioned schema and default configuration assets. |
| `packages/cli/` | Installable `lazytrae` command, including the installer, doctor, verification gate, and MCP launcher. |
| `packages/mcp/` | The Node stdio MCP implementation used by `lazytrae mcp`. |

The aliases make the plugin easy to browse while avoiding duplicate configuration. The CLI template tree in `packages/cli/templates/` remains the installation source of truth. Run `npm test` from `packages/cli/` after changing it.

## Install

```bash
cd packages/cli
npm install
npm install -g .
cd /path/to/your/project
lazytrae init
lazytrae doctor
```

For Trae Work, import the skills from `.trae/skills/` through the Skills UI. The generated project `.trae/mcp.json` launches the globally installed `lazytrae mcp` server; use the MCP Settings UI as a fallback when your Trae Work build does not load project configuration.

See the repository [setup guide](../AGENTS.md) for the full workflow.
