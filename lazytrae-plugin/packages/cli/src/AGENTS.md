# AGENTS.md — CLI Source

## OVERVIEW

LazyTrae CLI runtime: installer, doctor, verification gate, hook dispatcher, loop controls, team mode, tooling lifecycle, and MCP launcher.

## STRUCTURE

- `commands/`: 17 CLI commands (`init`, `doctor`, `verify`, `loop`, `team`, `tooling`, etc.).
- `lib/`: Shared utilities (loop runtime, tooling broker, path boundary, templates, etc.).
- `mcp/`: Packaged MCP mirror (handlers, tools); keep aligned with `../../mcp/src/`.
- `index.js`: Command router and entry point.

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Command routing | `index.js` |
| Install/sync | `commands/init.js`, `commands/sync.js` |
| Health gates | `commands/doctor.js`, `commands/verify.js` |
| Hook dispatching | `commands/hook.js` |
| Loop runtime | `commands/loop.js`, `lib/loop-runtime.js` |
| Team mode | `commands/team.js`, `lib/team-check.js` |
| Tooling lifecycle | `commands/tooling.js`, `lib/tooling-*.js` |
| MCP bridge | `commands/mcp.js` |
| Template management | `lib/templates.js` |

## CONVENTIONS

- Keep command modules direct; match established package style.
- Use CommonJS consistently in this package.
- Prefer schema-backed JSON helpers for state writes.
- CLI files must stay under 250 lines.

## ANTI-PATTERNS

- Do not claim hook blocking parity; Trae hooks exit 0.
- Do not add command behaviour without CLI/manual surface proof.