# AGENTS.md — LazyTrae Project Constitution

> **LazyTrae** is a Trae-native recreation of LazyCodex/OmO workflows.
> This file is the first thing an AI agent reads when opening this repository.

## What This Project Is

LazyTrae recreates the LazyCodex/OmO agent harness experience on Trae IDE. It uses Trae-native mechanisms (Rules, Skills, Commands, Custom Agents, Hooks, MCP, SOLO/Subagents) to deliver the same workflow semantics as LazyCodex does on Codex.

The canonical source of truth is the LazyCodex repo cloned at `lazycodex/`. All LazyCodex behavior must be verified against actual source files, not memory.

## Repository Layout

```
lazytrae/
  AGENTS.md              ← You are here
  plan/                  ← Versioned execution plan (v0.0 through v0.13)
  lazycodex/             ← Cloned LazyCodex repo (canonical source, read-only reference)
```

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
| `v0.13-final-release.md` | v0.13 | Final parity report and release |

## Operating Rules

### Inspect Before Editing
- Always read the actual LazyCodex source files before implementing any feature.
- Never invent LazyCodex behavior from memory.
- The `lazycodex/` directory is the canonical source of truth.

### Plan Before Multi-File Changes
- Use the versioned plan files as the execution guide.
- Follow versions in order: v0.0 -> v0.1 -> ... -> v0.13.
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

## Version Numbering

All versions use the `v0.x` scheme. This is the **version 0 build**.

- v0.0 = canonical discovery
- v0.1 = architecture
- v0.2 = rules/memory
- ...
- v0.13 = final release

Do not use `v1.x`, `v2.x`, etc. The entire 14-step plan is under the v0.x umbrella.

## Git Workflow

- Use conventional commits.
- Keep commits atomic.
- Each commit's tests and build must pass on its own.
- Stage only the files you changed.
- No `git add -A` or `git add .`.
- No `git commit --no-verify`.
- No force pushes.

## Quick Reference: LazyCodex Source Paths

| What | Where |
| --- | --- |
| Entry point | `lazycodex/bin/lazycodex-ai.js` |
| Plugin root | `lazycodex/plugins/omo/` |
| Components | `lazycodex/plugins/omo/components/` |
| Agent roles | `lazycodex/plugins/omo/components/ultrawork/agents/*.toml` |
| Hooks | `lazycodex/plugins/omo/components/*/hooks/hooks.json` |
| Skills | `lazycodex/plugins/omo/components/*/skills/*/SKILL.md` |
| Shared skills | `lazycodex/plugins/omo/skills/*/SKILL.md` |
| MCP config | `lazycodex/plugins/omo/.mcp.json` |
| Model catalog | `lazycodex/plugins/omo/model-catalog.json` |
| Web docs | `lazycodex/packages/web/content/docs/*.md` |
| ulw-loop source | `lazycodex/plugins/omo/components/ulw-loop/src/` |
| ultrawork source | `lazycodex/plugins/omo/components/ultrawork/src/` |
| rules source | `lazycodex/plugins/omo/components/rules/src/` |
