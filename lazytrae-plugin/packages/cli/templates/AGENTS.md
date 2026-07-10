# AGENTS.md — LazyTrae Setup Guide

> **Agent:** this file is the **setup** guide. It tells you how to install and configure LazyTrae. For *how to use* the harness once installed, see [README.md](README.md).

LazyTrae is a Trae-native adaptation of the LazyCodex/OmO agent harness. It supports Trae IDE, Trae Work, and Trae CLI; the `lazytrae` command supplies the portable installer, verification gate, and local MCP server on each surface.

## Step 0 — Which platform are you on?

| Platform | Skills | Commands | Rules / Agents / Hooks | MCP server |
|---|---|---|---|---|
| **Trae IDE** | project `.trae/skills/` | project commands | project hooks | project `.trae/mcp.json` |
| **Trae Work** | install from the Skills UI | invoke skills or natural language | CLI verification gates | manually add `lazytrae mcp` in Settings → MCP |
| **Trae CLI** | local project configuration | `trae-cli` agent session + `lazytrae` gates | CLI verification gates | registered with `trae-cli mcp add-json` |

- **Trae IDE** → Step A, then open the project in Trae IDE.
- **Trae Work** → Step A, then follow the Work setup in [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md).
- **Trae CLI** → [Step C](#step-c--trae-cli-no-ide).

## Step A — Install

**Option A — let an agent install it (recommended).** Open this repo in your Trae surface and paste:

> Install LazyTrae from `lazytrae-plugin/`. Copy `.trae/` (rules, skills, commands, agents, hooks) and `.lazytrae/` (schemas, config) into my project, wire `.trae/mcp.json`, then run `lazytrae doctor` to verify.

**Option B — manual CLI install:**
```bash
git clone https://github.com/elvinzhao10/Trae.git
cd Trae/lazytrae-plugin/packages/cli
npm install
npm install -g .
cd /path/to/your/project
lazytrae init
lazytrae doctor
```

> Keep the global CLI installed: `.trae/mcp.json` starts the `lazytrae mcp` command. The generated project files are portable, but the local MCP server is supplied by that CLI.

## Step B — Trae Work setup

Trae IDE uses project configuration. In Trae Work, import the `SKILL.md` bundles from `.trae/skills/` through the Skills UI, then manually add the LazyTrae server through **Settings → MCP**. Use `lazytrae` as the command with `mcp` as its argument. Full steps: [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md).

## Step C — Trae CLI (no IDE)

```bash
trae-cli                          # start a Trae CLI agent session
lazytrae init && lazytrae doctor      # install + verify
lazytrae verify --must-pass           # hard completion gate
lazytrae loop status                  # long-horizon loop state
trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'
```

The final command registers the LazyTrae MCP server with Trae CLI. Run `lazytrae mcp` directly only when another MCP host launches it over stdio.

## Verify

```bash
lazytrae doctor    # expect 0 FAIL (WARNs are environmental: empty evidence, etc.)
```

## What gets installed

`.trae/` (rules, 17 `lazy-` skills, 9 `lazy-` commands, 11 agents, hooks), `.lazytrae/` (schemas, config), `.trae/mcp.json` (15 MCP tools), and this `AGENTS.md` (setup guide). All skills/commands are `lazy-` prefixed.

## Reference

- Full setup detail (Trae Work + CLI): [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md)
- How to use the harness: [README.md](README.md)
- Parity assessment: [lazytrae-evaluation.md](lazytrae-evaluation.md)
