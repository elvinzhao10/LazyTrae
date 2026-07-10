# LazyTrae Working Replica Guide

Date: 2026-07-09

Goal: make LazyTrae a working Trae-native LazyCodex replica, using Trae-native agents, commands, hooks, MCP, state, and CLI surfaces. This is a build guide for agents, not a scorecard.

## Current Read

LazyTrae is a real implementation: `.trae/` agents/commands/hooks/rules exist, `.lazytraework/` state exists, `packages/cli` exists, and `packages/mcp` exposes tools. It is not yet LazyCodex-level because Trae cannot currently provide blocking Stop hooks or PostCompact hooks, and the loop runtime is still much thinner than LazyCodex `ulw-loop`.

Target operating model: do not pretend Trae can enforce what the host cannot enforce. Build stronger CLI/MCP gates, recovery state, and explicit evidence checks so the agent workflow behaves like LazyCodex even when the platform hook is advisory.

## Reference Targets

LazyCodex reference paths:

- `lazycodex/plugins/omo/.codex-plugin/plugin.json`
- `lazycodex/plugins/omo/.mcp.json`
- `lazycodex/plugins/omo/components/ulw-loop/src/`
- `lazycodex/plugins/omo/components/start-work-continuation/`
- `lazycodex/plugins/omo/components/lazycodex-executor-verify/`
- `lazycodex/plugins/omo/components/rules/src/`
- `lazycodex/plugins/omo/components/teammode/`
- `lazycodex/plugins/omo/skills/start-work/SKILL.md`
- `lazycodex/plugins/omo/skills/ulw-loop/SKILL.md`

LazyBuddy comparison paths:

- `../lazybuddy/lazybuddy-plugin/scripts/hooks/stop-gate.sh`
- `../lazybuddy/lazybuddy-plugin/scripts/hooks/pre-compact.sh`
- `../lazybuddy/lazybuddy-plugin/.mcp.json`
- `../lazybuddy/lazybuddy-plugin/scripts/state/`
- `../lazybuddy/.lazybuddy/runs/dogfood-v0.11/`

## Platform Constraints

| Constraint | Trae reality | Replica strategy |
| --- | --- | --- |
| Stop hook blocking | `.trae/hooks/stop.sh` exits 0; `.trae/hooks.json` says hooks do not block | Make completion impossible through `lazytrae verify`, MCP `mark_task_done`, and handoff unless gates pass |
| PostCompact | No Trae event | Use SessionStart/UserPromptSubmit recovery flags plus a manual `lazytrae hook recover-context` command |
| Subagent role routing | Agent prompts exist, but host enforcement is weaker than Codex `agent_type` | Put role constraints in agent files and verify outputs with Oracle/reviewer gates |
| Background parallelism | Trae subagent behavior differs from Codex `spawn_agent`/`wait_agent` | Use batch parallelism and durable state instead of live mailbox assumptions |
| Model routing | Mostly advisory | Keep explicit config and document what Trae can and cannot enforce |

## Workstream T0: Doctor Becomes The Truth

Purpose: one command tells whether LazyTrae is usable.

Files:

- `packages/cli/src/commands/doctor.js`
- `packages/cli/src/lib/validator.js`
- `packages/cli/test/`
- `.trae/hooks.json`
- `.lazytraework/state/*.json`

TODO:

- [ ] Validate `.trae/hooks.json` shape and every referenced script path.
- [ ] Run hook fixtures for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop.
- [ ] Validate `.lazytraework/state/boulder.json`, `active-loop.json`, and `sessions.json` against schemas.
- [ ] Start MCP in-process or via stdio and confirm `tools/list` returns all expected tools.
- [ ] Run `lazytrae loop status`, `lazytrae loop checkpoint`, and `lazytrae handoff` against fixture state.
- [ ] Fail doctor if evidence files are missing for a completed task.
- [ ] Replace placeholder `npm test` in `packages/cli/package.json` with real tests.

Acceptance:

- `npm test` exits 0.
- `lazytrae doctor` exits non-zero on broken hooks, invalid state, missing MCP tools, and completed tasks without evidence.
- `lazytrae doctor` prints a short actionable fix for each failure.

## Workstream T1: Full Loop Runtime

Purpose: replace the current partial `loop.js` with a real LazyCodex-style goal/evidence engine.

Files:

- `packages/cli/src/commands/loop.js`
- `packages/cli/src/lib/`
- `.lazytraework/state/active-loop.json`
- `.lazytraework/schemas/active-loop.schema.json`
- `packages/mcp/src/handlers-evidence.js`
- `packages/mcp/src/handlers-review.js`

TODO:

- [ ] Add `create-goals` to create goals and success criteria from a brief.
- [ ] Add `complete-goals` to start/resume the next eligible goal.
- [ ] Add `criteria <goal>` to inspect success criteria.
- [ ] Add `record-evidence` to attach evidence to a criterion.
- [ ] Add `record-review-blockers` to create follow-up work from reviewer findings.
- [ ] Add `steer` with LazyCodex-style mutation kinds: add, remove, split, merge, reorder, pause, resume.
- [ ] Add `checkpoint --quality-gate-json <file>` and validate all required quality-gate sections.
- [ ] Enforce per-goal and repeated-failure caps before creating more work.
- [ ] Append every mutation to `.lazytraework/logs/loop-events.ndjson`.

Acceptance:

- A fixture brief can run through create-goals -> complete-goals -> record-evidence -> checkpoint -> aggregate complete.
- A missing quality gate blocks completion.
- Repeated same-criterion failure creates a blocker instead of looping forever.

## Workstream T2: Advisory Hooks Become Hard Gates Through CLI/MCP

Purpose: compensate for non-blocking Trae hooks.

Files:

- `.trae/hooks/stop.sh`
- `.trae/hooks/pre-tool-use.sh`
- `packages/cli/src/commands/verify.js`
- `packages/mcp/src/handlers-evidence.js`
- `packages/mcp/src/handlers-handoff.js`

TODO:

- [ ] Keep Stop hook advisory, but make its output include the exact failing gate and next command.
- [ ] Make `lazytrae verify --must-pass` the mandatory gate before handoff/completion.
- [ ] Make MCP `lazytrae.mark_task_done` reject completion unless required evidence exists.
- [ ] Make `lazytrae.generate_handoff` include warning status if gates are incomplete.
- [ ] Add `lazytrae completion-status` that returns `ready|blocked` with reasons.

Acceptance:

- A user can still close Trae, but LazyTrae commands and MCP tools refuse to mark work done without evidence.
- Stop output and handoff output agree on the same blocking reason.

## Workstream T3: Context Recovery Without PostCompact

Purpose: preserve project instructions after compaction using Trae-available signals.

Files:

- `.trae/hooks/session-start.sh`
- `.trae/hooks/user-prompt-submit.sh`
- `.lazytraework/state/sessions.json`
- `packages/cli/src/commands/hook.js`

TODO:

- [ ] Add `post_compact_recovery_needed` state with timestamp, reason, and last injected rules hash.
- [ ] Detect context-pressure markers in UserPromptSubmit and set recovery state.
- [ ] Make SessionStart re-inject rules when recovery state is set.
- [ ] Add `lazytrae hook recover-context` for manual recovery.
- [ ] Add doctor check for stale recovery state.

Acceptance:

- Fixture prompt with compaction marker sets recovery state.
- Next SessionStart or manual command clears recovery state after writing a recovery event.

## Workstream T4: Context Tooling MCP

Purpose: give Trae agents code intelligence comparable to LazyCodex codegraph/LSP/context7.

Files:

- `packages/mcp/src/tool-defs.js`
- `packages/mcp/src/tools.js`
- `packages/mcp/src/handlers-read.js`
- `.trae/mcp.json`

TODO:

- [ ] Add `lazytrae.symbol_search`.
- [ ] Add `lazytrae.find_references`.
- [ ] Add `lazytrae.goto_definition` if feasible; otherwise label it heuristic.
- [ ] Add `lazytrae.diagnostics` backed by project-native commands: `npm test`, `tsc`, `ruff`, `pyright`, `go test`, `cargo check`, as detected.
- [ ] Add `lazytrae.docs_lookup` for local README/package docs first, external docs only when available.
- [ ] Add `lazytrae.dependency_graph` with file-level imports and reverse references.

Acceptance:

- MCP tools say whether results are semantic, project-tool-backed, or heuristic.
- Doctor verifies each tool can run in an empty fixture repo and in this repo.

## Workstream T5: Live Dogfood

Purpose: prove this is a working harness, not a simulation.

Files:

- `.lazytraework/evidence/`
- `.lazytraework/logs/loop-events.ndjson`
- `.lazytraework/state/`
- `docs/lazytrae-dogfood-run.md`

TODO:

- [ ] Choose a real repo task with at least 3 subtasks.
- [ ] Run through `ulw-plan` -> `start-work` -> `ulw-loop` using LazyTrae commands/state.
- [ ] Force one failing verification and repair cycle.
- [ ] Record one manual QA artifact.
- [ ] Record one reviewer blocker and resolution.
- [ ] Generate handoff only after `lazytrae verify --must-pass` passes.

Acceptance:

- Evidence includes CLI output, MCP output, state diffs, hook output, and final verifier result.
- The dogfood doc states what failed and what was fixed.

## Agent Checklist

Use this order:

1. T0 Doctor.
2. T1 Loop runtime.
3. T2 Completion gates.
4. T3 Context recovery.
5. T4 Context tooling.
6. T5 Dogfood.

Do not update parity status to runtime-verified until there is a passing command or dogfood artifact. Use these labels:

- `runtime-verified`: command or hook was executed and evidence is stored.
- `implemented-unverified`: code exists but no end-to-end proof.
- `prompt-only`: markdown instruction only.
- `heuristic-substitute`: not true LazyCodex parity, but usable in Trae.
- `platform-gap`: blocked by Trae host behavior.

## Done Definition

LazyTrae becomes a working LazyCodex replica when:

- `lazytrae doctor` passes on a clean install.
- `lazytrae verify --must-pass` blocks incomplete work.
- `lazytrae loop` can create goals, record evidence, checkpoint, and complete with quality gates.
- MCP exposes state, evidence, parity, diagnostics, docs, and code-navigation tools.
- A non-trivial dogfood run passes with repair-cycle evidence.
- Docs clearly mark platform gaps instead of claiming impossible parity.
