# LazyTrae Parity Ledger

> **v0.1 — Architecture and Parity Design.** Part of the v0.x series.
> This ledger maps every canonical historical source record method to its LazyTrae equivalent.
> Every claim cites an actual workspace path.

## Status Legend

| Status | Meaning |
| --- | --- |
| COMPLETE | Fully implemented and verified |
| PARTIAL | Partially implemented; known gaps |
| DESIGN | Designed in architecture; not yet implemented |
| DEFERRED | Intentionally deferred; rationale documented |
| N/A | Not applicable to Trae platform |

## 1. Core Commands

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `$init-deep` | historical source record | Hierarchical repo understanding, AGENTS.md generation | init-deep command + skill | `.trae/commands/init-deep.md`, `.trae/skills/init-deep/SKILL.md` | COMPLETE |
| 1.2 | `$ulw-plan` | historical source record | Socratic planning interview, parallel exploration, plan generation | ulw-plan command + skill + Prometheus agent | `.trae/commands/ulw-plan.md`, `.trae/skills/ulw-plan/SKILL.md`, `.trae/agents/prometheus.md` | COMPLETE |
| 1.3 | `$start-work` | historical source record | Execute approved plan one task at a time | start-work command + skill + Atlas agent | `.trae/commands/start-work.md`, `.trae/skills/start-work/SKILL.md`, `.trae/agents/atlas.md` | COMPLETE |
| 1.4 | `$ulw-loop` | historical source record | Self-referential long-horizon execution loop | ulw-loop command + skill + loop state machine | `.trae/commands/ulw-loop.md`, `.trae/skills/ulw-loop/SKILL.md`, `.lazytrae/state/active-loop.json` | COMPLETE |
| 1.5 | `$ralph-loop` | historical source record (alias) | Alias for ulw-loop | ralph-loop command | `.trae/commands/ralph-loop.md` | COMPLETE |
| 1.6 | `/stop-continuation` | historical source record (referenced) | Pause/cancel active loop | stop-continuation command + CLI | `.trae/commands/stop-continuation.md`, `lazytrae loop cancel` | COMPLETE |
| 1.7 | `/handoff` | historical source record (referenced) | New-session continuation summary | handoff command + CLI | `.trae/commands/handoff.md`, `lazytrae handoff` | COMPLETE |
| 1.8 | `review-work` | historical source record (referenced) | Reviewer/Oracle protocol | review-work command + reviewer skill + Oracle agent | `.trae/commands/review-work.md`, `.trae/skills/reviewer/SKILL.md`, `.trae/agents/oracle.md` | COMPLETE |
| 1.9 | `remove-ai-slops` | historical source record (referenced) | Remove AI-generated slop while preserving behavior | remove-ai-slops command + skill + Cleaner agent | `.trae/commands/remove-ai-slops.md`, `.trae/skills/remove-ai-slops/SKILL.md`, `.trae/agents/cleaner.md` | COMPLETE |
| 1.10 | Completion gate status | historical source record | Hard CLI completion evidence check for advisory Trae hooks | completion-status command + verify --must-pass | `packages/cli/src/commands/completion-status.js`, `lazytrae verify --must-pass` | COMPLETE |

## 2. Agent Roles

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Explorer | historical source record | Codebase search specialist, read-only, parallel tool calls | Explorer agent | `.trae/agents/explorer.md` | COMPLETE |
| 2.2 | Librarian | historical source record | External docs/library researcher, SHA-pinned citations | Librarian agent + skill | `.trae/agents/librarian.md`, `.trae/skills/librarian/SKILL.md` | COMPLETE |
| 2.3 | Plan (Prometheus) | historical source record | Strategic planning, writes a structured plan, never implements | Prometheus agent | `.trae/agents/prometheus.md`, `.lazytrae/plans/<slug>.md` | COMPLETE |
| 2.4 | Metis | historical source record | Pre-planning gap analyst, detects contradictions and ambiguity | Metis agent | `.trae/agents/metis.md` | COMPLETE |
| 2.5 | Momus | historical source record | Plan reviewer, issues OKAY/ITERATE/REJECT | Momus agent | `.trae/agents/momus.md` | COMPLETE |
| 2.6 | historical source record (Atlas) | historical source record | Executes one task unit at a time | Atlas agent | `.trae/agents/atlas.md` | COMPLETE |
| 2.7 | Hephaestus | historical source record | Deep autonomous worker for hard implementation | Hephaestus agent | `.trae/agents/hephaestus.md` | COMPLETE |
| 2.8 | historical source record | historical source record | Post-implementation code quality review | Oracle agent (code review role) | `.trae/agents/oracle.md` | COMPLETE |
| 2.9 | historical source record | historical source record | Real-execution-based QA | Verifier skill + Oracle agent (QA role) | `.trae/skills/verifier/SKILL.md`, `.trae/agents/oracle.md` | COMPLETE |
| 2.10 | historical source record (Oracle) | historical source record | Pre-completion verification gates | Oracle agent (gate review role) | `.trae/agents/oracle.md` | COMPLETE |
| 2.11 | Sisyphus (orchestrator) | Not a standalone TOML; implicit in historical source record workflow | Main orchestrator: decides plan/execute/review/loop | Sisyphus agent | `.trae/agents/sisyphus.md` | COMPLETE |

## 3. Hooks

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1 | SessionStart hook | historical source record (line 22) | Rules loading, telemetry, auto-update, bootstrap, codegraph | session-start hook | `.trae/hooks/session-start.sh` | COMPLETE |
| 3.2 | UserPromptSubmit hook | historical source record (line 28) | Rules re-injection, ultrawork trigger, ulw-loop steering | user-prompt-submit hook | `.trae/hooks/user-prompt-submit.sh` | COMPLETE |
| 3.3 | PreToolUse hook | historical source record (line 30) | Git bash MCP guidance, ulw-loop goal budget protection | pre-tool-use hook | `.trae/hooks/pre-tool-use.sh` | COMPLETE |
| 3.4 | PostToolUse hook | historical source record (line 33) | Comment checker, LSP diagnostics, codegraph init, rule matching | post-tool-use hook | `.trae/hooks/post-tool-use.sh` | COMPLETE |
| 3.5 | Stop/SubagentStop hook | historical source record (lines 41-42) | Start-work continuation, executor evidence verification | stop hook | `.trae/hooks/stop.sh` | COMPLETE |
| 3.6 | PostCompact hook | historical source record (line 38) | Cache resets, rule re-injection after compaction | Post-compact detection (no direct Trae event) | `sessions.json` with `post_compact_recovery_needed` flag | GAP |
| 3.7 | Comment checker hook | historical source record | Check for AI-generated comments on edits | Optional in post-tool-use hook | `.trae/hooks/post-tool-use.sh` | COMPLETE |
| 3.8 | Ultrawork trigger detection | historical source record | Detect "ulw" / "ultrawork" keywords in user prompt | user-prompt-submit keyword detection | `.trae/hooks/user-prompt-submit.sh` | COMPLETE |
| 3.9 | Ulw-loop steering hook | historical source record | Steering detection on UserPromptSubmit | user-prompt-submit steering detection | `.trae/hooks/user-prompt-submit.sh` | COMPLETE |
| 3.10 | Ulw-loop goal budget protection | historical source record (PreToolUse) | Enforce unlimited goal budget on create_goal | pre-tool-use budget enforcement | `.trae/hooks/pre-tool-use.sh` | DESIGN |
| 3.11 | LSP diagnostics hook | historical source record | Run LSP diagnostics on PostToolUse | Optional external LSP MCP | `.trae/mcp.json` (lsp server, optional) | COMPLETE (optional) |
| 3.12 | Codegraph init hook | historical source record | Initialize code graph on session start | Optional external tool | — | GAP |
| 3.13 | Rules dynamic matching | historical source record (PostToolUse) | Match rules to changed files after edits | Hook-based PostToolUse extraction | `.trae/hooks/post-tool-use.sh` | COMPLETE (simplified) |
| 3.14 | Telemetry hook | historical source record | PostHog-based telemetry | Not ported | — | N/A |
| 3.15 | Auto-update hook | historical source record | Check for plugin updates | `lazytrae sync` | `packages/cli/src/commands/sync.js` | COMPLETE |
| 3.16 | Bootstrap provisioning | historical source record | Provision plugin environment | `lazytrae init` | `packages/cli/src/commands/init.js` | COMPLETE |

## 4. State Management

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Boulder state | historical source record | Durable plan task tracker | Boulder state | `.lazytrae/state/boulder.json` | COMPLETE |
| 4.2 | UlwLoop plan (goals.json) | historical source record (UlwLoopPlan) | Plan with goals, criteria, statuses | Active loop state | `.lazytrae/state/active-loop.json` | COMPLETE |
| 4.3 | UlwLoop brief (brief.md) | historical source record (ULW_LOOP_BRIEF) | Original task brief | Loop brief | `.lazytrae/loop/<run-id>/brief.md` | COMPLETE |
| 4.4 | UlwLoop ledger (ledger.jsonl) | historical source record (ULW_LOOP_LEDGER) | Audit trail of all mutations | Loop event log | `.lazytrae/logs/loop-events.ndjson`, `.lazytrae/loop/<run-id>/ledger.jsonl` | COMPLETE |
| 4.5 | Goal statuses | historical source record (UlwLoopStatus: pending/in_progress/complete/failed/blocked/review_blocked/needs_user_decision) | Goal lifecycle tracking | Goal statuses in active-loop.json | `.lazytrae/state/active-loop.json` | COMPLETE |
| 4.6 | Criterion statuses | historical source record (UlwLoopCriterionStatus: pending/pass/fail/blocked) | Success criterion tracking | Criterion statuses in active-loop.json | `.lazytrae/state/active-loop.json` | COMPLETE |
| 4.7 | Steering mutations | historical source record (ULW_LOOP_STEERING_MUTATION_KINDS: 7 kinds) | Runtime plan adjustments | Steering mutations in active-loop.json | `.lazytrae/state/active-loop.json` | COMPLETE |
| 4.8 | Criterion user models | historical source record (ULW_LOOP_SUCCESS_CRITERION_USER_MODELS: happy/edge/regression/adversarial) | Criterion classification | Criterion user models in active-loop.json | `.lazytrae/state/active-loop.json` | COMPLETE |
| 4.9 | Ledger event kinds | historical source record (ULW_LOOP_LEDGER_EVENT_KINDS: 19 kinds) | Event classification for audit trail | Ledger event kinds | `.lazytrae/logs/loop-events.ndjson`, `.lazytrae/schemas/active-loop.schema.json` | COMPLETE |
| 4.10 | Plan CRUD operations | historical source record | Create, read, update, start-next, summarize plans | Plan parser + boulder state | `docs/lazytrae-state-machine.md`, `.lazytrae/state/boulder.json`, `.lazytrae/plans/` | COMPLETE |
| 4.11 | Evidence recording | historical source record (recordEvidence, markCriteriaPendingResetForGoal, criteriaSummary) | Record evidence against criteria | Evidence recording via CLI + MCP | `.lazytrae/evidence/*.md`, `lazytrae verify` | COMPLETE |
| 4.12 | Quality gate validation | historical source record (validateQualityGate: 5 sections) | Validate completion quality gate | Reviewer/Oracle protocol | `.lazytrae/evidence/reviewer.md`, `.lazytrae/evidence/oracle-review.md` | COMPLETE |
| 4.13 | Mutation lock | historical source record (withUlwLoopMutationLock) | Prevent concurrent state mutations | In-memory promise-chain lock (plan) + mkdir-based lock (session) | `docs/lazytrae-state-machine.md` §9 | COMPLETE |
| 4.14 | Session state | historical source record | Track session for continuation | Session tracking | `.lazytrae/state/sessions.json` | COMPLETE |
| 4.15 | Checkpointing | historical source record | Save progress for resumption | Checkpointing in loop state | `.lazytrae/state/active-loop.json` (checkpoints field) | COMPLETE |

## 5. Verification Gates

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 5.1 | Plan reread | historical source record (gate 1) | Re-read plan before claiming completion | Reviewer protocol step 1 | `.lazytrae/evidence/reviewer.md` | COMPLETE |
| 5.2 | Automated verification | historical source record (gate 2) | Tests, linters, type checks, builds | Test run evidence | `.lazytrae/evidence/test-runs.md` | COMPLETE |
| 5.3 | Manual-QA | historical source record (Manual-QA channels: HTTP, tmux, browser, CLI, data) | Real-surface proof through channels | Verifier evidence | `.lazytrae/evidence/verifier.md` | COMPLETE |
| 5.4 | Adversarial QA | historical source record (gate 4) | Edge cases, regression, adversarial scenarios | Reviewer evidence | `.lazytrae/evidence/reviewer.md` | COMPLETE |
| 5.5 | Cleanup | historical source record (gate 5) | Remove AI slop, dead code, unused imports | remove-ai-slops skill | `.trae/skills/remove-ai-slops/SKILL.md` | COMPLETE |
| 5.6 | Completion claim | historical source record (UlwLoopAggregateCompletion) | Formal completion with evidence | Completion evidence | `.lazytrae/evidence/completion.md` | COMPLETE |
| 5.7 | Handoff summary | historical source record (handoff workflow) | Session handoff for continuation | Handoff evidence | `.lazytrae/evidence/handoff.md` | COMPLETE |

## 6. MCP Servers

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 6.1 | grep_app MCP | historical source record (line 3) | Remote code search | Optional in .trae/mcp.json | `.trae/mcp.json` | COMPLETE |
| 6.2 | context7 MCP | historical source record (line 6) | Documentation lookup | Optional in .trae/mcp.json | `.trae/mcp.json` | COMPLETE |
| 6.3 | codegraph MCP | historical source record (line 10) | Code graph analysis | Optional external tool | — | GAP |
| 6.4 | git_bash MCP | historical source record (line 17) | Git operations via bash | Optional in .trae/mcp.json | `.trae/mcp.json` | COMPLETE |
| 6.5 | lsp MCP | historical source record (line 25) | Language server protocol | Optional LSP MCP template | `.trae/mcp.json` (lsp server, optional) | COMPLETE (optional) |
| 6.6 | LazyTrae MCP server | Not in historical source record (LazyTrae addition) | LazyTrae state, evidence, handoff, and local context query/mutation | LazyTrae MCP server | `packages/mcp/src/index.js` (15 tools), `packages/mcp/src/tools.js`, `packages/mcp/src/handlers-context.js`, `packages/cli/src/commands/mcp.js` (thin wrapper) | COMPLETE |

## 7. Model Routing

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1 | Role-based model profiles | historical source record (roles section) | Different models for different roles | Routing config | `.lazytrae/config.json` (routing section) | COMPLETE |
| 7.2 | Default model profile | historical source record (line 4: gpt-5.5, high reasoning) | Baseline model for most tasks | Trae Auto mode | Native Trae | COMPLETE |
| 7.3 | Plan mode profile | historical source record (line 7: xhigh reasoning) | Strong reasoning for planning | Trae Max mode | Native Trae | COMPLETE |
| 7.4 | Worker model profile | historical source record (line 17) | Fast capable coding model | Trae Auto mode | Native Trae | COMPLETE |
| 7.5 | Verifier model profile | historical source record (line 13) | Oracle model for judgment | Trae Max mode | Native Trae | COMPLETE |
| 7.6 | Agent TOML model field | historical source record (line 4: model = "gpt-5.4-mini") | Per-agent model selection | Agent prompt routing hints | `.trae/agents/*.md` | COMPLETE |
| 7.7 | Managed profiles | historical source record (managedProfiles array) | Legacy profile compatibility | Not applicable | — | N/A |

## 8. Skills (Shared)

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 8.1 | init-deep skill | historical source record | Hierarchical repo understanding | init-deep skill | `.trae/skills/init-deep/SKILL.md` | COMPLETE |
| 8.2 | ulw-plan skill | historical source record | Plan generation workflow | ulw-plan skill | `.trae/skills/ulw-plan/SKILL.md` | COMPLETE |
| 8.3 | start-work skill | historical source record | Plan execution one-task-at-a-time | start-work skill | `.trae/skills/start-work/SKILL.md` | COMPLETE |
| 8.4 | ulw-loop skill | historical source record | Long-horizon execution loop | ulw-loop skill | `.trae/skills/ulw-loop/SKILL.md` | COMPLETE |
| 8.5 | review-work skill | historical source record | Review/Oracle protocol | reviewer skill | `.trae/skills/reviewer/SKILL.md` | COMPLETE |
| 8.6 | remove-ai-slops skill | historical source record | AI-slop cleanup | remove-ai-slops skill | `.trae/skills/remove-ai-slops/SKILL.md` | COMPLETE |
| 8.7 | refactor skill | historical source record (inferred from shared skills) | Refactoring guidance | refactor skill | `.trae/skills/refactor/SKILL.md` | COMPLETE |
| 8.8 | programming skill | historical source record (inferred from shared skills) | General programming guidance | programming skill | `.trae/skills/programming/SKILL.md` | COMPLETE |
| 8.9 | frontend skill | historical source record (inferred from shared skills) | Frontend-specific guidance | frontend skill | `.trae/skills/frontend/SKILL.md` | COMPLETE |
| 8.10 | git-master skill | historical source record (inferred from shared skills) | Git workflow guidance | git-master skill | `.trae/skills/git-master/SKILL.md` | COMPLETE |
| 8.11 | comment-checker skill | historical source record (inferred from shared skills) | Comment checking guidance | Optional in post-tool-use hook | `.trae/hooks/post-tool-use.sh` | COMPLETE |
| 8.12 | lcx-doctor skill | historical source record (inferred from shared skills) | historical source record health check | `lazytrae doctor` | `packages/cli/src/commands/doctor.js` | COMPLETE |
| 8.13 | lcx-report-bug skill | historical source record (inferred from shared skills) | Bug reporting | lcx-report-bug skill | `.trae/skills/lcx-report-bug/SKILL.md` | COMPLETE |
| 8.14 | ast-grep skill | historical source record (inferred from shared skills) | Structural code search | ast-grep skill + optional MCP | `.trae/skills/ast-grep/SKILL.md`, `.trae/mcp.json` (ast_grep server) | COMPLETE |
| 8.15 | coding-agent-sessions skill | historical source record (inferred from shared skills) | Session management guidance | coding-agent-sessions skill | `.trae/skills/coding-agent-sessions/SKILL.md` | COMPLETE |
| 8.16 | ultrawork skill | historical source record (inferred) | Ultrawork directive as skill | Embedded in ulw-loop skill | `.trae/skills/ulw-loop/SKILL.md` | COMPLETE |
| 8.17 | rules skill | historical source record | Rules injection guidance | Not separately ported; embedded in AGENTS.md + rules | `AGENTS.md`, `.trae/rules/lazytrae.md` | COMPLETE |
| 8.18 | lsp skill | historical source record | LSP diagnostics guidance | Optional LSP MCP template + ast-grep skill as structural search substitute | `.trae/mcp.json` (lsp server), `.trae/skills/ast-grep/SKILL.md` | COMPLETE (optional) |
| 8.19 | teammode skill | historical source record | Team mode guidance | Team mode docs | `docs/lazytrae-team-mode.md` | COMPLETE |
| 8.20 | librarian skill | historical source record | Codebase search and context gathering, external research | librarian skill | `.trae/skills/librarian/SKILL.md` | COMPLETE |
| 8.21 | verifier skill | LazyTrae addition (not in historical source record) | Verification gate enforcement | verifier skill | `.trae/skills/verifier/SKILL.md` | COMPLETE |
| 8.22 | migration-planner skill | LazyTrae addition (not in historical source record) | Migration planning for platform adaptation | migration-planner skill | `.trae/skills/migration-planner/SKILL.md` | COMPLETE |

## 9. Ultrawork / ulw-loop Core

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 9.1 | Ultrawork directive | historical source record | Full ultrawork mode directive | Embedded in ulw-loop skill | `.trae/skills/ulw-loop/SKILL.md` | COMPLETE |
| 9.2 | Skill pointer | historical source record | <4096-byte pointer to skill | Trae native skill loading (eliminates pointer) | N/A | N/A |
| 9.3 | Tier triage (LIGHT/HEAVY) | historical source record (Tier triage section) | Classify task complexity at bootstrap | Tier triage in ulw-loop skill | `.trae/skills/ulw-loop/SKILL.md` | COMPLETE |
| 9.4 | Manual-QA channels | historical source record (Manual-QA channels: HTTP, tmux, browser, CLI, data) | Real-surface proof channels | Manual-QA channels in verifier protocol | `docs/lazytrae-verifier-protocol.md` | COMPLETE |
| 9.5 | Iteration cap (500/100) | historical source record | Maximum iterations per loop | Iteration cap in loop state | `.lazytrae/state/active-loop.json` | COMPLETE |
| 9.6 | Codex goal mode (aggregate/per_story) | historical source record (UlwLoopCodexGoalMode) | Goal aggregation mode | Goal mode in active-loop.json | `.lazytrae/state/active-loop.json` | COMPLETE |
| 9.7 | Aggregate completion | historical source record (UlwLoopAggregateCompletion) | Formal loop completion | Completion evidence | `.lazytrae/evidence/completion.md` | COMPLETE |
| 9.8 | Plan creation | historical source record (createUlwLoopPlan) | Create ulw-loop plan from brief | Loop state initialization | `.lazytrae/state/active-loop.json` | COMPLETE |
| 9.9 | Start next goal | historical source record (startNextUlwLoop) | Start next pending goal | Loop cycle step 5 | `docs/lazytrae-execution-loop.md` | COMPLETE |
| 9.10 | Goal completion | historical source record (isUlwLoopDone, hasAllCriteriaPass) | Check if goal/loop is complete | Goal completion check in loop state | `.lazytrae/state/active-loop.json` | COMPLETE |
| 9.11 | Steering engine | historical source record | Runtime plan adjustments | Steering in loop state (7 mutation kinds) | `docs/lazytrae-execution-loop.md` §9 | COMPLETE |
| 9.12 | CLI arg parser | historical source record | Parse CLI arguments | CLI arg parsing | `packages/cli/src/commands/loop.js` | COMPLETE |
| 9.13 | CLI commands | historical source record | CLI command implementations | CLI commands (status/cancel/pause/resume/log/checkpoint) | `packages/cli/src/commands/loop.js` | COMPLETE |
| 9.14 | CLI output | historical source record | Formatted CLI output | CLI output formatting | `packages/cli/src/commands/loop.js` | COMPLETE |
| 9.15 | Review blockers | historical source record | Blocker tracking and classification | Blocker tracking documented in loop state and reviewer protocol | `docs/lazytrae-reviewer-protocol.md`, `docs/lazytrae-failure-recovery.md` | COMPLETE |

## 10. Rules Component

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 10.1 | Static rule injection | historical source record | Load AGENTS.md and rules at session start | AGENTS.md + .trae/rules/ | `AGENTS.md`, `.trae/rules/lazytrae.md` | COMPLETE |
| 10.2 | Dynamic rule matching | historical source record (PostToolUse) | Match rules to changed files after edits | Hook-based PostToolUse extraction | `.trae/hooks/post-tool-use.sh` | COMPLETE (simplified) |
| 10.3 | Context pressure detection | historical source record | Skip injection when compacted | SessionStart/UserPromptSubmit detection | `.trae/hooks/session-start.sh`, `.trae/hooks/user-prompt-submit.sh` | COMPLETE |
| 10.4 | Post-compact recovery | historical source record | Track compacted state for re-injection | Post-compact state in sessions.json | `sessions.json` `compaction_state` field | GAP (mitigated) |
| 10.5 | Post-compact budget | historical source record | Budget tracking for post-compact operations | Post-compact budget in state | `sessions.json` `compaction_state` | COMPLETE (simplified) |
| 10.6 | Persistent cache | historical source record | Session-level cache for rules | Not separately implemented; Trae rules are re-read each prompt | N/A | N/A |
| 10.7 | Event budget | historical source record | Budget tracking for hook events | Event budget in hook dispatcher | `packages/cli/src/commands/hook.js` timeout config | COMPLETE |
| 10.8 | Tool path extraction | historical source record | Extract file paths from tool input | Tool path extraction in post-tool-use hook | `.trae/hooks/post-tool-use.sh` | COMPLETE |
| 10.9 | Transcript search | historical source record | Search transcript for rule mentions | Transcript search in hook | `.trae/hooks/user-prompt-submit.sh` (context markers) | COMPLETE |
| 10.10 | Bundled rules (hephaestus) | historical source record | Pre-bundled hephaestus rule | Embedded in hephaestus agent | `.trae/agents/hephaestus.md` | DESIGN |

## 11. Team Mode

| # | historical source record Method | historical source record Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 11.1 | Team state model | historical source record | Durable team state shape and persistence | Team JSON schema + sample team | `.lazytrae/team/team.json`, `.lazytrae/schemas/team.schema.json` | COMPLETE |
| 11.2 | Team controller CLI | historical source record | CLI for init/add-member/bind-thread/archive/delete/status | Team CLI commands | `packages/cli/src/commands/team.js` | COMPLETE |
| 11.3 | Leader orchestration protocol | historical source record | Team-vs-subagent decision, leader protocol, compose by part | Team mode documentation | `docs/lazytrae-team-mode.md` | COMPLETE |
| 11.4 | Worktree isolation | historical source record | Git worktree provisioning for write-colliding members | Documented in docs/lazytrae-team-mode.md (manual worktrees) | `docs/lazytrae-team-mode.md` | COMPLETE (simplified) |
| 11.5 | Thread title hygiene hook | historical source record | PostToolUse hook for thread title enforcement | Not applicable (Trae subagents are ephemeral, no thread titles) | — | N/A |
| 11.6 | Member communication | historical source record | `codex_app.send_message_to_thread` / `codex_app.read_thread` | Mailbox file-based communication | `.lazytrae/team/mailbox/` | COMPLETE (adapted) |
| 11.7 | Durability across sessions | Codex thread persistence (codex_app thread tools) | Durable threads that survive session close | Durable team.json + member report files | `.lazytrae/team/team.json`, `.lazytrae/team/members/<id>/report.md` | COMPLETE (adapted) |

## Summary

| Category | Total | COMPLETE | DESIGN | GAP | DEFERRED | N/A |
| --- | --- | --- | --- | --- | --- | --- |
| Core Commands | 10 | 10 | 0 | 0 | 0 | 0 |
| Agent Roles | 11 | 11 | 0 | 0 | 0 | 0 |
| Hooks | 16 | 12 | 1 | 2 | 0 | 1 |
| State Management | 15 | 15 | 0 | 0 | 0 | 0 |
| Verification Gates | 7 | 7 | 0 | 0 | 0 | 0 |
| MCP Servers | 6 | 5 | 0 | 1 | 0 | 0 |
| Model Routing | 7 | 6 | 0 | 0 | 0 | 1 |
| Skills (Shared) | 22 | 22 | 0 | 0 | 0 | 0 |
| Ultrawork/ulw-loop Core | 15 | 14 | 0 | 0 | 0 | 1 |
| Rules Component | 10 | 7 | 1 | 1 | 0 | 1 |
| Team Mode | 7 | 6 | 0 | 0 | 0 | 1 |
| **TOTAL** | **126** | **115** | **2** | **4** | **0** | **5** |

**Coverage**: 115/126 (91.3%) are COMPLETE. 2/126 (1.6%) have concrete Trae-native designs.
- 115 items COMPLETE: 10 core commands + 11 agent roles + 12 hooks + 15 state management + 7 verification gates + 5 MCP servers + 6 model routing + 22 skills + 14 ultrawork core + 7 rules component + 6 team mode.
- 4 GAPs: PostCompact hook (3.6, fundamental platform gap), codegraph MCP (6.3, no suitable server available), codegraph init hook (3.12, depends on codegraph MCP), post-compact recovery (10.4, mitigated via heuristic detection).
- 2 DESIGN: ulw-loop goal budget protection (3.10), bundled rules hephaestus (10.10).

## References

- historical source record entry: historical source record
- historical source record plugin: historical source record
- historical source record agents: historical source record*.toml`
- historical source record hooks: historical source record*/hooks/hooks.json`
- historical source record plugin manifest: historical source record
- historical source record skills: historical source record*/skills/*/SKILL.md`, historical source record*/SKILL.md`
- historical source record MCP: historical source record
- historical source record model catalog: historical source record
- historical source record ulw-loop: historical source record
- historical source record rules: historical source record
- historical source record ultrawork: historical source record
- historical source record web docs: historical source record*.md`
- LazyTrae architecture: `docs/lazytrae-architecture-plan.md`
- LazyTrae versioned plan: `docs/lazytrae-versioned-execution-plan.md`
- LazyTrae verification matrix: `docs/lazytrae-verification-matrix.md`
