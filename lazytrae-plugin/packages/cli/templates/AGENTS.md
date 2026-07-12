# AGENTS.md — LazyTrae Setup Guide

> **Agent:** this file is the **setup** guide. It tells you how to install and configure LazyTrae. For *how to use* the harness once installed, see the [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme).

LazyTrae is a Trae-native workflow harness. It supports Trae IDE, Trae Work, and Trae CLI; the `lazytrae` command supplies the portable installer, verification gate, and local MCP server on each surface.

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
| **Trae Work** | `lazytrae work install` → `~/.trae-cn/skills/` on macOS | no global commands; use skills or natural language | CLI verification gates | manually add `lazytrae mcp` in Settings → MCP |
| **Trae CLI** | local project configuration | `trae-cli` agent session + `lazytrae` gates | CLI verification gates | register with `trae-cli mcp add-json` before starting a session |

- **Trae IDE** → Step A, then open the project in Trae IDE.
- **Trae Work** → Step A, then use the Work setup below.
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

This fallback copies the project `.trae/` and `.lazytrae/` trees without `npm` or `npx`. It does **not** install a global `lazytrae` executable, so the generated `lazytrae mcp` declaration cannot connect until that separate companion is installed. Use it for local skills, commands, rules, and hooks; report the MCP step as pending.

## Step B — Trae Work setup

Trae Work does not auto-load project configuration. On macOS, install the 17 global LazyTrae skills with `lazytrae work install`, then inspect them with `lazytrae work status`. The macOS destination is `~/.trae-cn/skills/`; host reload/discovery still requires manual confirmation. Trae Work has no global command registry, so invoke skills or use natural language. Add the LazyTrae server manually through **Settings → MCP** with command `lazytrae` and argument `mcp`. Linux and Windows paths and host behavior are unverified; use `--skills-dir` only with a directory manually reported by Trae Work.

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

## Uninstall

From the initialized project, use the documented safe modes:

```bash
lazytrae uninstall --yes                # exact managed assets only; normal runtime data remains
lazytrae uninstall --yes --soft         # exact .trae/ assets only
lazytrae uninstall --yes --purge-state  # exact runtime templates too
```

For Trae Work on macOS, run `lazytrae work uninstall`; it removes only unmodified LazyTrae skills and preserves edited or nonempty folders. Remove the `lazytrae` MCP server manually in **Settings → MCP**. Linux and Windows host directories are unverified: pass `--skills-dir <host-reported-directory>` only after manually confirming it. For Trae CLI, remove the separately registered server with `trae-cli mcp remove lazytrae`; project uninstall never changes that registration. Remove the global companion only when unused: `npm uninstall -g lazytrae-ai`.

## What gets installed

`.trae/` (rules, 17 `lazy-` skills, 9 `lazy-` commands, 11 agents, 8 hook scripts for 5 events, and 10 MCP declarations), `.lazytrae/` (canonical LazyTrae schemas, config, plans, loop, and runtime data), and this `AGENTS.md` (setup guide). The `lazytrae` MCP declaration supplies 15 tools when connected. All skills/commands are `lazy-` prefixed.

## Reference

- Trae Work: `lazytrae work install`, then `lazytrae work status`
- How to use the harness: [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme)
- Parity assessment: [LazyTrae evaluation](https://github.com/elvinzhao10/LazyTrae/blob/main/lazytrae-evaluation.md)
