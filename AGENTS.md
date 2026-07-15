<!-- lazytrae:managed:start:onboarding -->
# AGENTS.md — LazyTrae

## OVERVIEW

LazyTrae v0.17.0 is a workflow harness for Trae IDE, Trae Work, and Trae CLI: 17 skills, 9 commands, 11 agents, and an MCP server for repository understanding, planning, execution, and verification.

It is verified on macOS only. Automatic local capability selection is
temporary and receipt-owned: it may use `rg`, `sg`, or a read-only LSP bridge,
but never edits project MCP configuration, dependencies, lockfiles, or host
settings. CodeGraph, Context7, `grep_app`, filesystem, and Playwright remain
explicit optional capability choices; onboarding and offboarding never enable
them.

## STRUCTURE

- `lazytrae-plugin/`: Distributable package (CLI, MCP, templates).
- `.trae/`: Trae config (skills, commands, agents, rules, hooks).
- `.lazytrae/`: Schemas, state, plans, evidence, loops.

## WHERE TO LOOK

| Task | Location |
| --- | --- |
| Package source | `lazytrae-plugin/packages/cli/` |
| MCP server | `lazytrae-plugin/packages/mcp/` |
| Skills/commands | `.trae/skills/`, `.trae/commands/` |
| Tests | `lazytrae-plugin/packages/cli/test/` |

## CONVENTIONS

- Versioning: `v0.x` scheme only.
- CLI files ≤250 lines; hook scripts ≤100 lines.
- Conventional commits, atomic changes.
- State files use JSON Schema validation.

## ANTI-PATTERNS

- No `git add -A` or `git add .` — stage only changed files.
- No force pushes.
- Do not run `load-check` against source checkout.

## COMMANDS

```bash
lazytrae init --host ide|work|cli   # Install
lazytrae load-check --host ide      # Verify package readiness
lazytrae doctor                     # Health check
lazytrae verify --must-pass         # Completion gate
lazytrae uninstall --yes            # Remove
```

---

## `onboard` protocol

When the user types `onboard`:

1. Ask which host: **Trae IDE**, **Trae Work**, or **Trae CLI**.
2. Follow only that route. If the companion command is available, run `lazytrae init --host <host>`; `init --host work` invokes the bounded Work skill installation and is followed by `lazytrae work status`.
3. If the companion command is unavailable, do not claim this copied repository installs it. The repo-only fallback below copies project assets but leaves the MCP declaration pending.
4. Report each completed action and final **package readiness** result. It verifies copied files and declarations, not host discovery, MCP connection, or a running session.
5. Stop before marketplace, account, model, or app-setting changes. Do not enable optional tooling or providers. Give the exact remaining manual host step.

## `offboard` protocol

When the user types `offboard`:

1. Ask which host and package scope to remove.
2. Run only `lazytrae uninstall --yes`, `--soft`, or `--purge-state`; do not combine the latter two modes or guess any host path.
3. Preserve modified, unknown, linked, user-owned, caller-owned, and host-managed assets; report retained files instead of deleting around them.
4. On macOS, use `lazytrae work uninstall` only for Trae Work's verified skill location. For another platform, require a host-reported `--skills-dir`.
5. Keep host removal manual: remove `lazytrae mcp` in **Trae Work Settings → MCP**; run `trae-cli mcp remove lazytrae` for Trae CLI; for Trae IDE, remove or confirm the project declaration in the IDE.
6. Report package removal separately from the user's observed host/MCP result.

## Host routes

| Host | Assets | MCP step |
| --- | --- | --- |
| **Trae IDE** | `.trae/`, `.lazytrae/` | `.trae/mcp.json` declares server; reopen and observe it |
| **Trae Work** | 17 skills to `~/.trae-cn/skills/` on macOS | Add `lazytrae mcp` manually in Settings → MCP |
| **Trae CLI** | Project config + verification gates | Register with `trae-cli mcp add-json`, then start a new session |

## Install

```bash
git clone https://github.com/elvinzhao10/LazyTrae.git
cd /path/to/your/project
lazytrae init --host ide
lazytrae load-check --host ide
```

The copied repository is enough to inspect workflow files, but the separate
`lazytrae` companion supplies the installer, verification gate, and local MCP
server. Its self-contained installed package does not require a source checkout
after installation. If it is absent, use this repo-only project configuration fallback:

```bash
node /path/to/LazyTrae/lazytrae-plugin/packages/cli/src/index.js init --host ide
```

It copies `.trae/` and `.lazytrae/` but does not create a global executable, so
the declared MCP server remains pending until the companion is installed.

For Trae Work, reload the host after `lazytrae init --host work` and add command
`lazytrae` with argument `mcp` in **Settings → MCP**. For Trae CLI, run:

```bash
lazytrae init --host cli
trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'
```

## Verification

```bash
lazytrae doctor
lazytrae load-check --host ide
lazytrae tooling capability-status --json
```

## Removal

```bash
lazytrae uninstall --yes
lazytrae uninstall --yes --soft
lazytrae uninstall --yes --purge-state
lazytrae work uninstall
```

Project uninstall never removes a Trae Work or Trae CLI registration. Follow
the manual steps in `offboard` above after package removal.

## Reference

- [README.md](README.md)
- [lazytrae-evaluation.md](lazytrae-evaluation.md)
<!-- lazytrae:managed:end:onboarding -->
