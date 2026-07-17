# AGENTS.md — Trae Configuration

## OVERVIEW

Trae project configuration: skills, commands, agents, rules, hooks, and MCP declaration.

## STRUCTURE

- `skills/`: 17 workflow playbooks (`lazy-init-deep`, `lazy-ulw-plan`, etc.).
- `commands/`: 9 `lazy-` commands.
- `agents/`: 11 specialist agent roles.
- `rules/`: 4 language/tech rules (CSS, Python, TypeScript, LazyTrae).
- `hooks/`: 8 hook scripts across 5 events.
- `hooks.json`: Event-to-hook mappings.
- `mcp.json`: MCP server declarations.

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Workflow skills | `skills/lazy-*/SKILL.md` |
| Command definitions | `commands/lazy-*.md` |
| Agent roles | `agents/*.md` |
| Hook implementations | `hooks/*.sh` |
| Event mappings | `hooks.json` |
| MCP server config | `mcp.json` |

## CONVENTIONS

- Skills follow `lazy-*` naming convention.
- Hook scripts must stay <100 lines.
- MCP declarations: one executable core server + 7 disabled placeholders.

## ANTI-PATTERNS

- Do not add hooks that block completion; use CLI/MCP gates instead.
- Do not modify MCP declarations without package lifecycle verification.