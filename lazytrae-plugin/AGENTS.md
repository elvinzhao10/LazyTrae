# AGENTS.md — LazyTrae Plugin

## OVERVIEW

The distributable LazyTrae package: Trae configuration, `lazytrae` CLI, and local stdio MCP server.

## STRUCTURE

- `.trae/`: Trae project config (skills, commands, agents, rules, hooks, MCP).
- `.lazytrae/`: Versioned schemas and default config.
- `packages/cli/`: Installable CLI (installer, doctor, verification gate, tooling, MCP launcher).
- `packages/mcp/`: Standalone stdio MCP implementation.

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Installation templates | `packages/cli/templates/` |
| CLI commands | `packages/cli/src/commands/` |
| MCP handlers | `packages/mcp/src/`, `packages/cli/src/mcp/` |
| Tests | `packages/cli/test/` |

## CONVENTIONS

- `packages/cli/templates/` is the installation source of truth.
- Keep `packages/cli/src/mcp/` aligned with `packages/mcp/src/`.
- Run tests from `packages/cli/` with `npm test`.

## ANTI-PATTERNS

- Do not duplicate host lifecycle docs; root README is canonical.
- Do not run `load-check` against source checkout as package proof.