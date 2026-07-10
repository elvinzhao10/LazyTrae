# LazyTrae

> **A practice project:** realizing [LazyCodex](https://github.com/code-yeongyu/lazycodex) (the OmO harness) on the [Trae](https://docs.trae.cn/) platform. No longer maintained; open-sourced for learning.

LazyTrae brings LazyCodex/OmO's disciplined agent-harness workflows (planning → delegated execution → evidence-gated verification → review → durable run state) to Trae. It runs in **Trae IDE**, **Trae Work**, and via the **Trae CLI**.

> **Setup?** See [AGENTS.md](AGENTS.md) (the setup guide). This README is about **how to use** the harness once installed.

## Commands

All commands are `lazy-` prefixed.

| Command | Purpose |
|---|---|
| `/lazy-init-deep` | Generate hierarchical project memory |
| `/lazy-ulw-plan` | Decision-complete work plan |
| `/lazy-start-work` | Execute one checklist item at a time |
| `/lazy-ulw-loop` | Verified completion loop (10 states, 13-step cycle) |
| `/lazy-review-work` | 5-agent parallel review gate |
| `/lazy-verifier` `/lazy-reviewer` `/lazy-librarian` | Verify / review / update memory |
| `/lazy-migration-planner` | Cross-platform migration planning |

## Workflow

```
/lazy-init-deep                         # generate project memory
/lazy-ulw-plan "implement feature X"   # decision-complete plan
/lazy-start-work                        # execute one item at a time + verify
/lazy-review-work                       # 5-agent review gate (all must pass)
```

Five phases, matching LazyCodex: **Explore → Plan → Implement → Verify → Manually QA**. Before any step closes it passes **five evidence gates**: plan reread, automated verification, manual-QA, adversarial QA, cleanup.

## Enforcement

Binding, not advisory — but because **Trae hooks can't block**, the completion gate lives in a CLI/MCP layer:
- `lazytrae verify --must-pass` — refuses to pass until all gates are green.
- `mark_task_done` (MCP) — evidence-gated; no evidence, no done.

> This is the inverse of the [LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy) sibling, which bets on host hook blocking. Both preserve the Sisyphus "no evidence, no done" invariant.

## What's included

| Component | Count | Examples |
|---|---|---|
| Skills | 17 | lazy-init-deep, lazy-ulw-plan, lazy-start-work, lazy-ulw-loop, lazy-verifier, lazy-reviewer, lazy-librarian, lazy-migration-planner, lazy-programming, lazy-git-master, lazy-debugging, lazy-remove-ai-slops, lazy-refactor, lazy-ast-grep, lazy-frontend, lazy-lcx-report-bug, lazy-coding-agent-sessions |
| Agents | 11 | Sisyphus, Prometheus, Metis, Momus, Atlas, Hephaestus, Oracle, Explorer, Librarian, Cleaner, Migration-Planner |
| Commands | 9 | lazy-init-deep, lazy-ulw-plan, lazy-start-work, lazy-ulw-loop, lazy-review-work, lazy-handoff, lazy-ralph-loop, lazy-remove-ai-slops, lazy-stop-continuation |
| MCP tools | 15 | 9 state/evidence/review/handoff + 6 context |
| CLI | 11 | init, doctor, sync, verify, handoff, loop, team, run, mcp |

## Developing on this repo (open-source)

Practice repo; contributions welcome as learning exercises.

1. **Two copies, keep in sync:** `lazytrae-plugin/.trae/` (live plugin) and `lazytrae-plugin/packages/cli/templates/` (installer source). Edit one, run `lazytrae sync` to regenerate the other.
2. **Naming discipline:** all skills & commands are `lazy-` prefixed. Keep new ones prefixed.
3. **Test:** `cd lazytrae-plugin/packages/cli && node --test` (56 tests; 54 pass, 2 are brittle doctor/MCP-output assertions).
4. **Verify:** `lazytrae doctor` (0 FAIL expected) + `node --test`.
5. **Commit:** conventional, atomic, stage only files you changed, no `--no-verify`.

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
├── lazytrae-evaluation.md   # LazyCodex parity assessment (115/126, 91.3%)
├── AGENTS.md                # setup guide
├── README.md                # this file (how to use)
├── LICENSE                  # MIT
└── NOTICE                   # omo/lazycodex provenance
```

## Related

- **[LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy)** — the sibling: the same harness on WorkBuddy. LazyTrae gates via CLI (Trae hooks can't block); LazyWorkBuddy gates via host hooks.

## License

[MIT](LICENSE) — derived from lazycodex/omo, Copyright (c) 2026 Yeongyu Kim. See [NOTICE](NOTICE) (omo is SUL at root; the lazycodex layer used as a local gitignored reference is MIT).

## Disclaimer

Practice project, not production-ready, no longer maintained. For production use, see the [original lazycodex/omo](https://github.com/code-yeongyu/lazycodex).

## Acknowledgments

- **[Yeongyu Kim](https://github.com/code-yeongyu)** — creator of [lazycodex/OmO](https://github.com/code-yeongyu/lazycodex)
- **[Trae](https://docs.trae.cn/)** — the platform this was built for
