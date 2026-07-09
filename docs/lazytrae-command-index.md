# LazyTrae Command Index

> **v0.2 — Project Constitution, Rules, and Memory.** Part of the v0.x series.
> This index maps every canonical LazyCodex method to its LazyTrae equivalent.
> Every claim cites an actual workspace path.

## Status Legend

| Status | Meaning |
| --- | --- |
| COMPLETE | Fully implemented and verified |
| DESIGN | Designed in architecture; not yet implemented |
| DEFERRED | Intentionally deferred; rationale documented |
| GAP | Known gap; documented substitute exists |
| N/A | Not applicable to Trae platform |

## 1. Core Commands

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `$init-deep` | `lazycodex/packages/web/content/docs/init-deep.md` | Hierarchical repo understanding, AGENTS.md generation | init-deep command + skill | `.trae/commands/init-deep.md`, `.trae/skills/init-deep/SKILL.md` | DESIGN | v0.3 |
| 1.2 | `$ulw-plan` | `lazycodex/packages/web/content/docs/ulw-plan.md` | Socratic planning interview, parallel exploration, plan generation | ulw-plan command + skill + Prometheus agent | `.trae/commands/ulw-plan.md`, `.trae/skills/ulw-plan/SKILL.md`, `.trae/agents/prometheus.md` | DESIGN | v0.3 |
| 1.3 | `$start-work` | `lazycodex/packages/web/content/docs/start-work.md` | Execute approved plan one task at a time | start-work command + skill + Atlas agent | `.trae/commands/start-work.md`, `.trae/skills/start-work/SKILL.md`, `.trae/agents/atlas.md` | DESIGN | v0.3 |
| 1.4 | `$ulw-loop` | `lazycodex/packages/web/content/docs/ulw-loop.md` | Self-referential long-horizon execution loop | ulw-loop command + skill + loop state machine | `.trae/commands/ulw-loop.md`, `.trae/skills/ulw-loop/SKILL.md`, `.lazytrae/state/active-loop.json` | DESIGN | v0.9 |
| 1.5 | `$ralph-loop` | `lazycodex/packages/web/content/docs/ulw-loop.md` (alias) | Alias for ulw-loop | ralph-loop command | `.trae/commands/ralph-loop.md` | DESIGN | v0.9 |
| 1.6 | `/stop-continuation` | `lazycodex/packages/web/content/docs/` (referenced) | Pause/cancel active loop | stop-continuation command + CLI | `.trae/commands/stop-continuation.md`, `lazytrae loop cancel` | DESIGN | v0.5 |
| 1.7 | `/handoff` | `lazycodex/packages/web/content/docs/` (referenced) | New-session continuation summary | handoff command + CLI | `.trae/commands/handoff.md`, `lazytrae handoff` | DESIGN | v0.5 |
| 1.8 | `review-work` | `lazycodex/packages/web/content/docs/` (referenced) | Reviewer/Oracle protocol | review-work command + reviewer skill + Oracle agent | `.trae/commands/review-work.md`, `.trae/skills/reviewer/SKILL.md`, `.trae/agents/oracle.md` | DESIGN | v0.4 |
| 1.9 | `remove-ai-slops` | `lazycodex/packages/web/content/docs/` (referenced) | Remove AI-generated slop while preserving behavior | remove-ai-slops command + skill + Cleaner agent | `.trae/commands/remove-ai-slops.md`, `.trae/skills/remove-ai-slops/SKILL.md`, `.trae/agents/cleaner.md` | DESIGN | v0.4 |

## 2. Agent Roles

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Explorer | `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` | Codebase search specialist, read-only, parallel tool calls | Explorer agent | `.trae/agents/explorer.md` | DESIGN | v0.4 |
| 2.2 | Librarian | `lazycodex/plugins/omo/components/ultrawork/agents/librarian.toml` | External docs/library researcher, SHA-pinned citations | Librarian agent + skill | `.trae/agents/librarian.md`, `.trae/skills/librarian/SKILL.md` | DESIGN | v0.4 |
| 2.3 | Plan (Prometheus) | `lazycodex/plugins/omo/components/ultrawork/agents/plan.toml` | Strategic planning, writes `.omo/plans/<slug>.md`, never implements | Prometheus agent | `.trae/agents/prometheus.md` | DESIGN | v0.4 |
| 2.4 | Metis | `lazycodex/plugins/omo/components/ultrawork/agents/metis.toml` | Pre-planning gap analyst, detects contradictions and ambiguity | Metis agent | `.trae/agents/metis.md` | DESIGN | v0.4 |
| 2.5 | Momus | `lazycodex/plugins/omo/components/ultrawork/agents/momus.toml` | Plan reviewer, issues OKAY/ITERATE/REJECT | Momus agent | `.trae/agents/momus.md` | DESIGN | v0.4 |
| 2.6 | lazycodex-executor (Atlas) | `lazycodex/packages/web/content/docs/discipline-agents.md` | Executes one task unit at a time | Atlas agent | `.trae/agents/atlas.md` | DESIGN | v0.4 |
| 2.7 | Hephaestus | `lazycodex/packages/web/content/docs/discipline-agents.md` | Deep autonomous worker for hard implementation | Hephaestus agent | `.trae/agents/hephaestus.md` | DESIGN | v0.4 |
| 2.8 | lazycodex-code-reviewer | `lazycodex/packages/web/content/docs/discipline-agents.md` | Post-implementation code quality review | Oracle agent (code review role) | `.trae/agents/oracle.md` | DESIGN | v0.4 |
| 2.9 | lazycodex-qa-executor | `lazycodex/packages/web/content/docs/discipline-agents.md` | Real-execution-based QA | Verifier skill + Oracle agent (QA role) | `.trae/skills/verifier/SKILL.md`, `.trae/agents/oracle.md` | DESIGN | v0.4 |
| 2.10 | lazycodex-gate-reviewer (Oracle) | `lazycodex/packages/web/content/docs/discipline-agents.md` | Pre-completion verification gates | Oracle agent (gate review role) | `.trae/agents/oracle.md` | DESIGN | v0.4 |
| 2.11 | Sisyphus (orchestrator) | Not a standalone TOML; implicit in LazyCodex workflow | Main orchestrator: decides plan/execute/review/loop | Sisyphus agent | `.trae/agents/sisyphus.md` | DESIGN | v0.4 |

## 3. Hooks

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 | SessionStart hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 22) | Rules loading, telemetry, auto-update, bootstrap, codegraph | session-start hook | `.trae/hooks/session-start.sh` | DESIGN | v0.7 |
| 3.2 | UserPromptSubmit hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 28) | Rules re-injection, ultrawork trigger, ulw-loop steering | user-prompt-submit hook | `.trae/hooks/user-prompt-submit.sh` | DESIGN | v0.7 |
| 3.3 | PreToolUse hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 30) | Git bash MCP guidance, ulw-loop goal budget protection | pre-tool-use hook | `.trae/hooks/pre-tool-use.sh` | DESIGN | v0.7 |
| 3.4 | PostToolUse hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 33) | Comment checker, LSP diagnostics, codegraph init, rule matching | post-tool-use hook | `.trae/hooks/post-tool-use.sh` | DESIGN | v0.7 |
| 3.5 | Stop/SubagentStop hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (lines 41-42) | Start-work continuation, executor evidence verification | stop hook | `.trae/hooks/stop.sh` | DESIGN | v0.7 |
| 3.6 | PostCompact hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 38) | Cache resets, rule re-injection after compaction | Post-compact detection (no direct Trae event) | `.lazytrae/state/post-compact.json` | GAP | v0.7 |
| 3.7 | Comment checker hook | `lazycodex/plugins/omo/hooks/post-tool-use-checking-comments.json` | Check for AI-generated comments on edits | Optional in post-tool-use hook | `.trae/hooks/post-tool-use.sh` | DESIGN | v0.7 |
| 3.8 | Ultrawork trigger detection | `lazycodex/plugins/omo/components/ultrawork/src/codex-hook.ts` | Detect "ulw" / "ultrawork" keywords in user prompt | user-prompt-submit keyword detection | `.trae/hooks/user-prompt-submit.sh` | DESIGN | v0.7 |
| 3.9 | Ulw-loop steering hook | `lazycodex/plugins/omo/components/ulw-loop/hooks/hooks.json` | Steering detection on UserPromptSubmit | user-prompt-submit steering detection | `.trae/hooks/user-prompt-submit.sh` | DESIGN | v0.7 |
| 3.10 | Ulw-loop goal budget protection | `lazycodex/plugins/omo/components/ulw-loop/hooks/hooks.json` (PreToolUse) | Enforce unlimited goal budget on create_goal | pre-tool-use budget enforcement | `.trae/hooks/pre-tool-use.sh` | DESIGN | v0.7 |
| 3.11 | LSP diagnostics hook | `lazycodex/plugins/omo/components/lsp/hooks/hooks.json` | Run LSP diagnostics on PostToolUse | Optional external LSP MCP | `.trae/mcp.json` (optional) | GAP | v0.8 |
| 3.12 | Codegraph init hook | `lazycodex/plugins/omo/components/codegraph/src/hook.ts` | Initialize code graph on session start | Optional external tool | — | GAP | v0.8 |
| 3.13 | Rules dynamic matching | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (PostToolUse) | Match rules to changed files after edits | Hook-based PostToolUse extraction | `.trae/hooks/post-tool-use.sh` | DESIGN | v0.7 |
| 3.14 | Telemetry hook | `lazycodex/plugins/omo/components/telemetry/src/codex-hook.ts` | PostHog-based telemetry | Not ported | — | N/A | — |
| 3.15 | Auto-update hook | `lazycodex/plugins/omo/components/bootstrap/src/hook.ts` | Check for plugin updates | `lazytrae sync` | `packages/cli/src/commands/sync.ts` | DESIGN | v0.6 |
| 3.16 | Bootstrap provisioning | `lazycodex/plugins/omo/components/bootstrap/src/provision.ts` | Provision plugin environment | `lazytrae init` | `packages/cli/src/commands/init.ts` | DESIGN | v0.6 |

## 4. State Management

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | Boulder state | `lazycodex/packages/web/content/docs/start-work.md` | Durable plan task tracker | Boulder state | `.lazytrae/state/boulder.json` | DESIGN | v0.5 |
| 4.2 | UlwLoop plan | `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` | Plan with goals, criteria, statuses | Active loop state | `.lazytrae/state/active-loop.json` | DESIGN | v0.5 |
| 4.3 | UlwLoop brief | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Original task brief | Loop brief | `.omo/ulw-loop/<run-id>/brief.md` | DESIGN | v0.5 |
| 4.4 | UlwLoop ledger | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Audit trail of all mutations | Loop event log | `.lazytrae/logs/loop-events.ndjson`, `.omo/ulw-loop/<run-id>/ledger.jsonl` | DESIGN | v0.5 |
| 4.5 | Goal statuses | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Goal lifecycle tracking | Goal statuses in active-loop.json | `.lazytrae/state/active-loop.json` | DESIGN | v0.5 |
| 4.6 | Criterion statuses | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Success criterion tracking | Criterion statuses in active-loop.json | `.lazytrae/state/active-loop.json` | DESIGN | v0.5 |
| 4.7 | Steering mutations | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Runtime plan adjustments | Steering mutations in active-loop.json | `.lazytrae/state/active-loop.json` | DESIGN | v0.5 |
| 4.8 | Criterion user models | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Criterion classification | Criterion user models in active-loop.json | `.lazytrae/state/active-loop.json` | DESIGN | v0.5 |
| 4.9 | Ledger event kinds | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` | Event classification for audit trail | Ledger event kinds | `.lazytrae/logs/loop-events.ndjson` | DESIGN | v0.5 |
| 4.10 | Plan CRUD operations | `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts` | Create, read, update, start-next, summarize plans | Plan CRUD via CLI | `packages/core/src/plan-parser.ts` | DESIGN | v0.5 |
| 4.11 | Evidence recording | `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts` | Record evidence against criteria | Evidence recording via CLI + MCP | `.lazytrae/evidence/*.md`, `lazytrae verify` | DESIGN | v0.5 |
| 4.12 | Quality gate validation | `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts` | Validate completion quality gate | Reviewer/Oracle protocol | `.lazytrae/evidence/reviewer.md`, `.lazytrae/evidence/oracle-review.md` | DESIGN | v0.5 |
| 4.13 | Mutation lock | `lazycodex/plugins/omo/components/ulw-loop/src/plan-io.ts` | Prevent concurrent state mutations | File-based locking | `packages/core/src/loop-state.ts` | DESIGN | v0.5 |
| 4.14 | Session state | `lazycodex/plugins/omo/components/rules/src/session-state-lock.ts` | Track session for continuation | Session tracking | `.lazytrae/state/sessions.json` | DESIGN | v0.5 |
| 4.15 | Checkpointing | `lazycodex/plugins/omo/components/ulw-loop/src/checkpoint.ts` | Save progress for resumption | Checkpointing in loop state | `.lazytrae/state/active-loop.json` (checkpoints field) | DESIGN | v0.5 |

## 5. Verification Gates

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.1 | Plan reread | `lazycodex/packages/web/content/docs/hooks-lifecycle.md` (gate 1) | Re-read plan before claiming completion | Reviewer protocol step 1 | `.lazytrae/evidence/reviewer.md` | DESIGN | v0.5 |
| 5.2 | Automated verification | `lazycodex/packages/web/content/docs/tdd.md` (gate 2) | Tests, linters, type checks, builds | Test run evidence | `.lazytrae/evidence/test-runs.md` | DESIGN | v0.5 |
| 5.3 | Manual-QA | `lazycodex/plugins/omo/components/ultrawork/directive.md` (Manual-QA channels) | Real-surface proof through channels | Verifier evidence | `.lazytrae/evidence/verifier.md` | DESIGN | v0.5 |
| 5.4 | Adversarial QA | `lazycodex/packages/web/content/docs/manual-qa.md` (gate 4) | Edge cases, regression, adversarial scenarios | Reviewer evidence | `.lazytrae/evidence/reviewer.md` | DESIGN | v0.5 |
| 5.5 | Cleanup | `lazycodex/packages/web/content/docs/hooks-lifecycle.md` (gate 5) | Remove AI slop, dead code, unused imports | remove-ai-slops skill | `.trae/skills/remove-ai-slops/SKILL.md` | DESIGN | v0.4 |
| 5.6 | Completion claim | `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` | Formal completion with evidence | Completion evidence | `.lazytrae/evidence/completion.md` | DESIGN | v0.5 |
| 5.7 | Handoff summary | `lazycodex/packages/web/content/docs/` (handoff workflow) | Session handoff for continuation | Handoff evidence | `.lazytrae/evidence/handoff.md` | DESIGN | v0.5 |

## 6. MCP Servers

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6.1 | grep_app MCP | `lazycodex/plugins/omo/.mcp.json` (line 3) | Remote code search | Optional in .trae/mcp.json | `.trae/mcp.json` | DESIGN | v0.8 |
| 6.2 | context7 MCP | `lazycodex/plugins/omo/.mcp.json` (line 6) | Documentation lookup | Optional in .trae/mcp.json | `.trae/mcp.json` | DESIGN | v0.8 |
| 6.3 | codegraph MCP | `lazycodex/plugins/omo/.mcp.json` (line 10) | Code graph analysis | Optional external tool | — | GAP | v0.8 |
| 6.4 | git_bash MCP | `lazycodex/plugins/omo/.mcp.json` (line 17) | Git operations via bash | Optional in .trae/mcp.json | `.trae/mcp.json` | DESIGN | v0.8 |
| 6.5 | lsp MCP | `lazycodex/plugins/omo/.mcp.json` (line 25) | Language server protocol | Optional external LSP MCP | `.trae/mcp.json` | GAP | v0.8 |
| 6.6 | LazyTrae state MCP | Not in LazyCodex (LazyTrae addition) | LazyTrae state query/mutation | LazyTrae MCP server | `packages/mcp/src/server.ts` | DESIGN | v0.8 |

## 7. Model Routing

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7.1 | Role-based model profiles | `lazycodex/plugins/omo/model-catalog.json` | Different models for different roles | Routing config | `.lazytrae/config.json` (routing section) | DESIGN | v0.10 |
| 7.2 | Default model profile | `lazycodex/plugins/omo/model-catalog.json` (line 4) | Baseline model for most tasks | Trae Auto mode | Native Trae | DESIGN | v0.10 |
| 7.3 | Plan mode profile | `lazycodex/plugins/omo/model-catalog.json` (line 7) | Strong reasoning for planning | Trae Max mode | Native Trae | DESIGN | v0.10 |
| 7.4 | Worker model profile | `lazycodex/plugins/omo/model-catalog.json` (line 17) | Fast capable coding model | Trae Auto mode | Native Trae | DESIGN | v0.10 |
| 7.5 | Verifier model profile | `lazycodex/plugins/omo/model-catalog.json` (line 13) | Oracle model for judgment | Trae Max mode | Native Trae | DESIGN | v0.10 |
| 7.6 | Agent TOML model field | `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` (line 4) | Per-agent model selection | Agent prompt routing hints | `.trae/agents/*.md` | DESIGN | v0.10 |
| 7.7 | Managed profiles | `lazycodex/plugins/omo/model-catalog.json` (managedProfiles) | Legacy profile compatibility | Not applicable | — | N/A | — |

## 8. Skills (Shared)

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8.1 | init-deep skill | `lazycodex/plugins/omo/skills/init-deep/SKILL.md` | Hierarchical repo understanding | init-deep skill | `.trae/skills/init-deep/SKILL.md` | DESIGN | v0.3 |
| 8.2 | ulw-plan skill | `lazycodex/plugins/omo/skills/ulw-plan/SKILL.md` | Plan generation workflow | ulw-plan skill | `.trae/skills/ulw-plan/SKILL.md` | DESIGN | v0.3 |
| 8.3 | start-work skill | `lazycodex/plugins/omo/skills/start-work/SKILL.md` | Plan execution one-task-at-a-time | start-work skill | `.trae/skills/start-work/SKILL.md` | DESIGN | v0.3 |
| 8.4 | ulw-loop skill | `lazycodex/plugins/omo/components/ulw-loop/skills/ulw-loop/SKILL.md` | Long-horizon execution loop | ulw-loop skill | `.trae/skills/ulw-loop/SKILL.md` | DESIGN | v0.9 |
| 8.5 | review-work skill | `lazycodex/plugins/omo/skills/review-work/SKILL.md` | Review/Oracle protocol | reviewer skill | `.trae/skills/reviewer/SKILL.md` | DESIGN | v0.4 |
| 8.6 | remove-ai-slops skill | `lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md` | AI-slop cleanup | remove-ai-slops skill | `.trae/skills/remove-ai-slops/SKILL.md` | DESIGN | v0.4 |
| 8.7 | refactor skill | `lazycodex/plugins/omo/skills/refactor/SKILL.md` | Refactoring guidance | Embedded in start-work | — | DEFERRED | — |
| 8.8 | programming skill | `lazycodex/plugins/omo/skills/programming/SKILL.md` | General programming guidance | Embedded in start-work | — | DEFERRED | — |
| 8.9 | frontend skill | `lazycodex/plugins/omo/skills/frontend/SKILL.md` | Frontend-specific guidance | Embedded in start-work | — | DEFERRED | — |
| 8.10 | git-master skill | `lazycodex/plugins/omo/skills/git-master/SKILL.md` | Git workflow guidance | Embedded in start-work | — | DEFERRED | — |
| 8.11 | comment-checker skill | `lazycodex/plugins/omo/skills/comment-checker/SKILL.md` | Comment checking guidance | Optional in post-tool-use hook | `.trae/hooks/post-tool-use.sh` | DESIGN | v0.7 |
| 8.12 | lcx-doctor skill | `lazycodex/plugins/omo/skills/lcx-doctor/SKILL.md` | LazyCodex health check | `lazytrae doctor` | `packages/cli/src/commands/doctor.ts` | DESIGN | v0.6 |
| 8.13 | lcx-report-bug skill | `lazycodex/plugins/omo/skills/lcx-report-bug/SKILL.md` | Bug reporting | Not ported | — | DEFERRED | — |
| 8.14 | ast-grep skill | `lazycodex/plugins/omo/skills/ast-grep/SKILL.md` | Structural code search | Optional external tool | — | DEFERRED | — |
| 8.15 | coding-agent-sessions skill | `lazycodex/plugins/omo/skills/coding-agent-sessions/SKILL.md` | Session management guidance | Session tracking | `.lazytrae/state/sessions.json` | DESIGN | v0.5 |
| 8.16 | ultrawork skill | `lazycodex/plugins/omo/components/ultrawork/skills/ultrawork/SKILL.md` | Ultrawork directive as skill | Embedded in ulw-loop skill | `.trae/skills/ulw-loop/SKILL.md` | DESIGN | v0.9 |
| 8.17 | rules skill | `lazycodex/plugins/omo/components/rules/skills/rules/SKILL.md` | Rules injection guidance | Embedded in AGENTS.md + rules | `AGENTS.md`, `.trae/rules/lazytrae.md` | COMPLETE | v0.2 |
| 8.18 | lsp skill | `lazycodex/plugins/omo/components/lsp/skills/lsp/SKILL.md` | LSP diagnostics guidance | Optional external LSP MCP | `.trae/mcp.json` (optional) | GAP | v0.8 |
| 8.19 | teammode skill | `lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md` | Team mode guidance | Team mode docs | `docs/lazytrae-team-mode.md` | DESIGN | v0.11 |

## 9. Rules Component

| # | LazyCodex Method | LazyCodex Source | Purpose | LazyTrae Equivalent | LazyTrae Artifact | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9.1 | Static rule injection | `lazycodex/plugins/omo/components/rules/src/static-injection.ts` | Load AGENTS.md and rules at session start | AGENTS.md + .trae/rules/ | `AGENTS.md`, `.trae/rules/lazytrae.md` | COMPLETE | v0.2 |
| 9.2 | Dynamic rule matching | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (PostToolUse) | Match rules to changed files after edits | Hook-based PostToolUse extraction | `.trae/hooks/post-tool-use.sh` | DESIGN | v0.7 |
| 9.3 | Context pressure detection | `lazycodex/plugins/omo/components/rules/src/context-pressure.ts` | Skip injection when compacted | SessionStart/UserPromptSubmit detection | `.trae/hooks/session-start.sh`, `.trae/hooks/user-prompt-submit.sh` | DESIGN | v0.7 |
| 9.4 | Post-compact recovery | `lazycodex/plugins/omo/components/rules/src/post-compact-state.ts` | Track compacted state for re-injection | Post-compact state file | `.lazytrae/state/post-compact.json` | GAP | v0.7 |
| 9.5 | Post-compact budget | `lazycodex/plugins/omo/components/rules/src/post-compact-budget.ts` | Budget tracking for post-compact operations | Post-compact budget in state | `.lazytrae/state/post-compact.json` | DESIGN | v0.7 |
| 9.6 | Persistent cache | `lazycodex/plugins/omo/components/rules/src/persistent-cache.ts` | Session-level cache for rules | Not separately implemented; Trae rules are re-read each prompt | N/A | N/A | — |
| 9.7 | Event budget | `lazycodex/plugins/omo/components/rules/src/event-budget.ts` | Budget tracking for hook events | Event budget in hook dispatcher | `packages/cli/src/commands/hook.ts` | DESIGN | v0.7 |
| 9.8 | Tool path extraction | `lazycodex/plugins/omo/components/rules/src/tool-paths.ts` | Extract file paths from tool input | Tool path extraction in post-tool-use hook | `.trae/hooks/post-tool-use.sh` | DESIGN | v0.7 |
| 9.9 | Transcript search | `lazycodex/plugins/omo/components/rules/src/transcript-search.ts` | Search transcript for rule mentions | Transcript search in hook | `.trae/hooks/user-prompt-submit.sh` | DESIGN | v0.7 |
| 9.10 | Bundled rules (hephaestus) | `lazycodex/plugins/omo/components/rules/bundled-rules/hephaestus.md` | Pre-bundled hephaestus rule | Embedded in hephaestus agent | `.trae/agents/hephaestus.md` | DESIGN | v0.4 |

## Summary

| Category | Total | COMPLETE | DESIGN | GAP | DEFERRED | N/A |
| --- | --- | --- | --- | --- | --- | --- |
| Core Commands | 9 | 0 | 9 | 0 | 0 | 0 |
| Agent Roles | 11 | 0 | 11 | 0 | 0 | 0 |
| Hooks | 16 | 0 | 12 | 3 | 0 | 1 |
| State Management | 15 | 0 | 15 | 0 | 0 | 0 |
| Verification Gates | 7 | 0 | 7 | 0 | 0 | 0 |
| MCP Servers | 6 | 0 | 4 | 2 | 0 | 0 |
| Model Routing | 7 | 0 | 6 | 0 | 0 | 1 |
| Skills (Shared) | 19 | 1 | 11 | 1 | 5 | 1 |
| Rules Component | 10 | 1 | 7 | 1 | 0 | 1 |
| **TOTAL** | **100** | **2** | **82** | **7** | **5** | **4** |

**Coverage**: 2/100 items COMPLETE in v0.2 (static rule injection, rules skill).
82 items have concrete Trae-native designs. 7 GAP items have documented substitutes. 5 DEFERRED items are non-core skills. 4 N/A items are platform-specific.

## References

- LazyCodex entry: `lazycodex/bin/lazycodex-ai.js`
- LazyCodex plugin: `lazycodex/plugins/omo/`
- LazyCodex agents: `lazycodex/plugins/omo/components/ultrawork/agents/*.toml`
- LazyCodex hooks: `lazycodex/plugins/omo/components/*/hooks/hooks.json`
- LazyCodex plugin manifest: `lazycodex/plugins/omo/.codex-plugin/plugin.json`
- LazyCodex skills: `lazycodex/plugins/omo/components/*/skills/*/SKILL.md`, `lazycodex/plugins/omo/skills/*/SKILL.md`
- LazyCodex MCP: `lazycodex/plugins/omo/.mcp.json`
- LazyCodex model catalog: `lazycodex/plugins/omo/model-catalog.json`
- LazyCodex ulw-loop: `lazycodex/plugins/omo/components/ulw-loop/src/`
- LazyCodex rules: `lazycodex/plugins/omo/components/rules/src/`
- LazyCodex ultrawork: `lazycodex/plugins/omo/components/ultrawork/`
- LazyCodex web docs: `lazycodex/packages/web/content/docs/*.md`
- LazyTrae architecture: `docs/lazytrae-architecture-plan.md`