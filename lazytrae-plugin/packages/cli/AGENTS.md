# CLI PACKAGE KNOWLEDGE BASE

## OVERVIEW

`packages/cli/` is the LazyTrae user-facing runtime: installer, doctor, hook dispatcher, loop controls, team mode, model routing, and the shim that starts the MCP server.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Command routing | `src/index.js` | Keep help text aligned with every command key and alias. |
| Install/sync templates | `src/commands/init.js`, `src/commands/sync.js`, `templates/` | Template changes need installed-tree verification. |
| Health gates | `src/commands/doctor.js`, `src/commands/verify.js`, `src/lib/*.js` | `verify` is strict doctor behavior. |
| Hooks | `src/commands/hook.js`, `templates/hooks/` | Trae hooks are advisory; hard gates belong in CLI/MCP. |
| Loop runtime | `src/commands/loop.js`, `templates/state/active-loop.json` | v0.13 expands this from status/control into goal/evidence operations. |
| Team mode | `src/commands/team.js`, `src/lib/team-check.js` | State lives under `.lazytrae/team/`. |
| MCP bridge | `src/commands/mcp.js`, `../mcp/src/` | CLI command delegates to the MCP package entry point. |
| Tests | `test/` | Currently thin: one MCP smoke script plus hook fixtures. |

## CONVENTIONS

- Keep command modules small and direct; v0.13 enforces a 250 LOC ceiling for `.js` source files.
- Use CommonJS consistently in this package.
- Preserve root project semantics and validate behavior through the packaged surfaces.
- Keep release content self-contained; do not require external source trees.
- For state writes, prefer existing JSON helpers and schema-backed shapes over ad hoc string writes.

## ANTI-PATTERNS

- Do not leave `npm test` as a placeholder once adding runtime behavior.
- Do not claim hook blocking parity; Trae hooks exit 0, so completion blocking must be enforced by CLI/MCP.
- Do not add command behavior without a real CLI/manual surface proof.
- Do not update templates without also checking the installed `.trae/` or `.lazytrae/` counterpart expectation.

## COMMANDS

```bash
node src/index.js --help
node src/index.js doctor
node test/mcp-test.js
```
