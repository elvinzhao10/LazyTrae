# LazyTrae Architecture Plan

> **v0.1 — Architecture and Parity Design.** Part of the v0.x series.
> This is a design-only document. No runtime code has been implemented.

## 1. Architecture Overview

LazyTrae is a Trae-native recreation of LazyCodex/OmO workflows. It uses Trae-native mechanisms (Rules, Skills, Commands, Custom Agents, Hooks, MCP, SOLO/Subagents) to deliver the same workflow semantics as LazyCodex does on Codex.

The architecture is organized into three layers:

### Layer 1 — Trae-native interface (prompts + config)
```
.trae/rules/          # Project rules, behavioral foundations
.trae/skills/*/SKILL.md  # Workflow skills (init-deep, ulw-plan, start-work, ulw-loop, etc.)
.trae/commands/       # Slash command prompt definitions
.trae/agents/         # Custom agent role definitions (Markdown)
.trae/mcp.json        # MCP server configuration
.trae/hooks/          # Hook shell scripts
```

### Layer 2 — LazyTrae project runtime (state + CLI)
```
.lazytraework/config.json          # LazyTrae configuration
.lazytraework/state/boulder.json   # Active plan task tracker
.lazytraework/state/active-loop.json  # Long-horizon loop state
.lazytraework/state/sessions.json     # Session tracking
.lazytraework/evidence/               # Verification evidence files
.lazytraework/logs/                   # Event and hook logs
.lazytraework/schemas/                # JSON schemas for state validation
CLI: lazytrae init / doctor / sync / verify / handoff / uninstall
```

### Layer 3 — OmO/LazyCodex compatibility mirror
```
.omo/plans/           # Plan files (mirror from LazyCodex)
.omo/boulder.json     # Boulder state mirror
.omo/ulw-loop/        # ulw-loop state mirror
```

**Design Principle**: Trae owns the UX. LazyTrae owns durable state, evidence, verification, compatibility, and parity accounting.

## 2. Component Mapping

### 2.1 Project Memory → AGENTS.md + Trae Rules

**LazyCodex source**: `plugins/omo/components/rules/src/codex-hook.ts` (lines 1-80+)
- Static injection: loads AGENTS.md, `.codex/rules/` at SessionStart and UserPromptSubmit
- Dynamic injection: after PostToolUse, extracts file paths from tool input, matches rules
- Context pressure handling: skips injection when compaction markers are present
- Post-compact recovery: tracks compacted state for correct re-injection

**LazyTrae mapping**:
- `AGENTS.md` at repo root — project constitution, operating rules, command index (same role as LazyCodex AGENTS.md)
- `.trae/rules/lazytrae.md` — behavioral rules encoded as Trae project rules
- Trae natively supports project rules in `.trae/rules/` directory (confirmed from docs.trae.cn/ide_rules)
- Trae natively supports project-level memory (confirmed from docs.trae.cn/ide_memories)

**Implementation notes**:
- Trae Rules are markdown files read by the agent at session start — they provide static injection equivalent
- Dynamic rule matching (PostToolUse file-path fingerprinting) is NOT available natively in Trae — this requires the hook layer (v0.7)
- Post-compact handling is a gap (see section 4)

### 2.2 Skills → .trae/skills/*/SKILL.md

**LazyCodex source**: `plugins/omo/components/*/skills/*/SKILL.md`
Component skills: `ulw-loop/SKILL.md`, `ultrawork/SKILL.md`, `rules/SKILL.md`, `lsp/SKILL.md`, `teammode/SKILL.md`
Shared skills: `init-deep/SKILL.md`, `ulw-plan/SKILL.md`, `start-work/SKILL.md`, `review-work/SKILL.md`, `remove-ai-slops/SKILL.md`, `refactor/SKILL.md`, `programming/SKILL.md`, `frontend/SKILL.md`, `git-master/SKILL.md`, `comment-checker/SKILL.md`, `lcx-doctor/SKILL.md`, `lcx-report-bug/SKILL.md`, `ast-grep/SKILL.md`, `coding-agent-sessions/SKILL.md`

**LazyTrae mapping**:
- `.trae/skills/init-deep/SKILL.md` — hierarchical repo understanding
- `.trae/skills/ulw-plan/SKILL.md` — plan generation workflow
- `.trae/skills/start-work/SKILL.md` — plan execution one-task-at-a-time
- `.trae/skills/ulw-loop/SKILL.md` — long-horizon execution loop
- `.trae/skills/verifier/SKILL.md` — automated verification
- `.trae/skills/reviewer/SKILL.md` — review/Oracle protocol
- `.trae/skills/librarian/SKILL.md` — memory/doc updates
- `.trae/skills/migration-planner/SKILL.md` — host migration planning
- `.trae/skills/remove-ai-slops/SKILL.md` — AI-slop cleanup

**Implementation notes**:
- Trae Skills format: `SKILL.md` with name, description, trigger conditions, structured procedure (confirmed from docs.trae.cn/ide_skills)
- Dynamic on-demand loading: agent scans descriptions first, then loads full SKILL.md when relevant
- LazyCodex uses `skill-pointer` mechanism (ultrawork component) to emit a <4096-byte pointer directing the model to read the full skill — Trae's native skill loading eliminates this complexity

### 2.3 Commands → .trae/commands/*.md

**LazyCodex source**: `packages/web/content/docs/` — 20 markdown docs covering init-deep, ulw-plan, start-work, ulw-loop, ultrawork, etc.

**LazyTrae mapping**:
- `.trae/commands/init-deep.md`
- `.trae/commands/ulw-plan.md`
- `.trae/commands/start-work.md`
- `.trae/commands/ulw-loop.md`
- `.trae/commands/ralph-loop.md`
- `.trae/commands/review-work.md`
- `.trae/commands/remove-ai-slops.md`
- `.trae/commands/handoff.md`
- `.trae/commands/stop-continuation.md`

**Implementation notes**:
- Trae slash commands are prompt templates that the user can invoke
- Each command doc includes: usage, inputs, outputs, success criteria, and the full prompt
- Command names preserve LazyCodex semantics where they communicate parity

### 2.4 Subagents → .trae/agents/*.md + SOLO/Subagent behavior

**LazyCodex source**: `plugins/omo/components/ultrawork/agents/*.toml`
- `explorer.toml` — codebase search specialist, read-only, parallel tool calls
- `librarian.toml` — external docs/library researcher, SHA-pinned citations
- `plan.toml` — strategic planning, writes `.omo/plans/<slug>.md`, never implements
- `metis.toml` — pre-planning gap analyst, detects contradictions and ambiguity
- `momus.toml` — plan reviewer, issues OKAY/ITERATE/REJECT verdicts

Additional roles from `packages/web/content/docs/discipline-agents.md`:
- `lazycodex-executor` (Atlas) — executes one task at a time
- `lazycodex-code-reviewer` — post-implementation code quality review
- `lazycodex-qa-executor` — real-execution-based QA
- `lazycodex-gate-reviewer` (Oracle) — pre-completion verification gates

**LazyTrae mapping**:
- `.trae/agents/sisyphus.md` — main orchestrator (decides plan/execute/review/loop)
- `.trae/agents/prometheus.md` — planner only (interviews, writes plans, no product-code edits)
- `.trae/agents/metis.md` — pre-planning risk analyst
- `.trae/agents/momus.md` — plan reviewer
- `.trae/agents/atlas.md` — executes one checklist item at a time
- `.trae/agents/hephaestus.md` — deep autonomous worker for hard implementation
- `.trae/agents/oracle.md` — reviewer/architecture consultant, read-only by default
- `.trae/agents/librarian.md` — maintains project memory, docs, command index, parity ledger
- `.trae/agents/explorer.md` — fast codebase scout, read-only
- `.trae/agents/cleaner.md` — removes AI-slop preserving behavior
- `.trae/agents/migration-planner.md` — converts LazyCodex methods to other hosts

**Implementation notes**:
- Trae custom agents: prompts + MCP + built-in tools (read, file system, terminal, web search, preview) — confirmed from docs.trae.cn/ide_agent
- "Can be called by other agents" toggle — enables subagent pattern
- Only the built-in "Agent" can call custom agents (subagent pattern)
- Agents have independent context when called
- Key LazyCodex principle preserved: "completion judgment is never handed wholesale to a sub-agent. The parent session keeps ownership of goals, constraints, and final judgment."

### 2.5 Hooks → .trae/hooks + LazyTrae Hook Dispatcher

**LazyCodex source**: `plugins/omo/components/*/hooks/hooks.json` and `plugins/omo/.codex-plugin/plugin.json` (lines 22-44)
Six LazyCodex hook events:
1. **SessionStart** — rules loading, telemetry, auto-update, bootstrap, codegraph
2. **UserPromptSubmit** — rules re-injection, ultrawork trigger detection, ulw-loop steering
3. **PreToolUse** — git bash MCP guidance, ulw-loop goal budget protection
4. **PostToolUse** — comment checker, LSP diagnostics, codegraph init, rule matching
5. **Stop/SubagentStop** — start-work continuation, executor evidence verification
6. **PostCompact** — git bash notification, rules and LSP cache resets

**LazyTrae mapping**:

| LazyCodex event | Trae event | Hook script |
| --- | --- | --- |
| SessionStart | SessionStart | `.trae/hooks/session-start.sh` |
| UserPromptSubmit | UserPromptSubmit | `.trae/hooks/user-prompt-submit.sh` |
| PreToolUse | PreToolUse | `.trae/hooks/pre-tool-use.sh` |
| PostToolUse | PostToolUse | `.trae/hooks/post-tool-use.sh` |
| Stop/SubagentStop | Stop | `.trae/hooks/stop.sh` |
| PostCompact | (none) | **GAP** — handled via SessionStart detection + UserPromptSubmit context-pressure markers |

**Implementation notes**:
- Trae hooks: 6 events (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, Notification) — confirmed from docs.trae.cn/ide_automate-actions-with-hooks
- Hook scripts execute shell commands, receive JSON on stdin, produce output on stdout
- LazyTrae hook dispatcher (`lazytrae hook <event>`) will be the single entry point for all hook scripts
- PostCompact gap: LazyCodex uses PostCompact for cache resets and rule re-injection. LazyTrae must detect compaction via SessionStart source or UserPromptSubmit context-pressure markers and re-inject accordingly

### 2.6 MCP Templates → .trae/mcp.json + Optional LazyTrae MCP Server

**LazyCodex source**: `plugins/omo/.mcp.json` (lines 1-34)
- `grep_app` — code search (remote)
- `context7` — documentation lookup (remote)
- `codegraph` — code graph analysis (local)
- `git_bash` — git operations via bash (local)
- `lsp` — language server protocol (local)

**LazyTrae mapping**:
- `.trae/mcp.json` — MCP server configuration for Trae
- LazyTrae MCP server (optional, in `packages/mcp/src/server.ts`) exposing:
  - `lazytrae.get_active_plan` — retrieve current active plan
  - `lazytrae.get_boulder_status` — get boulder state summary
  - `lazytrae.get_next_task` — get next actionable task
  - `lazytrae.record_evidence` — record verification evidence
  - `lazytrae.mark_task_done` — mark task complete with evidence
  - `lazytrae.add_blocker` — record a blocker
  - `lazytrae.request_review` — trigger review cycle
  - `lazytrae.generate_handoff` — generate handoff summary
  - `lazytrae.get_parity_status` — get parity ledger status

**Implementation notes**:
- Trae MCP supported in IDE, `.trae/mcp.json` configuration — confirmed from docs.trae.cn/ide_model-context-protocol
- LazyCodex MCP servers use local `node` commands with relative paths — LazyTrae can use similar patterns
- Optional MCP templates: filesystem, git, playwright/browser, docs/context lookup, ast-grep, LSP diagnostics

### 2.7 Long-Running Loop → .lazytraework/state + .omo Compatibility Mirror

**LazyCodex source**: `plugins/omo/components/ulw-loop/src/` — full implementation
- `constants.ts` (lines 1-64): state directory `.omo/ulw-loop`, statuses (pending, in_progress, complete, failed, blocked, review_blocked, needs_user_decision), steering mutations, criterion user models, ledger event kinds
- `domain-types.ts` (lines 1-161): UlwLoopPlan, UlwLoopItem, UlwLoopSuccessCriterion, UlwLoopQualityGate, UlwLoopLedgerEntry
- `plan-crud.ts` (lines 1-205): create plan, start next goal, add goal, summarize plan
- `evidence.ts` (lines 1-228): record evidence, mark criteria pending reset, criteria summary
- `quality-gate.ts` (lines 1-258): validate quality gate with 5 sections (code review, manual QA, gate review, iteration, criteria coverage)
- `runtime.ts` (lines 1-22): error types, ISO timestamp helper
- `steering.ts`: steering mutations (add_subgoal, split_subgoal, reorder_pending, etc.)
- `cli.ts`: CLI commands for plan CRUD, evidence recording, steering

**LazyTrae mapping**:
- `.lazytraework/state/active-loop.json` — loop state (status, goals, criteria, iteration, checkpoints)
- `.lazytraework/state/boulder.json` — active plan task tracker
- `.lazytraework/state/sessions.json` — session tracking
- `.lazytraework/logs/loop-events.ndjson` — event log
- `.omo/ulw-loop/<run-id>/goals.json` — compatibility mirror of ulw-loop goals
- `.omo/ulw-loop/<run-id>/ledger.jsonl` — compatibility mirror of audit trail
- `.omo/ulw-loop/<run-id>/brief.md` — compatibility mirror of brief
- `.omo/plans/` — compatibility mirror of plan files

**Loop states**: idle, initializing, planning, active, verifying, reviewing, blocked, paused, complete, cancelled

**Loop cycle**:
1. Load project memory (AGENTS.md + rules)
2. Expand user goal into completion promise
3. Run init-deep if project memory is missing
4. Generate or load plan (.omo/plans/)
5. Select next actionable task from boulder
6. Implement one bounded unit
7. Run verifier (automated + manual-QA)
8. If verification fails, diagnose and retry or mark blocker
9. Run reviewer/Oracle
10. If review fails, re-enter active state with reviewer blockers
11. Update Librarian/memory
12. Check completion promise
13. Continue until complete, blocked, paused, or max-iteration reached

**Implementation notes**:
- LazyCodex ulw-loop uses file-based mutation locks for concurrent safety — LazyTrae should adopt the same
- LazyCodex has 500 iteration cap in ultrawork mode, 100 in normal mode — LazyTrae should adopt similar caps
- .omo compatibility mirror ensures any LazyCodex tooling can read LazyTrae state

### 2.8 Verification → CLI Scripts + Terminal Commands + Evidence Files + Reviewer Protocols

**LazyCodex source**: `packages/web/content/docs/tdd.md`, `packages/web/content/docs/manual-qa.md`, five evidence gates from `packages/web/content/docs/hooks-lifecycle.md`

Five evidence gates:
1. **Plan reread** — re-read the plan before claiming completion
2. **Automated verification** — tests, linters, type checks, builds
3. **Manual-QA** — real-surface proof through channels (HTTP, tmux, browser, CLI, data)
4. **Adversarial QA** — edge cases, regression, adversarial scenarios
5. **Cleanup** — remove AI slop, dead code, unused imports

**LazyTrae mapping**:
- `.lazytraework/evidence/test-runs.md` — automated test run results
- `.lazytraework/evidence/verifier.md` — verifier agent output
- `.lazytraework/evidence/reviewer.md` — reviewer agent output
- `.lazytraework/evidence/oracle-review.md` — oracle review output
- `.lazytraework/evidence/completion.md` — completion claim with evidence
- `.lazytraework/evidence/handoff.md` — session handoff summary
- CLI commands: `lazytrae verify`, `lazytrae handoff`

**Reviewer/Oracle protocol**:
- Reviewer is read-only by default
- Three verdicts: APPROVE, ITERATE (max 3 fixable issues), REJECT (blocking)
- Completion invalid without reviewer/Oracle pass
- Parent session retains ownership of final judgment

### 2.9 Model Routing → Trae Auto/Max/Custom-Model Guidance + Optional trae-agent Backend

**LazyCodex source**: `plugins/omo/model-catalog.json` (lines 1-43)
- Role-based profiles: default, plan mode, worker, verifier
- Baseline: `gpt-5.5` with `high` reasoning, `xhigh` for plan mode

**LazyTrae mapping**:
- Native Trae: Auto mode (standard), Max mode (large context/tool-heavy), custom model selection
- Routing guidance in `.lazytraework/config.json`:
  - quick → Auto mode, atlas agent
  - deep → Max mode, hephaestus agent
  - ultrabrain → Max mode + strongest reasoning model, oracle agent
  - visual-engineering → Max mode + visual/frontend-capable model, sisyphus agent
  - writing → Auto/default, librarian agent
  - review → strongest reasoning model, read-only stance, oracle agent
- Optional: `trae-agent` CLI backend for explicit provider/model routing with trajectory recording

**Implementation notes**:
- Trae does not support programmatic model switching mid-session — routing guidance is advisory (prompt-level hints)
- The optional `trae-agent` backend would provide true programmatic routing when available
- LazyCodex model routing is also primarily advisory (role → model mapping in TOML agent files)

## 3. Non-Portable Features

These LazyCodex features have no direct Trae equivalent and require documented substitutes:

| Feature | LazyCodex mechanism | Why non-portable | LazyTrae substitute |
| --- | --- | --- | --- |
| PostCompact hook | `PostCompact` event in Codex hooks | Trae has no PostCompact event | SessionStart detection of compaction + UserPromptSubmit context-pressure markers |
| Dynamic rule matching | PostToolUse extracts file paths, fingerprints, loads relevant rules | Trae rules are static (loaded at session start) | Hook-based PostToolUse script extracts file paths and writes to a state file; session-start reads it |
| Codex marketplace install | `codex plugin marketplace add` + `codex plugin add` | Trae has no plugin marketplace | `npx lazytrae-ai init` replaces marketplace install |
| Hashline edit enforcement | Codex edit tools enforce read-before-write with hash lines | Trae edit tools do not use hash lines | PreToolUse hook + CLI guard warns on potential write-before-read; not true native enforcement |
| SubagentStop event | Separate `SubagentStop` event in Codex | Trae has single `Stop` event | Single `Stop` hook handles both; subagent detection via session state |
| LSP daemon | Codex LSP component runs persistent daemon | Trae has no built-in LSP MCP equivalent | Optional: configure external LSP MCP server; degrade gracefully |
| Codegraph | Internal code graph analysis | Trae has no codegraph equivalent | Optional: external code graph tool; degrade gracefully |
| Telemetry | PostHog-based telemetry component | Trae has its own telemetry | Not ported; LazyTrae does not add telemetry |
| Auto-update | Bootstrap component checks for updates | LazyTrae is npm-based | `npx lazytrae-ai sync` for manual updates |

## 4. Known Gap: PostCompact Handling

**Problem**: LazyCodex uses the PostCompact hook to reset caches (git bash MCP reminder, project rule cache, LSP diagnostics cache) and re-inject rules after context compaction. Trae has no PostCompact event.

**Strategy**:
1. **SessionStart detection**: When Trae's SessionStart hook fires, inspect the session source. If the session is a resume of a previously compacted session, detect compaction markers in the transcript.
2. **UserPromptSubmit context-pressure markers**: Before each user prompt, scan the transcript for context-pressure markers (e.g., "[Context has been compacted]" or similar signals). If detected, emit a re-injection directive.
3. **State file tracking**: Maintain a `.lazytraework/state/post-compact.json` file that tracks when compaction was detected, so subsequent hooks know to re-inject rules and reset caches.

**Implementation**: This will be handled in v0.7 (hooks).

## 5. File Artifact Map

| Artifact | Layer | Purpose |
| --- | --- | --- |
| `AGENTS.md` | Layer 1 | Project constitution, operating rules |
| `.trae/rules/lazytrae.md` | Layer 1 | Behavioral rules |
| `.trae/skills/*/SKILL.md` | Layer 1 | Workflow skills |
| `.trae/commands/*.md` | Layer 1 | Slash command prompts |
| `.trae/agents/*.md` | Layer 1 | Custom agent role definitions |
| `.trae/hooks/*.sh` | Layer 1 | Hook shell scripts |
| `.trae/mcp.json` | Layer 1 | MCP server configuration |
| `.lazytraework/config.json` | Layer 2 | LazyTrae configuration |
| `.lazytraework/state/boulder.json` | Layer 2 | Active plan task tracker |
| `.lazytraework/state/active-loop.json` | Layer 2 | Long-horizon loop state |
| `.lazytraework/state/sessions.json` | Layer 2 | Session tracking |
| `.lazytraework/evidence/*.md` | Layer 2 | Verification evidence |
| `.lazytraework/logs/*.ndjson` | Layer 2 | Event and hook logs |
| `.lazytraework/schemas/*.json` | Layer 2 | JSON schemas for state validation |
| `.omo/plans/` | Layer 3 | Plan files (compatibility mirror) |
| `.omo/boulder.json` | Layer 3 | Boulder state mirror |
| `.omo/ulw-loop/` | Layer 3 | ulw-loop state mirror |

## 6. References

- LazyCodex entry point: `lazycodex/bin/lazycodex-ai.js` — thin alias to `npx oh-my-openagent omo install --platform=codex`
- LazyCodex plugin root: `lazycodex/plugins/omo/`
- LazyCodex agent roles: `lazycodex/plugins/omo/components/ultrawork/agents/*.toml`
- LazyCodex hooks: `lazycodex/plugins/omo/components/*/hooks/hooks.json`
- LazyCodex skills: `lazycodex/plugins/omo/components/*/skills/*/SKILL.md`
- LazyCodex MCP: `lazycodex/plugins/omo/.mcp.json`
- LazyCodex model catalog: `lazycodex/plugins/omo/model-catalog.json`
- LazyCodex web docs: `lazycodex/packages/web/content/docs/*.md`
- LazyCodex ulw-loop source: `lazycodex/plugins/omo/components/ulw-loop/src/`
- LazyCodex rules source: `lazycodex/plugins/omo/components/rules/src/`
- LazyCodex ultrawork directive: `lazycodex/plugins/omo/components/ultrawork/directive.md`
- Trae capabilities: verified from AGENTS.md (summarized from docs.trae.cn)