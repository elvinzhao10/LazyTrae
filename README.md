# LazyTrae — Agent Onboarding Guide

> **A practice project:** realizing [LazyCodex](https://github.com/code-yeongyu/lazycodex) (the OmO harness) on the [Trae](https://docs.trae.cn/) platform. No longer maintained; open-sourced for learning.
>
> **Agent:** this README is your onboarding guide. Read it fully before working in this repo.

## Step 0 — Which platform are you on?

LazyTrae runs on three surfaces; setup differs. Pick yours:

| Platform | Skills | Commands | Rules / Agents / Hooks | MCP server |
|---|---|---|---|---|
| **Trae IDE** | auto | auto | auto | auto (`.trae/mcp.json`) |
| **Trae Work** | auto | manual | not supported | **manual** (Settings UI) |
| **Trae CLI** (no IDE) | — | via `lazytrae` CLI | — | via `lazytrae mcp` |

- **Trae IDE** → [Step A](#step-a--install-the-plugin) only (everything auto-loads).
- **Trae Work** → Step A **then [Step B (manual MCP)](#step-b--mcp-server-trae-work-only--manual)** — see [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md).
- **Trae CLI** → [Step C](#step-c--trae-cli-no-ide).

## Step A — Install the plugin

**Option A — let an agent install it (recommended).** Open this repo in your Trae surface and paste:

> Install the LazyTrae plugin from `lazytrae-plugin/`. Read the plugin manifest, copy `.trae/` (rules, skills, commands, agents, hooks) and `.lazytrae/` (schemas, config) into my project, wire `.trae/mcp.json`, then run `lazytrae doctor` to verify.

**Option B — manual CLI install:**
```bash
git clone https://github.com/elvinzhao10/Trae.git
cd Trae/lazytrae-plugin/packages/cli && npm install
node src/index.js init     # copies .trae/, .lazytrae/, wires MCP
node src/index.js doctor   # verify
```

## Step B — MCP server (Trae Work only — manual)

Trae Work does **not** read `.trae/mcp.json`. An agent cannot automate this — you must paste the config yourself:

1. **Settings → MCP → Create → Manual configuration.**
2. Paste (uses `${workspaceFolder}`, auto-replaced by Trae Work):
```json
{
  "mcpServers": {
    "lazytrae": { "command": "node", "args": ["${workspaceFolder}/lazytrae-plugin/packages/mcp/src/index.js"] }
  }
}
```

> Trae IDE and Trae CLI load MCP automatically — **skip this step**. Full Trae Work steps + screenshots: [docs/lazytrae-setup-guide.md](docs/lazytrae-setup-guide.md).

## Step C — Trae CLI (no IDE)

```bash
lazytrae init && lazytrae doctor      # install + verify
lazytrae verify --must-pass           # hard completion gate
lazytrae loop status                  # long-horizon loop state
lazytrae mcp                          # start MCP server (stdio JSON-RPC)
```

## Verify

```bash
lazytrae doctor    # expect PASS on structure; WARNs are environmental (empty evidence, etc.)
```

## How to use

| Command | Purpose |
|---|---|
| `/lazy-init-deep` | Generate hierarchical project memory |
| `/lazy-ulw-plan` | Decision-complete work plan |
| `/lazy-start-work` | Execute one checklist item at a time |
| `/lazy-ulw-loop` | Verified completion loop (10 states, 13-step cycle) |
| `/lazy-review-work` | 5-agent parallel review gate |
| `/lazy-verifier` `/lazy-reviewer` `/lazy-librarian` | Verify / review / update memory |

**Workflow:** `/lazy-init-deep` → `/lazy-ulw-plan` → `/lazy-start-work` → `/lazy-review-work`. Enforcement is CLI-gated (`lazytrae verify --must-pass`, `mark_task_done`) because Trae hooks can't block — see [lazytrae-evaluation.md](lazytrae-evaluation.md) for the full parity assessment (115/126, 91.3%).

## Developing on this repo (open-source)

This is a practice repo; contributions are welcome as learning exercises. To develop:

1. **Two copies, keep in sync:** `lazytrae-plugin/.trae/` is the live plugin; `lazytrae-plugin/packages/cli/templates/` is the installer source. Edit one, then run `lazytrae sync` to regenerate the other and the AGENTS managed blocks.
2. **Naming discipline:** all skills & commands are `lazy-` prefixed (e.g. `lazy-init-deep`). Keep any new ones prefixed.
3. **Test:** `cd lazytrae-plugin/packages/cli && node --test` (56 tests). ⚠️ ~24 are **pre-existing failures** (security/schema/hook/mcp) that predate the `lazy-` rename — the rename did not cause them (verified at v0.14: 25 failed). See the test report; fixing them is a separate effort.
4. **Verify your change:** `lazytrae doctor` (31 PASS expected) + `node --test`.
5. **Commit:** conventional commits, atomic, stage only files you changed, no `--no-verify`.

## Repository structure

```
lazytrae/
├── lazytrae-plugin/         # installable Trae plugin + CLI + MCP
│   ├── .trae/               #   rules, skills (lazy-*), commands (lazy-*), agents, hooks
│   ├── .lazytrae/           #   schemas and config templates
│   └── packages/            #   cli (Node) + mcp (15 tools, stdio JSON-RPC)
├── docs/                    # design/ reference/ archive/ + setup-guide + versioned plan
├── plan/                    # versioned execution plan (v0.0 → v0.14)
├── prompts/                 # worker delegation + dogfood prompts
├── lazytrae-evaluation.md   # LazyCodex parity assessment
├── README.md                # this onboarding guide
├── LICENSE                  # MIT
└── NOTICE                   # omo/lazycodex provenance
```

## Related

- **[LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy)** — the sibling: the same harness on the WorkBuddy platform. Where LazyTrae moves the completion gate into a CLI layer (Trae hooks can't block), LazyWorkBuddy bets on host hook blocking.

## License

[MIT](LICENSE) — derived from lazycodex/omo, Copyright (c) 2026 Yeongyu Kim. See [NOTICE](NOTICE) for full provenance (omo is SUL-licensed at root; the lazycodex layer used as a local gitignored reference is MIT).

## Disclaimer

Practice project, not production-ready, no longer maintained. Built to study agent-harness adaptation across platforms. For production use, see the [original lazycodex/omo](https://github.com/code-yeongyu/lazycodex).

## Acknowledgments

- **[Yeongyu Kim](https://github.com/code-yeongyu)** — creator of [lazycodex/OmO](https://github.com/code-yeongyu/lazycodex), whose work made this possible
- **[Trae IDE](https://docs.trae.cn/)** — the platform this was built for
