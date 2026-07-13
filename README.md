# LazyTrae

> **A practice project:** a workflow harness for the [Trae](https://docs.trae.cn/) platform. No longer maintained; open-sourced for learning.

LazyTrae provides disciplined agent-harness workflows (planning → delegated execution → evidence-gated verification → review → durable run state) for **Trae IDE**, **Trae Work**, and **Trae CLI**.

Current LazySeries tooling release: **v0.16.0-alpha.1**. Its package checks are verified on macOS only; other operating systems remain unverified.

> **Setup?** See [AGENTS.md](AGENTS.md) (the setup guide). This README is about **how to use** the harness once installed.

## Onboard with AI

1. Copy or clone [github.com/elvinzhao10/LazyTrae](https://github.com/elvinzhao10/LazyTrae) into a local folder.
2. Open that folder in your Trae host and type `onboard`.

The agent reads `AGENTS.md`, asks which installed host you use (**Trae IDE**, **Trae Work**, or **Trae CLI**), and performs the matching safe steps. `lazytrae init --host <host>` ends with a **package-readiness** check: 17 skills, 9 commands, 11 agents, 8 hook scripts mapped to 5 events, and 8 MCP declarations. The base MCP configuration has one executable core server (`lazytrae`) and seven disabled placeholders. It cannot prove host discovery, a loaded plugin, or an MCP connection. The `lazytrae` declaration exposes 15 tools only after its server connects. Trae Work's built-in global-skills location is documented and tested only for macOS; reload/discovery and all non-macOS locations remain manual and unverified.

After onboarding, you can delete the copied repository if you only needed the installed setup, or keep it to explore and study how LazyTrae works.

## LazySeries tooling

The v0.16 tooling foundation is package-owned and always explicit about
ownership. A capability request may temporarily provision safe local search
tools in the private receipt-owned toolpack; it never changes a project MCP
file, lockfile, dependencies, or host configuration. Use `rg` for local text/file search and `sg` for structural search.
Use the read-only LSP bridge for definitions, references, symbols, hover, and
diagnostics in supported JavaScript/TypeScript or Python projects. Use
CodeGraph only after an explicit architecture or dependency-tracing request;
it requires the explicit caller action `lazytrae tooling codegraph-init` and a
separate receipt-owned tooling root. Context7, `grep_app`, filesystem, and
Playwright are selected through the capability contract and respect its approval,
cost, egress, and timeout limits. CodeGraph and Playwright require approval;
authenticated browser actions, forms, external writes, purchases, destructive
actions, and secret reads always require a new approval.

```bash
# Provision only missing local search tools in a caller-owned empty directory.
lazytrae tooling install --tooling-root /absolute/lazytrae-tools
lazytrae tooling status --tooling-root /absolute/lazytrae-tools

# Detect native checks first; run a selected declared check only when requested.
lazytrae tooling verify --dry-run
lazytrae tooling verify --run test

# Inspect redacted provider/approval readiness without consuming a credential.
lazytrae setup --non-interactive --json
lazytrae providers --json
lazytrae providers test --json
```

`lazytrae tooling enable <capability>` is a separate legacy compatibility path:
it is the only command that persists a namespaced optional MCP selection in the
project. It is never performed by onboarding, InitDeep, doctor, or automatic
capability routing. Configure a provider only with an opaque credential reference
using `lazytrae providers configure`; provider status and doctor redact values.
Metered providers are unavailable automatically unless the request has an
explicit bounded budget. `lazytrae tooling uninstall` removes only an
unmodified receipt-owned tooling root and never guesses a host path.

## Uninstall safely

Review the command in the initialized project, then choose the required project-removal scope:

```bash
lazytrae uninstall --help
lazytrae uninstall --yes                # remove only exact managed assets; preserve normal runtime data
lazytrae uninstall --yes --soft         # remove verified .trae/ assets only
lazytrae uninstall --yes --purge-state  # also remove only exact runtime templates
```

The command preserves modified or unknown project files and never unregisters an MCP server. On macOS, remove global skills with `lazytrae work uninstall`; it removes only unmodified LazyTrae skill folders and preserves edited or nonempty folders. Then remove the `lazytrae` server manually in **Settings → MCP**. For Linux or Windows, host locations and behavior are unverified: use `lazytrae work uninstall --skills-dir <host-reported-directory>` only after manually confirming the location. For Trae CLI, remove the separately registered server with `trae-cli mcp remove lazytrae`. Remove the global companion command with `npm uninstall -g lazytrae-ai` only after no host configuration references `lazytrae mcp`.

## A first task, from request to evidence

Start by describing the outcome and how you will recognize success, not the commands you think the agent should run. For example:

> Add project search. Results must work on a real project, have tests, and be checked in the UI before you call it done.

For a small, well-bounded change, ask normally. The agent should select the relevant skills from the task. For a larger or uncertain task, use this path:

```text
/lazy-init-deep                         # once for a new or unfamiliar repository
/lazy-ulw-plan "add project search"    # explore, decide, and write the plan
# review and approve the plan
/lazy-start-work                        # execute one planned item at a time
/lazy-review-work                       # independently review significant work
```

Use `/lazy-ulw-loop "goal"` only when the outcome is long-running or open-ended and needs checkpoints. Finish any meaningful change with the real user surface as well as automated checks: run the CLI, use the page, or exercise the API. A passing test alone is evidence, not the whole result.

## Choosing skills and commands

Skills are the agent's playbooks. You normally invoke them by stating the job in plain language; use a slash command when you want to force a particular workflow.

| Situation | Say or run | Why |
|---|---|---|
| New or confusing repository | `/lazy-init-deep` | Builds project memory and local instructions before work starts. |
| Multi-file, ambiguous, or architectural work | `/lazy-ulw-plan "…"` | Produces a decision-complete plan before changing code. |
| An approved plan | `/lazy-start-work` | Executes the plan with state and evidence. |
| A bug | “Debug why … fails” | Selects the debugging playbook: reproduce, form hypotheses, then fix and prove it. |
| Behavior-preserving cleanup | “Refactor … without changing behavior” | Uses the refactor discipline; keep verification in place. |
| Git work | “Commit these changes” | Uses the Git workflow to inspect, stage, and commit intentionally. |
| A large finished change | `/lazy-review-work` | Runs independent goal, QA, quality, security, and context review. |
| A long-running goal | `/lazy-ulw-loop "…"` | Keeps durable state and continues until evidence proves completion. |

The mindset is simple: choose the **smallest** workflow that matches the risk, make acceptance criteria explicit, and do not accept “done” without observable evidence. The agent should ask for a decision only when it genuinely needs the project owner's choice.

## Commands

All workflow commands are `lazy-` prefixed. The main controls are `/lazy-init-deep`, `/lazy-ulw-plan`, `/lazy-start-work`, `/lazy-ulw-loop`, and `/lazy-review-work`. Supporting skills such as `lazy-verifier`, `lazy-reviewer`, `lazy-librarian`, and `lazy-migration-planner` are selected from natural-language requests for verification, review, memory, and platform adaptation. On Trae Work, run `lazytrae work install` once to install those skills globally, then use skills or natural language because the host has no global command registry.

## Enforcement

Binding, not advisory — but because **Trae hooks can't block**, the completion gate lives in a CLI/MCP layer:
- `lazytrae verify --must-pass` — refuses to pass until all gates are green.
- `mark_task_done` (MCP) — evidence-gated; no evidence, no done.

> This is the inverse of the [LazyBuddy](https://github.com/elvinzhao10/LazyBuddy) sibling, which bets on host hook blocking. Both preserve the Sisyphus "no evidence, no done" invariant.

## What's included

| Component | Count | Examples |
|---|---|---|
| Skills | 17 | lazy-init-deep, lazy-ulw-plan, lazy-start-work, lazy-ulw-loop, lazy-verifier, lazy-reviewer, lazy-librarian, lazy-migration-planner, lazy-programming, lazy-git-master, lazy-debugging, lazy-remove-ai-slops, lazy-refactor, lazy-ast-grep, lazy-frontend, lazy-lcx-report-bug, lazy-coding-agent-sessions |
| Agents | 11 | Sisyphus, Prometheus, Metis, Momus, Atlas, Hephaestus, Oracle, Explorer, Librarian, Cleaner, Migration-Planner |
| Commands | 9 | lazy-init-deep, lazy-ulw-plan, lazy-start-work, lazy-ulw-loop, lazy-review-work, lazy-handoff, lazy-ralph-loop, lazy-remove-ai-slops, lazy-stop-continuation |
| MCP tools | 15 | 9 state/evidence/review/handoff + 6 context |
| CLI | 17 | init, doctor, sync, uninstall, verify, completion-status, handoff, hook, mcp, loop, run, team, work, tooling, lsp, codegraph, load-check |

## Developing on this repo (open-source)

Practice repo; contributions welcome as learning exercises.

1. **Two configuration trees:** work in `lazytrae-plugin/.trae/` for Trae integration and `lazytrae-plugin/.lazytrae/` for all LazyTrae configuration and workflow data. Consumer projects store plans in `.lazytrae/plans/` and per-run loop files in `.lazytrae/loop/`. `lazytrae-plugin/packages/cli/templates/` remains the installer source; run `lazytrae sync` to regenerate the live project tree.
2. **Naming discipline:** all skills & commands are `lazy-` prefixed. Keep new ones prefixed.
3. **Test:** `cd lazytrae-plugin/packages/cli && node --test`.
4. **Verify:** `lazytrae doctor` (0 FAIL expected) + `node --test`.
5. **Commit:** conventional, atomic, stage only files you changed, no `--no-verify`.

## Repository structure

```
lazytrae/
├── lazytrae-plugin/         # installable Trae plugin + CLI + MCP
│   ├── .trae/               #   Trae IDE config; source for Trae Work global skills
│   ├── .lazytrae/           #   LazyTrae schemas and configuration templates
│   └── packages/            #   cli (Node) + mcp (15 tools, stdio JSON-RPC)
├── docs/                    # current v0.16.0-alpha.1 learning entrypoints
├── lazytrae-evaluation.md   # v0.16.0-alpha.1 implementation evidence and limitations
├── AGENTS.md                # setup guide
├── README.md                # this file (how to use)
├── LICENSE                  # MIT
└── NOTICE                   # attribution and provenance
```

Consumer projects initialized with `lazytrae init` receive `.lazytrae/plans/` and `.lazytrae/loop/` as their runtime workspace. They are not part of the `lazytrae-plugin/` source layout.

## Related

- **[LazyBuddy](https://github.com/elvinzhao10/LazyBuddy)** — the sibling: the same harness on WorkBuddy. LazyTrae gates via CLI (Trae hooks can't block); LazyBuddy gates via host hooks.

## License

[MIT](LICENSE) — see [NOTICE](NOTICE) for attribution and provenance details.

## Disclaimer

Practice project, not production-ready, and no longer maintained.

## Acknowledgments

- **[Trae](https://docs.trae.cn/)** — the platform this was built for
