# LazyTrae

> **A practice project: realizing [LazyCodex](https://github.com/code-yeongyu/lazycodex) (the OmO agent harness) on the [Trae](https://docs.trae.cn/) platform.**
>
> This repo is **no longer maintained**. It was built as a learning exercise to study how an agent harness like LazyCodex can be adapted to a different host platform. The entire realization process is open-sourced to help others studying agent-harness design and cross-platform adaptation.

## What This Is

**LazyTrae** is an adaptation of [LazyCodex/omo](https://github.com/code-yeongyu/lazycodex) — the OmO agent harness originally built for OpenAI Codex. It preserves LazyCodex's core workflows (deep init, planning, delegated execution, verification loops, review, durable run state) while reimplementing them on Trae-native surfaces.

LazyTrae runs in **three modes**:

- **Trae IDE** — as a plugin (`.trae/` rules, skills, commands, agents, hooks, MCP)
- **CLI** — `lazytrae init | doctor | verify | loop | team | run | mcp` (Node.js)
- **Trae Work** — SOLO mode for complex project workflows

**Original project credit:** LazyCodex/omo is Copyright (c) 2026 Yeongyu Kim, licensed under MIT. This project derives concepts and semantics from that work but contains no copied source code, prompts, or protected material (the upstream `reference/lazycodex/` clone is a local read-only reference — gitignored, not distributed). See [NOTICE](NOTICE) for full license provenance.

| LazyCodex (Codex) | LazyTrae (Trae) |
|---|---|
| Rules component | `.trae/rules/` directory |
| Skills system | `SKILL.md` files with dynamic loading |
| Slash commands | Trae slash commands |
| Agent roles (TOML) | Custom agents (`.trae/agents/*.md`) |
| Codex hooks (6 events) | Trae hooks (`.trae/hooks/`) |
| MCP servers | `.trae/mcp.json` |
| Durable Codex threads | Ephemeral Trae subagents + file-based state |
| Thread-based team mode | SOLO/subagent delegation + file-based team state |

## Quick Install (Let Trae configure itself)

The easiest way to install: **give this repo to Trae and let an agent handle everything.**

### Option A: Let the agent auto-discover and install

1. **Clone this repo** anywhere on your machine:
   ```bash
   git clone https://github.com/elvinzhao10/Trae.git
   cd Trae
   ```

2. **Open it in Trae IDE** (or Trae Work) and start a new session in the cloned directory.

3. **Paste this prompt to the agent:**
   > Install the LazyTrae plugin from `lazytrae-plugin/` in this repo. Read the plugin manifest, copy `.trae/` (rules, skills, commands, agents, hooks) and `.lazytrae/` (schemas, config) into my project, wire `.trae/mcp.json`, then run `lazytrae doctor` to verify.

4. The agent will:
   - Read the plugin manifest under `lazytrae-plugin/`
   - Install `.trae/` (rules, skills, commands, agents, hooks) and `.lazytrae/` (schemas, config)
   - Wire the MCP server (`.trae/mcp.json`)
   - Run the health check

5. **Verify:**
   ```bash
   cd lazytrae-plugin/packages/cli && npm install
   node src/index.js doctor
   ```
   Expected: all checks PASS (1 WARN for the MCP server is normal).

### Option B: Manual install via CLI

1. **Clone and install the CLI:**
   ```bash
   git clone https://github.com/elvinzhao10/Trae.git
   cd Trae/lazytrae-plugin/packages/cli
   npm install
   ```

2. **Run the installer in your target project:**
   ```bash
   node src/index.js init
   node src/index.js doctor
   ```

3. **(Optional) Install globally:**
   ```bash
   npm link
   lazytrae doctor
   ```

## How to Use

### Core commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `$init-deep` | Generate hierarchical project memory | First time in a new workspace |
| `$ulw-plan` | Create a decision-complete work plan | Before any multi-file or ambiguous change |
| `$start-work` | Execute a plan one checklist item at a time | When a plan is approved and ready to build |
| `$ulw-loop` | Verified completion loop (10 states, 13-step cycle) | For open-ended tasks needing evidence-backed done |
| `$ultrawork` | Binding high-precision mode | When maximum rigor and evidence are required |
| `$review-work` | 5-agent parallel review gate | After every significant implementation |
| `/verifier` | Run verification checks | After implementation, before claiming done |
| `/reviewer` | Review changed files | After verification, before accepting |
| `/librarian` | Update memory after changes | After accepted changes |

### Quick start workflow

```
$init-deep                         # generates project memory
$ulw-plan "implement feature X"   # creates a plan with checkboxes
$start-work                        # executes plan one item at a time + verification
$review-work                       # 5-agent review gate (all must pass)
```

### What Trae gets

| Component | Count | What it does |
|-----------|-------|--------------|
| Skills | 22 | init-deep, ulw-plan, start-work, ulw-loop, verifier, reviewer, librarian, migration-planner, programming, git-master, debugging, remove-ai-slops, refactor, ast-grep, frontend, lcx-report-bug, coding-agent-sessions, … |
| Agents | 11 | Sisyphus, Prometheus, Metis, Momus, Atlas, Hephaestus, Oracle, Explorer, Librarian, Cleaner, Migration-Planner |
| Commands | 10 | Core workflow commands (init-deep → review-work) |
| Hooks | 12 | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, + context-recovery (advisory — Trae can't block) |
| MCP tools | 15 | 9 state/evidence/review/handoff + 6 context (symbol_search, find_references, goto_definition, diagnostics, docs_lookup, dependency_graph) |
| CLI | 11 | init, doctor, sync, verify, handoff, loop (status/cancel/pause/resume), team (create/spawn/collect), run, mcp |

### How enforcement works

The harness is **binding, not advisory** — but because **Trae hooks cannot block** (no deny/block contract), enforcement is moved into a **CLI/MCP layer**:

- **`lazytrae verify --must-pass`** — hard completion gate; refuses to pass until all verification gates are green
- **`mark_task_done` (MCP)** — evidence-gated; an implementer cannot close a task without a recorded verification artifact in `.lazytrae/evidence/`
- **Hooks** — advisory only (`exit 0`); log and surface, but the real block lives in the CLI gate
- **5-agent review** — Goal Verifier, QA Executor, Code Reviewer, Security Auditor, Context Miner — ALL-MUST-PASS

> This is the inverse of the [LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy) sibling, which bets on host hook blocking. Both preserve the Sisyphus "no evidence, no done" invariant — they just pick the mechanism their host allows.

## LazyCodex Parity Evaluation

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

### 4 known gaps (platform limitations)

1. **Hooks advisory-only** — Trae hooks can't block; gate moved to CLI (`lazytrae verify --must-pass`, `mark_task_done`)
2. **PostCompact hook missing** — no Trae event; mitigated via SessionStart/UserPromptSubmit markers
3. **Codegraph MCP unavailable** — heuristic local context tools as fallback
4. **Post-compact recovery** — heuristic, not a native hook

See [lazytrae-evaluation.md](lazytrae-evaluation.md) for strengths, weaknesses, and future improvement suggestions.

## Version History

| Tag | Phase | Key deliverable |
|-----|-------|-----------------|
| `v0.0` | Discovery | LazyCodex method map, Trae host surface map |
| `v0.1` | Architecture | Three-layer model, plugin design, state ledger |
| `v0.2` | Rules & memory | AGENTS.md constitution, `.trae/rules/`, command constitution |
| `v0.3` | Skills & commands | 10 core commands + skills ported from LazyCodex |
| `v0.4` | Custom agents | 11 agent role definitions (`.trae/agents/*.md`) |
| `v0.5` | State machine | Boulder/loop/session state, evidence recording |
| `v0.6` | CLI installer | `lazytrae init` / `doctor` Node CLI |
| `v0.7` | Hooks & enforcement | 12 lifecycle hooks (advisory) + CLI completion gate |
| `v0.8` | MCP tools | 15 MCP tools over stdio JSON-RPC |
| `v0.9` | Long-horizon loop | 10-state, 13-step cycle, retry, checkpointing |
| `v0.10` | Model routing | 6 model categories → Trae Auto/Max + routing hints |
| `v0.11` | Team mode | Parallel-work coordination, worktree isolation, mailbox |
| `v0.12` | Dogfood | End-to-end self-test, 53 tests passing |
| `v0.13` | Diagnostics | Risk register, diagnostics report, fixes |
| `v0.14` | Final release | Parity report (115/126), evaluation doc, alignment with sibling |

> **MVP = v0.0–v0.7.** Strong benchmark = v0.0–v0.14.

## Repository Structure

```
lazytrae/
├── lazytrae-plugin/         # THE installable Trae plugin + CLI + MCP
│   ├── .trae/               #   Trae-native config (rules, skills, commands, agents, hooks)
│   ├── .lazytrae/           #   Schemas and config templates
│   └── packages/            #   CLI and MCP server source code
│       ├── cli/             #   Node.js CLI (init, doctor, sync, loop, team, run, ...)
│       └── mcp/             #   MCP server (15 tools over stdio JSON-RPC)
├── docs/                    # Documentation
│   ├── design/              #   How it works (architecture, state machine, protocols)
│   ├── reference/           #   API/command/MCP/hooks references + parity ledger
│   ├── archive/             #   Superseded/historical docs
│   ├── lazytrae-versioned-execution-plan.md
│   ├── lazytrae-dogfood-run.md
│   └── lazytrae-risk-register.md
├── plan/                    # Versioned execution plan (v0.0 → v0.14)
├── prompts/                 # Worker delegation + dogfood prompts
├── AGENTS.md                # Project constitution (agent entry point)
├── lazytrae-evaluation.md   # LazyCodex parity assessment
├── README.md                # This file
├── LICENSE                  # MIT
└── NOTICE                   # MIT provenance for derived works
```

## Related

- **[LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy)** — the sibling project: the same LazyCodex/OmO harness realized on the WorkBuddy platform. Where LazyTrae moves the completion gate into a CLI layer (Trae hooks can't block), LazyWorkBuddy bets on host hook blocking. Comparing the two is the clearest way to see how host binding — not design — drives divergence.

## License

[MIT](LICENSE) — same license as the original [lazycodex/omo](https://github.com/code-yeongyu/lazycodex).

Portions derived from lazycodex/omo, Copyright (c) 2026 Yeongyu Kim. See [NOTICE](NOTICE) for full provenance.

## Disclaimer

**This is a practice project.** It was built to study how LazyCodex's agent-harness design can be adapted to a different host platform (Trae). The repo is **no longer maintained**.

The entire realization process — including the versioned execution plan (v0.0 → v0.14), worker delegation prompts, diagnostics reports, and a dogfood run — is open-sourced here to help others studying:
- Agent-harness architecture (planning → execution → verification → review → memory)
- Cross-platform adaptation (Codex → Trae tool translation)
- Evidence-based completion (DoneClaim/AdversarialVerify/FullyDone contract)

If you want to use LazyCodex in production, use the [original project](https://github.com/code-yeongyu/lazycodex).

## Acknowledgments

- **[Yeongyu Kim](https://github.com/code-yeongyu)** — creator of [lazycodex/OmO](https://github.com/code-yeongyu/lazycodex), whose MIT-licensed work made this practice project possible
- **[Trae IDE](https://docs.trae.cn/)** — the platform this was built for
