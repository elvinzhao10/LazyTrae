# LazyTrae

> **A Trae-native recreation of the [LazyCodex](https://github.com/oh-my-openagent/omo) / OmO agent harness.**
>
> This is a **practice project** that attempts to realize LazyCodex workflows on the [Trae IDE](https://docs.trae.cn/) platform. The entire realization process is open-sourced here to help others study how agent harnesses work and how they can be adapted across platforms.
>
> **This repo is no longer maintained.** It served its purpose as a learning exercise. The code, docs, and parity analysis remain available for reference.

---

## What This Is

[LazyCodex](https://github.com/oh-my-openagent/omo) (also known as OmO) is an agent harness for OpenAI Codex that provides disciplined long-horizon workflows: planning loops, evidence-gated verification, agent role specialization, and a self-referential execution loop.

**LazyTrae** recreates that experience on Trae IDE using Trae-native mechanisms:

| LazyCodex (Codex) | LazyTrae (Trae) |
|---|---|
| Rules component | `.trae/rules/` directory |
| Skills system | `SKILL.md` files with dynamic loading |
| Slash commands | Trae slash commands |
| Agent roles (TOML) | Custom agents (`.trae/agents/*.md`) |
| Codex hooks (6 events) | Trae hooks (`.trae/hooks/`) |
| MCP servers | `.trae/mcp.json` |
| Thread-based team mode | SOLO/subagent delegation + file-based team state |

The canonical LazyCodex source was cloned into `reference/lazycodex/` (MIT-licensed, not included in the repo — see [NOTICE](NOTICE) for provenance).

---

## Repository Structure

```
lazytrae/
├── README.md                # You are here
├── LICENSE                  # MIT
├── NOTICE                   # MIT provenance (lazycodex/omo, © 2026 Yeongyu Kim)
├── AGENTS.md                # Project constitution
├── .gitignore
│
├── lazytrae-plugin/         # The installable plugin
│   ├── .trae/               # Trae-native config (rules, skills, commands, agents, hooks)
│   ├── .lazytrae/           # Schemas and config templates
│   └── packages/            # CLI and MCP server source code
│       ├── cli/             # Node.js CLI (init, doctor, sync, loop, team, run, ...)
│       └── mcp/             # MCP server (15 tools over stdio JSON-RPC)
│
├── docs/                    # Documentation
│   ├── design/              # How it works (architecture, state machine, protocols)
│   ├── reference/           # API/command/MCP/hooks references + parity ledger
│   ├── archive/             # Superseded/historical docs
│   ├── lazytrae-versioned-execution-plan.md
│   ├── lazytrae-dogfood-run.md
│   └── lazytrae-risk-register.md
│
├── plan/                    # Versioned execution plan (v0.0 through v0.14)
├── prompts/                 # Worker delegation prompts (v0.1–v0.12)
└── other/                   # Runtime state samples, evidence, .omo mirror
```

---

## How to Install

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Trae IDE](https://docs.trae.cn/) (for the agent harness to run in)

### Steps

1. **Clone this repo:**
   ```bash
   git clone https://github.com/<your-org>/lazytrae.git
   cd lazytrae
   ```

2. **Install CLI dependencies:**
   ```bash
   cd lazytrae-plugin/packages/cli
   npm install
   ```

3. **Run the installer in your target project:**
   ```bash
   node src/index.js init
   ```
   This copies `.trae/` (rules, skills, commands, agents, hooks), `.lazytrae/` (schemas, config), and sets up the MCP server.

4. **Verify the installation:**
   ```bash
   node src/index.js doctor
   ```
   Expected: all checks PASS (1 WARN for MCP server is normal).

5. **(Optional) Install globally:**
   ```bash
   npm link
   lazytrae doctor
   ```

---

## How to Use

### Core Workflow

LazyTrae follows five phases, matching LazyCodex:

1. **Explore** — Run `$init-deep` to understand the codebase and generate `AGENTS.md`
2. **Plan** — Run `$ulw-plan` for a Socratic planning interview that produces a decision-complete plan
3. **Implement** — Run `$start-work` to execute one checklist item at a time
4. **Verify** — Automated tests + manual-QA + adversarial QA + cleanup
5. **Manually QA** — Real-surface proof (CLI output, HTTP responses, file contents)

### Long-Horizon Loop

For complex multi-step tasks, run `$ulw-loop`:

```
$ulw-loop "Add authentication with JWT tokens"
```

This starts a self-referential loop with:
- 10 states (idle → initializing → planning → active → verifying → reviewing → complete)
- 13-step cycle per task
- Retry with 3 max retries on verification failure
- Oracle reviewer with APPROVE/ITERATE/REJECT verdicts
- Checkpointing and resumption after interruption
- 500 iteration cap (HEAVY) / 100 (LIGHT)

### CLI Commands

```bash
lazytrae init                    # Install plugin into current project
lazytrae doctor                  # Health check
lazytrae sync                    # Sync templates
lazytrae verify                  # Run verification
lazytrae verify --must-pass      # Hard completion gate
lazytrae handoff                 # Generate handoff summary
lazytrae loop status             # Check loop state
lazytrae loop cancel             # Cancel active loop
lazytrae loop pause/resume       # Pause/resume loop
lazytrae team create             # Create a parallel-work team
lazytrae team spawn              # Add a team member
lazytrae team collect            # Collect member reports
lazytrae run --agent oracle --category ultrabrain "review current diff"
lazytrae mcp                     # Start MCP server
```

### Agent Roles

| Agent | Role | Read-only |
|---|---|---|
| Sisyphus | Main orchestrator | No |
| Prometheus | Strategic planner | Yes |
| Metis | Pre-planning gap analyst | Yes |
| Momus | Plan reviewer | Yes |
| Atlas | Task executor (light) | No |
| Hephaestus | Deep worker (heavy) | No |
| Oracle | Reviewer/gate keeper | Yes |
| Explorer | Codebase search | Yes |
| Librarian | External docs researcher | Yes |
| Cleaner | AI slop remover | No |

### MCP Tools (15)

The MCP server provides 15 tools over stdio JSON-RPC:

**State tools:** `get_active_plan`, `get_boulder_status`, `get_next_task`, `get_parity_status`

**Evidence tools:** `record_evidence`, `mark_task_done` (evidence-gated)

**Review tools:** `add_blocker`, `request_review`

**Handoff tools:** `generate_handoff`

**Context tools:** `symbol_search`, `find_references`, `goto_definition`, `diagnostics`, `docs_lookup`, `dependency_graph`

---

## Evaluation: How Much of LazyCodex Is Achieved?

**Overall: 115/126 (91.3%).** Core workflow semantics fully ported; the 4 remaining gaps are all platform-inherent (Trae hook event / external tool), each mitigated. See [lazytrae-evaluation.md](lazytrae-evaluation.md) for the full assessment.

### Summary

| Category | Total | Complete | Gap | N/A |
|---|---|---|---|---|
| Core Commands | 10 | 10 | 0 | 0 |
| Agent Roles | 11 | 11 | 0 | 0 |
| Hooks | 16 | 12 | 2 | 1 |
| State Management | 15 | 15 | 0 | 0 |
| Verification Gates | 7 | 7 | 0 | 0 |
| MCP Servers | 6 | 5 | 1 | 0 |
| Model Routing | 7 | 6 | 0 | 1 |
| Skills (Shared) | 22 | 22 | 0 | 0 |
| Ultrawork/ulw-loop Core | 15 | 14 | 0 | 1 |
| Rules Component | 10 | 7 | 1 | 1 |
| Team Mode | 7 | 6 | 0 | 1 |
| **Total** | **126** | **115** | **4** | **5** |

### What's fully achieved

- All 10 core commands, 11 agent roles, 7 verification gates, 15 state-management items, 22 skills
- 15 MCP tools (9 state/evidence/review/handoff + 6 context)
- Long-horizon loop (10 states, 13-step cycle, retry, checkpointing, steering)
- Team mode with worktree isolation; model routing (6 categories)

### 4 known gaps (platform limitations)

1. **Hooks advisory-only** — Trae hooks can't block; gate moved to CLI (`lazytrae verify --must-pass`, `mark_task_done`)
2. **PostCompact hook missing** — no Trae event; mitigated via SessionStart/UserPromptSubmit markers
3. **Codegraph MCP unavailable** — heuristic local context tools as fallback
4. **Post-compact recovery** — heuristic, not a native hook

See [lazytrae-evaluation.md](lazytrae-evaluation.md) for strengths, weaknesses, creative adaptations, and future improvement suggestions.

---

## Related

- **[LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy)** — the sibling project: the same LazyCodex/OmO harness realized on the WorkBuddy platform. Where LazyTrae moves the completion gate into a CLI layer (Trae hooks can't block), LazyWorkBuddy bets on host hook blocking. Comparing the two is the clearest way to see how host binding — not design — drives divergence.

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE).

Portions are derived from [lazycodex / oh-my-openagent (omo)](https://github.com/oh-my-openagent/omo), Copyright (c) 2026 Yeongyu Kim, also licensed under MIT. See [NOTICE](NOTICE) for full provenance.

---

## Disclaimer

This is a **practice project** created to study how agent harnesses like LazyCodex/OmO work and how they can be adapted to a different platform (Trae IDE). It is **not production-ready** and **will no longer be maintained**.

The entire realization process — including the versioned execution plan (14 versions from v0.0 to v0.14), worker delegation prompts, diagnostics reports, and a dogfood run — is open-sourced here to help others learn:

- How to map agent harness concepts across platforms
- How to build a Trae-native plugin (rules, skills, commands, agents, hooks, MCP)
- How to achieve parity verification with an upstream project
- How to structure a multi-version execution plan

If you want to use LazyCodex in production, use the [original project](https://github.com/oh-my-openagent/omo). If you want to build a Trae-native agent harness, use this repo as a reference and starting point.

---

## Acknowledgments

- **[Yeongyu Kim](https://github.com/yoelkim)** — creator of [lazycodex/OmO](https://github.com/oh-my-openagent/omo), whose MIT-licensed work made this practice project possible
- **[Trae IDE](https://docs.trae.cn/)** — the platform this was built for
