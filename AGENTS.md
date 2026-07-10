# AGENTS.md — LazyTrae Setup Guide

> **Agent:** this file is the **setup** guide. It tells you how to install and configure LazyTrae. For *how to use* the harness once installed, see the [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme).

LazyTrae is a Trae-native adaptation of the LazyCodex/OmO agent harness. It supports Trae IDE, Trae Work, and Trae CLI; the `lazytrae` command supplies the portable installer, verification gate, and local MCP server on each surface.

## `onboard` protocol

When the user types `onboard`:

1. Read this guide and ask which installed host/version they are using: **Trae IDE**, **Trae Work**, or **Trae CLI**.
2. Follow only that host's setup path. Perform safe repository and CLI steps automatically. If the separate `lazytrae` companion command is available, run `lazytrae init --host ide|work|cli`; for Trae Work, also run `lazytrae work install` and `lazytrae work status`. If it is absent, do not claim the cloned repository supplies it; offer the repo-only fallback in Step A and explain its MCP limit.
3. Report each completed action and its observed result. Label the final `load-check` as **package readiness**: it verifies copied files and declared configuration, not host discovery, MCP connection, or a running session.
4. Stop before account, marketplace, model, or app-setting changes. Give exact manual directions for those steps. For Trae Work, manual **Settings → MCP** registration is required.
5. End by explaining that the copied repository can be deleted after installation, or retained to explore and study the project.

## Step 0 — Which platform are you on?

| Platform | Skills | Commands | Rules / Agents / Hooks | MCP server |
|---|---|---|---|---|
| **Trae IDE** | project `.trae/skills/` | project commands | project hooks | declaration in project `.trae/mcp.json`; reconnect/reopen to verify |
| **Trae Work** | global `lazytrae work install` → `~/.trae-cn/skills/` (macOS) | no global commands; use skills or natural language | CLI verification gates | manually add `lazytrae mcp` in Settings → MCP |
| **Trae CLI** | local project configuration | `trae-cli` agent session + `lazytrae` gates | CLI verification gates | register with `trae-cli mcp add-json` before starting a session |

- **Trae IDE** → Step A, then open the project in Trae IDE.
- **Trae Work** → Step A, then follow the [Trae Work setup guide](https://github.com/elvinzhao10/LazyTrae/blob/main/docs/lazytrae-setup-guide.md).
- **Trae CLI** → [Step C](#step-c--trae-cli-no-ide).

## Step A — Install

**Option A — AI onboarding (recommended).** Open the copied repository in your Trae surface and type `onboard`. This can configure all supported surfaces only when the separate `lazytrae` companion command is already available.

**Option B — companion CLI already installed:**
```bash
git clone https://github.com/elvinzhao10/LazyTrae.git
cd LazyTrae
cd /path/to/your/project
lazytrae init --host ide
lazytrae load-check --host ide
```

The copied repository is enough for AI onboarding; do not run `npm` or `npx` merely to read or use its workflow files. The `lazytrae` command is a separate LazyTrae companion prerequisite for its installer, verification gate, and local MCP server. Installing or repairing `trae-cli` does **not** install that separate `lazytrae` command; if it is unavailable, complete the LazyTrae companion installation through its release/package path before using the manual CLI route.

**Option C — repo-only project configuration (no companion command):**
```bash
git clone https://github.com/elvinzhao10/LazyTrae.git
cd /path/to/your/project
node /path/to/LazyTrae/lazytrae-plugin/packages/cli/src/index.js init --host ide
```

This fallback copies the project `.trae/`, `.lazytrae/`, and compatibility `.omo/` trees without `npm` or `npx`. It does **not** install a global `lazytrae` executable, so the generated `lazytrae mcp` declaration cannot connect until that separate companion is installed. Use it for local skills, commands, rules, and hooks; report the MCP step as pending.

## Step B — Trae Work setup

Trae Work does not auto-load project configuration. Install the 17 global LazyTrae skills with `lazytrae work install`, then restart or reload Trae Work. The command copies the bundled skills to `~/.trae-cn/skills/` on macOS; use `lazytrae work status` to check them later. Trae Work has no global command registry, so invoke those skills or describe the workflow in natural language. Then manually add the LazyTrae server through **Settings → MCP** with command `lazytrae` and argument `mcp`. Full steps: [setup guide](https://github.com/elvinzhao10/LazyTrae/blob/main/docs/lazytrae-setup-guide.md).

## Step C — Trae CLI (no IDE)

```bash
lazytrae init --host cli              # write package files and check readiness
trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'
trae-cli                              # start the agent session only after configuration
```

The registration command completes the CLI configuration; the new session is where Trae CLI actually connects to the server. Run `lazytrae verify --must-pass` before declaring work complete. Run `lazytrae mcp` directly only when another MCP host launches it over stdio.

## Verify

```bash
lazytrae doctor    # expect 0 FAIL (WARNs are environmental: empty evidence, etc.)
```

## What gets installed

`.trae/` (rules, 17 `lazy-` skills, 9 `lazy-` commands, 11 agents, 8 hook scripts for 5 events, and 10 MCP declarations), `.lazytrae/` (canonical LazyTrae schemas/config/runtime data), `.omo/` (retained legacy/workflow-compatibility runtime for plans and loop state), and this `AGENTS.md` (setup guide). The `lazytrae` MCP declaration supplies 15 tools when connected. `.trae/` and `.lazytrae/` remain canonical; do not migrate or delete `.omo/` in this release. All skills/commands are `lazy-` prefixed.

## Reference

- Full setup detail (Trae Work + CLI): [setup guide](https://github.com/elvinzhao10/LazyTrae/blob/main/docs/lazytrae-setup-guide.md)
- How to use the harness: [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme)
- Parity assessment: [LazyTrae evaluation](https://github.com/elvinzhao10/LazyTrae/blob/main/lazytrae-evaluation.md)
