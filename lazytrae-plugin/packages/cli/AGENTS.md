# CLI PACKAGE KNOWLEDGE BASE

## OVERVIEW

`packages/cli/` is the LazyTrae user-facing runtime: installer, doctor,
verification gate, hook dispatcher, loop controls, team mode, model routing,
tooling lifecycle, and the launcher for the local MCP server.

The packaged baseline is `v1.0.3`. Keep maintainer guidance grounded
in the current source and test suite rather than historical release notes.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Command routing | `src/index.js` | Keep help text aligned with every command key and alias. |
| Install/sync templates | `src/commands/init.js`, `src/commands/sync.js`, `templates/` | Template changes need installed-tree verification. |
| Health gates | `src/commands/doctor.js`, `src/commands/verify.js`, `src/lib/*.js` | `verify` applies the strict completion gate. |
| Hooks | `src/commands/hook.js`, `templates/hooks/` | Trae hooks are advisory; hard gates belong in CLI/MCP. |
| Loop runtime | `src/commands/loop.js`, `templates/state/active-loop.json` | Runtime state lives under `.lazytrae/loop/`. |
| Team mode | `src/commands/team.js`, `src/lib/team-check.js` | State lives under `.lazytrae/team/`. |
| MCP bridge | `src/commands/mcp.js`, `../mcp/src/` | CLI command delegates to the MCP package entry point. |
| Tests | `test/` | Broad Node test suite covering templates, install/sync, lifecycle, MCP, tooling, and safety boundaries. |

## CONVENTIONS

- Keep command modules direct and match the established package style; do not
  invent a line-count ceiling.
- Use CommonJS consistently in this package.
- Preserve root project semantics and validate behaviour through package and
  installed-project surfaces.
- Keep release content self-contained; do not require external source trees.
- For state writes, prefer existing JSON helpers and schema-backed shapes over
  ad hoc string writes.
- Treat `templates/` as the installation source of truth and keep installed
  mirrors aligned.

## ANTI-PATTERNS

- Do not claim hook blocking parity; Trae hooks exit 0, so completion blocking
  belongs in CLI/MCP.
- Do not add command behaviour without a real CLI/manual surface proof.
- Do not update templates without checking the matching installed-tree
  expectation.
- Do not run an installed-project readiness command against this source checkout
  and report it as package proof.

## CONTRIBUTOR VERIFICATION

Run from `packages/cli/`:

```bash
node --test test/documentation-regression.test.js test/onboarding-contract.test.js
npm test
node src/index.js --help
```

Use focused tests while iterating and `npm test` before handing off a broad
change. `node src/index.js --help` is the direct CLI smoke check. The
`load-check` command is a package-readiness tool for an initialized project;
run it there, not against an uninitialized source checkout with repository hook
mirrors.
