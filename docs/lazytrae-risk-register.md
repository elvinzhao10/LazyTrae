# LazyTrae Risk Register

> **v0.1 — Architecture and Parity Design.** Part of the v0.x series.
> This register tracks all identified risks across the LazyTrae implementation.

## Risk Severity Legend

| Severity | Impact | Probability | Action |
| --- | --- | --- | --- |
| CRITICAL | Blocks core workflow | High | Must resolve before v0.13 |
| HIGH | Degrades core workflow | Medium-High | Must mitigate before v0.13 |
| MEDIUM | Affects non-core workflow | Medium | Should mitigate; accept if documented |
| LOW | Minor inconvenience | Low | Accept or mitigate if easy |

## Risk Inventory

### R-001: PostCompact Detection Reliability

- **Severity**: HIGH
- **Category**: Hooks
- **Affected versions**: v0.7, v0.9
- **Description**: Trae has no PostCompact hook event. LazyTrae must detect compaction heuristically via SessionStart source, UserPromptSubmit transcript markers, and state file tracking. These heuristics may miss some compaction events, causing rules and context to not be re-injected after compaction.
- **LazyCodex reference**: `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 38: PostCompact hook), `lazycodex/plugins/omo/components/rules/src/post-compact-state.ts`
- **Mitigation**:
  1. Combine multiple detection strategies (SessionStart source field, transcript content scanning, state file tracking)
  2. Log all detection events for debugging
  3. Document the limitation clearly in known-gaps.md
  4. Provide manual re-injection command (`lazytrae hook re-inject`) as fallback
- **Acceptance criteria**: Detection catches at least 80% of compaction events in testing; remaining cases have documented manual fallback.

### R-002: AGENTS.md Merge Conflicts

- **Severity**: MEDIUM
- **Category**: CLI
- **Affected versions**: v0.2, v0.6
- **Description**: `lazytrae init` must merge LazyTrae content into existing AGENTS.md. If managed block markers are malformed, placed incorrectly, or conflict with existing content, the merge could corrupt the file or lose user content.
- **LazyCodex reference**: LazyCodex does not auto-merge AGENTS.md (it uses `.codex/rules/` directory); this is a LazyTrae-specific concern.
- **Mitigation**:
  1. Use HTML comment markers (`<!-- LAZYTRAE:START -->` / `<!-- LAZYTRAE:END -->`) for managed blocks
  2. Always create backup before merge (`.AGENTS.md.lazytrae.bak`)
  3. Extensive testing with various AGENTS.md formats (empty, existing content, conflicting markers)
  4. Doctor check validates managed block integrity
- **Acceptance criteria**: `lazytrae init` succeeds idempotently on repos with: no AGENTS.md, empty AGENTS.md, AGENTS.md with existing content, AGENTS.md with existing LazyTrae blocks.

### R-003: Skill Prompt Length and Context Bloat

- **Severity**: MEDIUM
- **Category**: Skills
- **Affected versions**: v0.3
- **Description**: SKILL.md files may become too long, consuming excessive context. Trae's context window is limited, and verbose skills reduce effective working memory for the actual task.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ultrawork/src/skill-pointer.ts` — LazyCodex uses a <4096-byte pointer to direct the model to read the full skill, avoiding context bloat from hook output.
- **Mitigation**:
  1. Keep each SKILL.md under 200 lines; use references to external docs for detailed procedures
  2. Use Trae's native skill loading (descriptions are scanned first, full SKILL.md loaded only when relevant)
  3. Prioritize concise, actionable content over comprehensive documentation
  4. Monitor context usage in dogfood run (v0.12)
- **Acceptance criteria**: All 9 SKILL.md files are under 200 lines each; dogfood run shows no context-pressure failures.

### R-004: Trae Custom Agent Tool Limitations

- **Severity**: MEDIUM
- **Category**: Agents
- **Affected versions**: v0.4
- **Description**: Trae custom agents have access to specific built-in tools (read, file system, terminal, web search, preview). Some LazyCodex agent roles (e.g., Explorer using `lsp_goto_definition`, `lsp_find_references`) require tools not available to Trae custom agents.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` (Tool strategy section: lsp_*, ast-grep, rg, glob, read, git)
- **Mitigation**:
  1. Verify Trae custom agent tool list before finalizing agent prompts
  2. Document any tool gaps in agent prompt (e.g., "If LSP tools are unavailable, use grep-based search")
  3. Provide MCP-based alternatives where possible (e.g., LSP MCP server)
  4. Accept that some LazyCodex agent capabilities (LSP-based code navigation) may be degraded
- **Acceptance criteria**: Each agent prompt explicitly lists available tools; 80% of LazyCodex agent tool usage is covered.

### R-005: Hook Script Performance Impact

- **Severity**: MEDIUM
- **Category**: Hooks
- **Affected versions**: v0.7
- **Description**: Hook scripts that run on every PostToolUse or UserPromptSubmit could add latency to Trae operations. If hooks are slow (>1s), they degrade the user experience.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ulw-loop/hooks/hooks.json` (timeout: 10 for UserPromptSubmit, 5 for PreToolUse)
- **Mitigation**:
  1. Keep all hook scripts fast (<500ms target, <1s hard limit)
  2. Use timeout in hook configuration (Trae supports hook timeouts)
  3. Make expensive operations (comment-checker, LSP diagnostics) optional and configurable
  4. Profile hook performance in dogfood run
- **Acceptance criteria**: All hook scripts complete in under 1 second; Trae operations feel responsive.

### R-006: State File Corruption on Crash

- **Severity**: HIGH
- **Category**: State Machine
- **Affected versions**: v0.5, v0.9
- **Description**: If LazyTrae or Trae crashes while writing state files (boulder.json, active-loop.json), the files could be corrupted, leaving the workflow in an unrecoverable state.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ulw-loop/src/plan-io.ts` (withUlwLoopMutationLock — file-based locking), `lazycodex/plugins/omo/components/ulw-loop/src/ledger.jsonl` (append-only audit trail for recovery)
- **Mitigation**:
  1. Use atomic writes (write to temp file, then rename)
  2. Use file-based mutation locks (same approach as LazyCodex ulw-loop)
  3. Maintain append-only ledger (ledger.jsonl) for recovery
  4. Doctor command includes state file integrity check
  5. Provide `lazytrae doctor --repair-state` for recovery
- **Acceptance criteria**: Kill process during state write; state is recoverable from ledger; doctor detects and reports corruption.

### R-007: Retired .omo Mirror Format Divergence

- **Severity**: LOW
- **Category**: Compatibility
- **Affected versions**: v0.5, v0.9; retired in v0.15
- **Description**: The `.omo` compatibility mirror was retired in v0.15, eliminating the risk of a LazyTrae-managed mirror diverging from LazyCodex's format.
- **Canonical state**: Active LazyTrae state is stored only in `.lazytrae`. Any pre-existing `.omo` data is foreign or legacy data and is not read or managed by LazyTrae.
- **Mitigation**:
  1. Maintain `.lazytrae` as the only active canonical state location.
  2. Do not add `.omo` migration, mirror, read, or management behavior.
  3. Keep historical references to the retired mirror clearly marked as historical.
- **Acceptance criteria**: Active LazyTrae documentation and runtime behavior provide no `.omo` compatibility-mirror instruction or management path.

### R-008: Loop Infinite Retry Cycles

- **Severity**: MEDIUM
- **Category**: Long-Horizon Loop
- **Affected versions**: v0.9
- **Description**: The ulw-loop may get stuck in infinite retry cycles if verification consistently fails and the model keeps retrying without making progress.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (iteration cap: 500 in ultrawork mode, 100 in normal mode), `lazycodex/packages/web/content/docs/ulw-loop.md`
- **Mitigation**:
  1. Implement iteration caps (500 ultrawork, 100 normal)
  2. Implement backoff on repeated failures (exponential or linear)
  3. Require user intervention after N consecutive failures on the same task
  4. Track blocker signatures to detect repeated blockers
  5. Steering mechanism to allow user to override or skip stuck tasks
- **Acceptance criteria**: Loop stops after 3 consecutive failures on the same task and requests user intervention; iteration cap is enforced.

### R-009: Parallel Write Conflicts in Team Mode

- **Severity**: MEDIUM
- **Category**: Team Mode
- **Affected versions**: v0.11
- **Description**: If two parallel workers attempt to write to the same file, conflicts can corrupt implementation state. LazyCodex handles this via worktree isolation.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/teammode/` (team mode component), `lazycodex/packages/web/content/docs/` (team mode documentation)
- **Mitigation**:
  1. Enforce worktree requirement for parallel write-heavy tasks
  2. Read-only workers (Explorer, Librarian, Reviewer) can run in parallel safely
  3. Main orchestrator serializes write operations
  4. Document parallel safety rules clearly
- **Acceptance criteria**: No write conflicts in team mode test with 2+ parallel workers; documented rules prevent unsafe parallelism.

### R-010: Trae API/Behavior Changes

- **Severity**: LOW
- **Category**: Platform
- **Affected versions**: All
- **Description**: Trae IDE may change its APIs, hook format, MCP protocol, or agent capabilities in future updates, breaking LazyTrae's integration.
- **LazyCodex reference**: Not applicable — this is a platform risk.
- **Mitigation**:
  1. Use only documented Trae features (verified from docs.trae.cn)
  2. Doctor command detects breaking changes (e.g., hooks.json format changes)
  3. Version LazyTrae against Trae versions
  4. Maintain compatibility layer in `packages/trae-adapter/`
- **Acceptance criteria**: Doctor command flags Trae version incompatibilities; LazyTrae has clear minimum Trae version requirement.

### R-011: Incomplete Parity Coverage

- **Severity**: LOW
- **Category**: Parity
- **Affected versions**: v0.13
- **Description**: Some LazyCodex features may not have complete LazyTrae equivalents by v0.13, leaving gaps in the parity ledger.
- **LazyCodex reference**: All components under `lazycodex/plugins/omo/components/`
- **Mitigation**:
  1. Track every LazyCodex method in the parity ledger from v0.1
  2. Classify gaps honestly: complete, partial, deferred, not applicable
  3. Document known gaps in known-gaps.md
  4. Prioritize core workflow features over nice-to-have features
- **Acceptance criteria**: Parity ledger covers 100% of discovered LazyCodex methods; deferred items have documented rationale.

### R-012: No PostCompact Hook Event (Fundamental Platform Gap)

- **Severity**: HIGH
- **Category**: Platform
- **Affected versions**: All
- **Description**: Trae IDE does not have a PostCompact hook event. LazyCodex uses PostCompact to reset rule caches and re-inject rules after every context compaction. Without this, rules injected by hooks may be lost after compaction, and the agent may not have access to project rules without re-reading them manually.
- **LazyCodex reference**: `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 38: PostCompact hook), `lazycodex/plugins/omo/components/rules/src/post-compact-state.ts`
- **Mitigation**:
  1. Detect compaction heuristically via SessionStart source field and UserPromptSubmit transcript markers
  2. Maintain compaction state in `.lazytrae/state/sessions.json`
  3. SessionStart hook checks for post-compact recovery flag and re-injects context
  4. UserPromptSubmit hook scans for compaction markers and sets recovery flag
  5. Document the limitation clearly — detection may miss some compaction events
- **Acceptance criteria**: Detection catches >= 80% of compaction events; remaining cases have manual fallback (re-inject command).
- **Fundamental limitation**: This can never be fully fixed in Trae — the hook event doesn't exist. Best-effort detection only.

### R-013: No TOML-Backed Agent Role Routing (Fundamental Platform Gap)

- **Severity**: MEDIUM
- **Category**: Platform
- **Affected versions**: All
- **Description**: LazyCodex agents are TOML files with `model`, `reasoning_effort`, `service_tier`, and `disallowed_tools` that the platform enforces at runtime. Trae's Task/subagent tool cannot select roles by name — agent role requirements must be pasted into the task description as text. There is no runtime guarantee that a subagent is actually operating under the specified role constraints (model, tools, effort level).
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ultrawork/agents/*.toml`, `multi_agent_v1.spawn_agent` with role parameter
- **Mitigation**:
  1. Document role requirements in task descriptions explicitly
  2. Use YAML frontmatter in agent .md files as specification (even if not enforced)
  3. Agent instructions explicitly state what tools and model to use
  4. Reviewer verifies subagent output quality as a check
  5. Document this as a known fidelity gap
- **Acceptance criteria**: All agents have frontmatter specifications; task descriptions include role requirements; quality differences are documented.
- **Fundamental limitation**: Trae has no role-based subagent routing. This is a best-effort text-based workaround.

### R-014: Synchronous Subagents (Fundamental Platform Gap)

- **Severity**: MEDIUM
- **Category**: Platform
- **Affected versions**: All
- **Description**: LazyCodex `multi_agent_v1.spawn_agent` returns immediately, and the parent uses `multi_agent_v1.wait_agent` to poll — allowing the parent to continue working while subagents run. Trae's Task/subagent tool is synchronous — the parent blocks until the subagent returns. This means: (1) no parallel execution of parent and subagent work, (2) no progress updates during long subagent tasks, (3) the parent can't do independent root work while exploration subagents run.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` (strategy: parallel read-only exploration), `multi_agent_v1.wait_agent`
- **Mitigation**:
  1. Launch all read-only subagents (explorer, librarian) at the start and wait for all together
  2. Use batch parallelism (multiple subagents at once) instead of interleaved parallelism
  3. Break work into smaller subagent tasks to reduce blocking time
  4. Document the synchronous model and its impact on workflow
- **Acceptance criteria**: Parallel exploration phases use batch parallelism; documentation clearly states synchronous model.
- **Fundamental limitation**: Trae subagents are synchronous. This is a workflow adaptation, not a fix.

### R-015: Non-Blocking Hooks — Evidence Gate Is Advisory (Fundamental Platform Gap)

- **Severity**: HIGH
- **Category**: Platform
- **Affected versions**: All
- **Description**: Trae hooks cannot block operations — all hooks must exit 0. LazyCodex hooks can block: the Stop hook prevents session termination if evidence gates haven't passed, PreToolUse denies destructive operations, and PostToolUse rejects edits that fail quality checks. This is how LazyCodex **mechanically enforces** its evidence gate and quality bar. In LazyTrae, the Stop hook can only print a continuation reminder that the user can dismiss. This means the evidence/completion gate is advisory, not enforced — a user can always end a session without passing verification gates.
- **LazyCodex reference**: `lazycodex/plugins/omo/.codex-plugin/plugin.json` (lines 30, 33, 41-42: PreToolUse, PostToolUse, Stop hooks with blocking capability)
- **Mitigation**:
  1. Reviewer/Oracle protocol emphasizes completion claims without evidence are invalid
  2. Hooks provide prominent reminders and warnings
  3. Agent instructions (ulw-loop skill) require evidence before claiming completion
  4. Document this as the defining structural deficit vs LazyCodex
- **Acceptance criteria**: Non-blocking limitation is documented in hooks reference, risk register, and parity ledger. Soft enforcement via agent discipline is the accepted mitigation.
- **Fundamental limitation**: Trae would need to support non-zero exit codes in hooks to block operations. This is not currently available. This is the **single sharpest differentiator** between LazyTrae and LazyCodex/LazyBuddy — LazyBuddy can block; Trae cannot.

## Risk Matrix by Version

| Version | Risks | Highest Severity |
| --- | --- | --- |
| v0.2 | R-002 | MEDIUM |
| v0.3 | R-003 | MEDIUM |
| v0.4 | R-004 | MEDIUM |
| v0.5 | R-006 | HIGH |
| v0.6 | R-002 | MEDIUM |
| v0.7 | R-001, R-005, R-012, R-015 | HIGH |
| v0.8 | — | LOW |
| v0.9 | R-006, R-008 | HIGH |
| v0.10 | — | LOW |
| v0.11 | R-009, R-014 | MEDIUM |
| v0.12 | — | LOW |
| v0.13 | R-011 | LOW |
| All | R-010, R-012, R-013, R-014, R-015 (platform risks) | HIGH |

## Risk Burndown Target

| Severity | Count | Target by v0.13 |
| --- | --- | --- |
| CRITICAL | 0 | 0 |
| HIGH | 4 (R-001, R-006, R-012, R-015) | Mitigated to MEDIUM or resolved; R-012/R-015 accepted as fundamental platform limitations |
| MEDIUM | 8 (R-002, R-003, R-004, R-005, R-008, R-009, R-013, R-014) | Mitigated or accepted; R-013/R-014 accepted as fundamental platform limitations |
| LOW | 3 (R-007, R-010, R-011) | Accepted with documentation |
