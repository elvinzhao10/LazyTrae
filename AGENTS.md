# AGENTS.md — LazyTrae Project Constitution

> **LazyTrae** is a Trae-native recreation of LazyCodex/OmO workflows.
> This file is the first thing an AI agent reads when opening this repository.

## What This Project Is

LazyTrae recreates the LazyCodex/OmO agent harness experience on Trae IDE. It uses Trae-native mechanisms (Rules, Skills, Commands, Custom Agents, Hooks, MCP, SOLO/Subagents) to deliver the same workflow semantics as LazyCodex does on Codex.

The canonical source of truth is the LazyCodex repo cloned at `reference/lazycodex/` in this worktree. Historical parity tables may still use logical source paths beginning with `lazycodex/...`; resolve those paths under `reference/lazycodex/` before verification. All LazyCodex behavior must be verified against actual source files, not memory.

## Repository Layout

```
lazytrae/
  AGENTS.md              ← You are here
  plan/                  ← Versioned execution plan (v0.0 through v0.14)
  reference/lazycodex/   ← Cloned LazyCodex repo (canonical source, read-only reference)
```

## Operating Rules

### Inspect Before Editing
- Always read the actual LazyCodex source files before implementing any feature.
- Never invent LazyCodex behavior from memory.
- The `reference/lazycodex/` directory is the canonical source of truth in this worktree.

### Plan Before Multi-File Changes
- Use the versioned plan files as the execution guide.
- Follow versions in order: v0.0 -> v0.1 -> ... -> v0.14.
- Each version has objective, deliverables, steps, verification, and rollback.

### Preserve LazyCodex Semantics
- Keep command names (`init-deep`, `ulw-plan`, `start-work`, `ulw-loop`) where they communicate parity.
- Preserve workflow phases: Explore -> Plan -> Implement -> Verify -> Manually QA.
- Preserve the five evidence gates: plan reread, automated verification, manual-QA, adversarial QA, cleanup.
- Document any deviation from LazyCodex semantics.

### Execute One Checklist Item at a Time
- During `start-work`, execute one plan checkbox at a time.
- Never batch multiple tasks in a single step.
- Reconcile every plan step: completed, blocked (reason), or removed (reason).

### Verification Evidence Required
- Completion is invalid without evidence.
- Evidence includes: commands run, outputs, exit status, changed files, manual checks, reviewer findings.
- Never claim parity without evidence.

### Reviewer/Oracle Review Required
- Long-horizon completion requires reviewer/Oracle pass.
- Reviewer should be read-only by default.
- A child agent saying "done" does not close the work.

### Update Memory After Changes
- After accepted changes, update AGENTS.md, command index, and parity ledger.
- Keep the parity ledger current with implementation status.

## Trae-Native Capabilities (verified from docs.trae.cn)

| Capability | Mechanism | LazyCodex Equivalent |
| --- | --- | --- |
| Rules | `.trae/rules/` directory, project rules | rules component |
| Skills | `SKILL.md` files, dynamic on-demand loading | skills system |
| Commands | Slash commands | `$init-deep`, `$ulw-plan`, `$start-work`, `$ulw-loop` |
| Custom Agents | Prompts + MCP + built-in tools, callable by other agents | agent roles |
| Subagents | Built-in Agent can call custom agents with independent context | parallel explore subagents |
| Hooks | `hooks.json`, 6 events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, Notification | Codex hooks |
| MCP | `.trae/mcp.json` | MCP servers |
| SOLO Mode | TRAE Work, complex project workflows | Team Mode |
| Memory | Project-level persistent context | AGENTS.md project memory |

### Known Gap: PostCompact Hook

Trae does not have a PostCompact hook event. LazyCodex uses PostCompact for cache resets and rule re-injection. LazyTrae must handle this via:
- SessionStart detection of compaction
- UserPromptSubmit context-pressure markers

## Quick Reference: LazyCodex Source Paths

| What | Where |
| --- | --- |
| Entry point | `reference/lazycodex/bin/lazycodex-ai.js` |
| Plugin root | `reference/lazycodex/plugins/omo/` |
| Components | `reference/lazycodex/plugins/omo/components/` |
| Agent roles | `reference/lazycodex/plugins/omo/components/ultrawork/agents/*.toml` |
| Hooks | `reference/lazycodex/plugins/omo/components/*/hooks/hooks.json` |
| Skills | `reference/lazycodex/plugins/omo/components/*/skills/*/SKILL.md` |
| Shared skills | `reference/lazycodex/plugins/omo/skills/*/SKILL.md` |
| MCP config | `reference/lazycodex/plugins/omo/.mcp.json` |
| Model catalog | `reference/lazycodex/plugins/omo/model-catalog.json` |
| Web docs | `reference/lazycodex/packages/web/content/docs/*.md` |
| ulw-loop source | `reference/lazycodex/plugins/omo/components/ulw-loop/src/` |
| ultrawork source | `reference/lazycodex/plugins/omo/components/ultrawork/src/` |
| rules source | `reference/lazycodex/plugins/omo/components/rules/src/` |

## Quick Reference: LazyTrae Docs

| What | Where |
| --- | --- |
| Architecture plan | `docs/lazytrae-architecture-plan.md` |
| Parity ledger | `docs/lazytrae-parity-ledger.md` |
| Operating manual | `docs/lazytrae-operating-manual.md` |
| Command index | `docs/lazytrae-command-index.md` |
| Versioned execution plan | `docs/lazytrae-versioned-execution-plan.md` |
| Verification matrix | `docs/lazytrae-verification-matrix.md` |
| Risk register | `docs/lazytrae-risk-register.md` |

---

---

---

## LazyTrae Operating Manual

> For detailed operating procedures, see `docs/lazytrae-operating-manual.md`.

### Workflow Phases

Every LazyTrae execution follows five phases:

1. **Explore** — Understand the codebase before making changes. Use `reference/lazycodex/` as the canonical source of truth. Run read-only subagents for parallel exploration.
2. **Plan** — Read the versioned plan file. Generate a decision-complete plan with references, acceptance criteria, and commit boundaries. Never implement during planning.
3. **Implement** — Execute one checklist item at a time. Read the actual LazyCodex source before implementing. Preserve LazyCodex semantics. Never batch multiple tasks.
4. **Verify** — Run automated verification (tests, linters, type checks, builds). Produce manual-QA evidence. Pass adversarial QA. Clean up AI slop.
5. **Manually QA** — Real-surface proof: CLI output, HTTP responses, file contents, terminal sessions. Evidence must be concrete, not claimed.

### The Five Evidence Gates

Before any step can close, it must pass five gates:

1. **Plan reread** — Re-read the plan before claiming completion. Does the implementation match the specification?
2. **Automated verification** — Tests, linters, type checks, builds. No regressions.
3. **Manual-QA** — Real-surface proof through channels: HTTP, tmux, browser, CLI, data.
4. **Adversarial QA** — Edge cases, regression scenarios, adversarial inputs. Try to break it.
5. **Cleanup** — Remove AI slop, dead code, unused imports, stale comments.

### How to Use the Command Index

- See `docs/lazytrae-command-index.md` for the full table of canonical LazyCodex commands and their LazyTrae equivalents.
- Each command entry includes: original name, source path, LazyTrae equivalent, implementation status, and notes.
- Before implementing any command, verify its semantics against the LazyCodex source.

### How to Update the Parity Ledger

- See `docs/lazytrae-parity-ledger.md` for the full ledger.
- After implementing any feature, update the status in the parity ledger.
- Statuses: COMPLETE, PARTIAL, DESIGN, DEFERRED, N/A.
- Every status change must cite evidence (files changed, tests run, verification output).

### How to Record Evidence

- Evidence goes in `.lazytrae/evidence/` (once the runtime is implemented).
- For now, evidence is recorded in the version plan file and commit messages.
- Evidence includes: commands run, outputs, exit status, changed files, manual checks, reviewer findings.

### How to Handle Blockers and Failures

- If a task cannot be completed, mark it as blocked with a reason.
- Blockers are documented in the plan file and the parity ledger.
- Never silently skip a task. Every plan step is reconciled: completed, blocked (reason), or removed (reason).

### Handoff Format

When handing off a session, produce a summary containing:
- What was accomplished this session
- Current state of the plan (what's done, what's blocked, what's next)
- Evidence produced
- Remaining gaps
- Next prompt to paste

---

---

## Git Workflow

- Use conventional commits.
- Keep commits atomic.
- Each commit's tests and build must pass on its own.
- Stage only the files you changed.
- No `git add -A` or `git add .`.
- No `git commit --no-verify`.
- No force pushes.


<!-- lazytrae:managed:start:version-numbering -->
## Version Numbering

All versions use the `v0.x` scheme. This is the **version 0 build**.

- v0.0 = canonical discovery
- v0.1 = architecture
- v0.2 = rules/memory
- ...
- v0.13 = diagnostics/fixes
- v0.14 = final release

Do not use `v1.x`, `v2.x`, etc. The entire 14-step plan is under the v0.x umbrella.
<!-- lazytrae:managed:end:version-numbering -->

<!-- lazytrae:managed:start:plan-files -->
### Plan Files

Each file in `plan/` is one version of the execution plan:

| File | Version | Focus |
| --- | --- | --- |
| `v0.0-overview.md` | v0.0 | Product definition, strategy, repo structure, parity map |
| `v0.0-canonical-discovery.md` | v0.0 | Discover the canonical LazyCodex contract |
| `v0.1-architecture-parity.md` | v0.1 | Architecture and parity design |
| `v0.2-rules-memory.md` | v0.2 | Project constitution, rules, and memory |
| `v0.3-skills-commands.md` | v0.3 | Skills and command workflows |
| `v0.4-custom-agents.md` | v0.4 | Custom agents and role specialization |
| `v0.5-state-machine.md` | v0.5 | Runtime state machine |
| `v0.6-cli-installer.md` | v0.6 | CLI installer and doctor |
| `v0.7-hooks-enforcement.md` | v0.7 | Hooks and enforcement |
| `v0.8-mcp-tools.md` | v0.8 | MCP and tool integration |
| `v0.9-long-horizon-loop.md` | v0.9 | Long-horizon execution loop |
| `v0.10-model-routing.md` | v0.10 | Model routing and optional runner |
| `v0.11-team-mode.md` | v0.11 | Team mode / parallel work |
| `v0.12-dogfood.md` | v0.12 | Dogfood run |
| `v0.13-diagnostics-fixes.md` | v0.13 | Diagnostics and fixes |
| `v0.14-final-release.md` | v0.14 | Final parity report and release |
<!-- lazytrae:managed:end:plan-files -->

<!-- lazytrae:managed:start:command-index -->
## Command Index

Every canonical LazyCodex method from v0.0 discovery appears here or is explicitly deferred.
See `docs/lazytrae-command-index.md` for the full reference table.

### Core Commands

| # | LazyCodex Method | LazyCodex Source | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `$init-deep` | `lazycodex/packages/web/content/docs/init-deep.md` | init-deep command + skill | `.trae/commands/init-deep.md`, `.trae/skills/init-deep/SKILL.md` | COMPLETE | v0.3 |
| 2 | `$ulw-plan` | `lazycodex/packages/web/content/docs/ulw-plan.md` | ulw-plan command + skill + Prometheus agent | `.trae/commands/ulw-plan.md`, `.trae/skills/ulw-plan/SKILL.md`, `.trae/agents/prometheus.md` | COMPLETE | v0.3 |
| 3 | `$start-work` | `lazycodex/packages/web/content/docs/start-work.md` | start-work command + skill + Atlas agent | `.trae/commands/start-work.md`, `.trae/skills/start-work/SKILL.md`, `.trae/agents/atlas.md` | COMPLETE | v0.3 |
| 4 | `$ulw-loop` | `lazycodex/packages/web/content/docs/ulw-loop.md` | ulw-loop command + skill + loop state machine | `.trae/commands/ulw-loop.md`, `.trae/skills/ulw-loop/SKILL.md`, `.lazytrae/state/active-loop.json` | COMPLETE | v0.3 |
| 5 | `$ralph-loop` | `lazycodex/packages/web/content/docs/ulw-loop.md` (alias) | ralph-loop command | `.trae/commands/ralph-loop.md` | COMPLETE | v0.3 |
| 6 | `/stop-continuation` | `lazycodex/packages/web/content/docs/` (referenced) | stop-continuation command + CLI | `.trae/commands/stop-continuation.md`, `lazytrae loop cancel` | COMPLETE | v0.3 |
| 7 | `/handoff` | `lazycodex/packages/web/content/docs/` (referenced) | handoff command + CLI | `.trae/commands/handoff.md`, `lazytrae handoff` | COMPLETE | v0.3 |
| 8 | `review-work` | `lazycodex/packages/web/content/docs/` (referenced) | review-work command + reviewer skill + Oracle agent | `.trae/commands/review-work.md`, `.trae/skills/reviewer/SKILL.md`, `.trae/agents/oracle.md` | COMPLETE | v0.3 |
| 9 | `remove-ai-slops` | `lazycodex/packages/web/content/docs/` (referenced) | remove-ai-slops command + skill + Cleaner agent | `.trae/commands/remove-ai-slops.md`, `.trae/skills/remove-ai-slops/SKILL.md`, `.trae/agents/cleaner.md` | COMPLETE | v0.3 |

### Agent Roles

| # | Role | LazyCodex Source | LazyTrae Agent | Status | Version |
| --- | --- | --- | --- | --- | --- |
| 10 | Explorer | `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` | `.trae/agents/explorer.md` | COMPLETE | v0.4 |
| 11 | Librarian | `lazycodex/plugins/omo/components/ultrawork/agents/librarian.toml` | `.trae/agents/librarian.md` + skill | COMPLETE | v0.4 |
| 12 | Plan (Prometheus) | `lazycodex/plugins/omo/components/ultrawork/agents/plan.toml` | `.trae/agents/prometheus.md` | COMPLETE | v0.4 |
| 13 | Metis | `lazycodex/plugins/omo/components/ultrawork/agents/metis.toml` | `.trae/agents/metis.md` | COMPLETE | v0.4 |
| 14 | Momus | `lazycodex/plugins/omo/components/ultrawork/agents/momus.toml` | `.trae/agents/momus.md` | COMPLETE | v0.4 |
| 15 | Atlas (executor) | `lazycodex/packages/web/content/docs/discipline-agents.md` | `.trae/agents/atlas.md` | COMPLETE | v0.4 |
| 16 | Hephaestus | `lazycodex/packages/web/content/docs/discipline-agents.md` | `.trae/agents/hephaestus.md` | COMPLETE | v0.4 |
| 17 | Oracle (reviewer) | `lazycodex/packages/web/content/docs/discipline-agents.md` | `.trae/agents/oracle.md` | COMPLETE | v0.4 |
| 18 | Sisyphus (orchestrator) | Implicit in LazyCodex workflow | `.trae/agents/sisyphus.md` | COMPLETE | v0.4 |

### Hooks

| # | Hook | LazyCodex Source | LazyTrae Hook | Status | Version |
| --- | --- | --- | --- | --- | --- |
| 19 | SessionStart | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 22) | `.trae/hooks/session-start.sh` | COMPLETE | v0.7 |
| 20 | UserPromptSubmit | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 28) | `.trae/hooks/user-prompt-submit.sh` | COMPLETE | v0.7 |
| 21 | PreToolUse | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 30) | `.trae/hooks/pre-tool-use.sh` | COMPLETE | v0.7 |
| 22 | PostToolUse | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 33) | `.trae/hooks/post-tool-use.sh` | COMPLETE | v0.7 |
| 23 | Stop/SubagentStop | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (lines 41-42) | `.trae/hooks/stop.sh` | COMPLETE | v0.7 |
| 24 | PostCompact | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 38) | Post-compact detection (no direct Trae event) | GAP | v0.7 |

### State Management

| # | State | LazyCodex Source | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- |
| 25 | Boulder state | `lazycodex/packages/web/content/docs/start-work.md` | `.lazytrae/state/boulder.json` | COMPLETE | v0.5 |
| 26 | UlwLoop plan | `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` | `.lazytrae/state/active-loop.json` | COMPLETE | v0.5 |
| 27 | Session tracking | `lazycodex/plugins/omo/components/rules/src/session-state-lock.ts` | `.lazytrae/state/sessions.json` | COMPLETE | v0.5 |
| 28 | Evidence recording | `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts` | `.lazytrae/evidence/*.md` | COMPLETE | v0.5 |

### Verification Gates

| # | Gate | LazyCodex Source | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- |
| 29 | Plan reread | `lazycodex/packages/web/content/docs/hooks-lifecycle.md` | Reviewer protocol step 1 | COMPLETE | v0.5 |
| 30 | Automated verification | `lazycodex/packages/web/content/docs/tdd.md` | `.lazytrae/evidence/test-runs.md` | COMPLETE | v0.5 |
| 31 | Manual-QA | `lazycodex/plugins/omo/components/ultrawork/directive.md` | `.lazytrae/evidence/verifier.md` | COMPLETE | v0.5 |
| 32 | Adversarial QA | `lazycodex/packages/web/content/docs/manual-qa.md` | `.lazytrae/evidence/reviewer.md` | COMPLETE | v0.5 |
| 33 | Cleanup | `lazycodex/packages/web/content/docs/hooks-lifecycle.md` | `.trae/skills/remove-ai-slops/SKILL.md` | COMPLETE | v0.3 |
| 34 | Completion claim | `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` | `.lazytrae/evidence/completion.md` | COMPLETE | v0.5 |
| 35 | Handoff summary | `lazycodex/packages/web/content/docs/` (handoff workflow) | `.lazytrae/evidence/handoff.md` | COMPLETE | v0.5 |

### Rules Component

| # | Method | LazyCodex Source | LazyTrae Equivalent | Status | Version |
| --- | --- | --- | --- | --- | --- |
| 36 | Static rule injection | `lazycodex/plugins/omo/components/rules/src/static-injection.ts` | `AGENTS.md` + `.trae/rules/lazytrae.md` | COMPLETE | v0.2 |
| 37 | Dynamic rule matching | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (PostToolUse) | Hook-based PostToolUse extraction | COMPLETE (simplified) | v0.7 |
| 38 | Context pressure detection | `lazycodex/plugins/omo/components/rules/src/context-pressure.ts` | SessionStart/UserPromptSubmit detection | COMPLETE | v0.7 |
| 39 | Post-compact recovery | `lazycodex/plugins/omo/components/rules/src/post-compact-state.ts` | Post-compact state in sessions.json | GAP (mitigated) | v0.7 |

### Deferred / Not Applicable

| # | Method | Reason |
| --- | --- | --- |
| D1 | Telemetry hook | LazyTrae does not add telemetry — N/A |
| D2 | Codex marketplace install | Not portable — replaced by `npx lazytrae-ai init` |
| D3 | LSP daemon | Optional external LSP MCP — GAP |
| D4 | Codegraph | Optional external code graph tool — GAP |
| D5 | refactor skill | Embedded in start-work — DEFERRED |
| D6 | programming skill | Embedded in start-work — DEFERRED |
| D7 | frontend skill | Embedded in start-work — DEFERRED |
| D8 | git-master skill | Embedded in start-work — DEFERRED |
| D9 | lcx-report-bug skill | Not ported — DEFERRED |
| D10 | ast-grep skill | Optional external tool — DEFERRED |
| D11 | Managed profiles (model routing) | Legacy compatibility — N/A |
<!-- lazytrae:managed:end:command-index -->