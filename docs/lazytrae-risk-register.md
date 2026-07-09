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

### R-007: .omo Mirror Format Divergence

- **Severity**: LOW
- **Category**: Compatibility
- **Affected versions**: v0.5, v0.9
- **Description**: The .omo compatibility mirror may diverge from LazyCodex's actual format if LazyCodex updates its schema or if LazyTrae implements the mirror incorrectly.
- **LazyCodex reference**: `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` (UlwLoopPlan, UlwLoopItem, etc.), `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (ULW_LOOP_DIR = ".omo/ulw-loop")
- **Mitigation**:
  1. Reference LazyCodex type definitions directly when implementing mirror
  2. Include schema version in mirror files
  3. Run compatibility tests against LazyCodex fixtures
  4. Document any intentional deviations
- **Acceptance criteria**: LazyCodex ulw-loop CLI can read LazyTrae .omo mirror files without errors.

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

## Risk Matrix by Version

| Version | Risks | Highest Severity |
| --- | --- | --- |
| v0.2 | R-002 | MEDIUM |
| v0.3 | R-003 | MEDIUM |
| v0.4 | R-004 | MEDIUM |
| v0.5 | R-006 | HIGH |
| v0.6 | R-002 | MEDIUM |
| v0.7 | R-001, R-005 | HIGH |
| v0.8 | — | LOW |
| v0.9 | R-006, R-008 | HIGH |
| v0.10 | — | LOW |
| v0.11 | R-009 | MEDIUM |
| v0.12 | — | LOW |
| v0.13 | R-011 | LOW |

## Risk Burndown Target

| Severity | Count | Target by v0.13 |
| --- | --- | --- |
| CRITICAL | 0 | 0 |
| HIGH | 2 (R-001, R-006) | Mitigated to MEDIUM or resolved |
| MEDIUM | 6 (R-002, R-003, R-004, R-005, R-008, R-009) | Mitigated or accepted |
| LOW | 3 (R-007, R-010, R-011) | Accepted with documentation |