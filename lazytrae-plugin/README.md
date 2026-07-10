# LazyTrae Plugin

This is the release package for LazyTrae's three supported surfaces: Trae IDE, Trae Work, and Trae CLI.

## Layout

| Path | Purpose |
| --- | --- |
| `.lazytraecode/` | Canonical Trae IDE and Trae CLI source configuration: skills, commands, agents, rules, hooks, and MCP settings. |
| `.lazytraework/` | Canonical Trae Work workflow configuration, schemas, and defaults. Runtime state is excluded by `.gitignore`. |
| `packages/cli/` | Installable `lazytrae` command, including the installer, doctor, verification gate, and MCP launcher. |
| `packages/mcp/` | The Node stdio MCP implementation used by `lazytrae mcp`. |

The CLI template tree in `packages/cli/templates/` mirrors `.lazytraecode/` and is the installation source of truth. `lazytrae init` materializes the host-required `.trae/` directory in a consumer project; that generated directory is not a release artifact. Run `npm test` from `packages/cli/` after changing it.

## Install

```bash
cd packages/cli
npm install
npm install -g .
cd /path/to/your/project
lazytrae init
lazytrae doctor
```

For Trae Work, import the skills from `.lazytraecode/skills/` through the Skills UI. The generated project `.trae/mcp.json` launches the globally installed `lazytrae mcp` server for Trae IDE and CLI; use the MCP Settings UI as a fallback when your Trae Work build does not load project configuration.

See the repository [setup guide](../AGENTS.md) for the full workflow.
