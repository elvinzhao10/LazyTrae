# AGENTS.md — LazyTrae Setup Guide

> **Agent:** this file is the **setup** guide. It tells you how to install and configure LazyTrae. For *how to use* the harness once installed, see [README.md](README.md).

LazyTrae is a Trae-native adaptation of the LazyCodex/OmO agent harness. It runs on three surfaces; setup differs.

## Step 0 — Which platform are you on?

| Platform | Skills | Commands | Rules / Agents / Hooks | MCP server |
|---|---|---|---|---|
| **Trae IDE** | auto | auto | auto | auto (`.trae/mcp.json`) |
| **Trae Work** | auto | manual | not supported | **manual** (Settings UI) |
| **Trae CLI** (no IDE) | — | via `lazytrae` CLI | — | via `lazytrae mcp` |

- **Trae IDE** → [Step A](#step-a--install) only.
- **Trae Work** → Step A **then [Step B (manual MCP)](#step-b--mcp-server-trae-work-only--manual)** — full detail in [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md).
- **Trae CLI** → [Step C](#step-c--trae-cli-no-ide).

## Step A — Install

**Option A — let an agent install it (recommended).** Open this repo in your Trae surface and paste:

> Install the LazyTrae plugin from `lazytrae-plugin/`. Read the plugin manifest, copy `.trae/` (rules, skills, commands, agents, hooks) and `.lazytrae/` (schemas, config) into my project, wire `.trae/mcp.json`, then run `lazytrae doctor` to verify.

**Option B — manual CLI install:**
```bash
git clone https://github.com/elvinzhao10/Trae.git
cd Trae/lazytrae-plugin/packages/cli && npm install
node src/index.js init     # copies .trae/, .lazytrae/, wires MCP, generates AGENTS.md
node src/index.js doctor   # verify
```

> Once installed into your project, the source repo can be deleted — your project retains its generated `.trae/`, `.lazytrae/`, and `AGENTS.md`.

## Step B — MCP server (Trae Work only — manual)

Trae Work does **not** read `.trae/mcp.json`. An agent cannot automate this; you must paste it:

1. **Settings → MCP → Create → Manual configuration.**
2. Paste (uses `${workspaceFolder}`, auto-replaced by Trae Work):
```json
{
  "mcpServers": {
    "lazytrae": { "command": "node", "args": ["${workspaceFolder}/lazytrae-plugin/packages/mcp/src/index.js"] }
  }
}
```

> Trae IDE and Trae CLI load MCP automatically — **skip this step**. Full Trae Work steps: [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md).

## Step C — Trae CLI (no IDE)

```bash
lazytrae init && lazytrae doctor      # install + verify
lazytrae verify --must-pass           # hard completion gate
lazytrae loop status                  # long-horizon loop state
lazytrae mcp                          # start MCP server (stdio JSON-RPC)
```

## Verify

```bash
lazytrae doctor    # expect 0 FAIL (WARNs are environmental: empty evidence, etc.)
```

## What gets installed

`.trae/` (rules, 17 `lazy-` skills, 9 `lazy-` commands, 11 agents, hooks), `.lazytrae/` (schemas, config), `.trae/mcp.json` (15 MCP tools), and this `AGENTS.md` (setup guide). All skills/commands are `lazy-` prefixed.

## Reference

- Full setup detail (Trae IDE vs Work, screenshots): [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md)
- How to use the harness: [README.md](README.md)
- Parity assessment: [lazytrae-evaluation.md](lazytrae-evaluation.md)
