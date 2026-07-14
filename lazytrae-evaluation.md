# LazyTrae Evaluation: LazyCodex Parity Assessment

> Comprehensive evaluation of how well LazyTrae realizes LazyCodex/OmO semantics on its Trae Work and CLI release surfaces.
> Last updated: v0.14 (2026-07-10)

## Overall Assessment

**Parity score: 115/126 (91.3%).**

LazyTrae successfully recreates LazyCodex/OmO's core agent-harness workflows on Trae IDE — the Explore → Plan → Implement → Verify → Manually QA loop, the 5 evidence gates, the Sisyphus completion contract, durable run state, and the long-horizon loop. The remaining 4 gaps are all platform-inherent (Trae lacks the hook event or external tool), each mitigated with a documented heuristic fallback.

| Category | Total | Complete | Gap | N/A |
|---|---|---|---|---|
| Core Commands | 10 | 10 | 0 | 0 |
| Agent Roles | 11 | 11 | 0 | 0 |
| Hooks | 16 | 12 | 2 | 1 |
| State Management | 15 | 15 | 0 | 0 |
| Verification Gates | 7 | 7 | 0 | 0 |
| MCP Servers | 6 | 5 | 1 | 0 |
| Model Routing | 7 | 6 | 0 | 1 |
| Skills (Shared) | 22 | 22 | 0 | 0 |
| Ultrawork/ulw-loop Core | 15 | 14 | 0 | 1 |
| Rules Component | 10 | 7 | 1 | 1 |
| Team Mode | 7 | 6 | 0 | 1 |
| **Total** | **126** | **115** | **4** | **5** |

## Strengths

### 1. All core commands and agent roles ported
All 10 canonical commands (`init-deep`, `ulw-plan`, `start-work`, `ulw-loop`, `ralph-loop`, `stop-continuation`, `handoff`, `review-work`, `remove-ai-slops`, `completion-gate`) and all 11 agent roles (Sisyphus, Prometheus, Metis, Momus, Atlas, Hephaestus, Oracle, Explorer, Librarian, Cleaner, Migration-Planner) are implemented as Trae-native `.trae/` artifacts.

### 2. All 7 verification gates enforced
plan reread → automated verification → manual-QA → adversarial QA → cleanup → completion claim → handoff. The completion gate is hardened via a CLI/MCP layer (`lazytrae verify --must-pass`, `mark_task_done` refuses completion without evidence), because Trae hooks cannot block.

### 3. Durable run state with checkpointing
`.lazytrae/state/` holds boulder state, active-loop state, session tracking, evidence, and checkpoints. The long-horizon loop runs a 10-state machine with a 13-step cycle, 3-retry on verification failure, steering mutations, and resumption after interruption (500-iteration cap HEAVY / 100 LIGHT).

### 4. Evidence-based completion (Sisyphus contract)
DoneClaim → AdversarialVerify → FullyDone preserved. `mark_task_done` is evidence-gated: an implementer cannot close a task without a recorded verification artifact.

### 5. Team mode with worktree isolation
Parallel-work coordination via file-based team state, worktree isolation per member, and mailbox-file communication — adapted from LazyCodex's thread-based team mode to Trae's ephemeral subagents.

### 6. Model routing
6 categories (quick, deep, ultrabrain, visual-engineering, writing, review) mapped to Trae Auto/Max modes and agent frontmatter.

### 7. Test coverage
53 tests across 9 files: security (symlink escape, path boundary, shell injection), loop runtime (state transitions, retry, checkpoint semantics, steering), and template parity (templates mirror repo artifacts, fresh init self-contained).

## Weaknesses

### 1. Hooks are advisory-only — enforcement pushed to the CLI layer (platform gap)
**LazyCodex:** hooks can block tool calls / completion at the platform level.
**LazyTrae:** Trae hooks cannot block (all hook scripts `exit 0`). Enforcement is moved into a CLI/MCP layer: `lazytrae verify --must-pass` and `mark_task_done` refuse completion without evidence.
**Impact:** Safety depends on the CLI gate being invoked, not on a host-level block. A user who bypasses the CLI can complete without evidence.
**Why:** Trae's hook contract has no deny/block output. This is the inverse of the WorkBuddy sibling, which bets on host hook blocking.

### 2. PostCompact hook missing
**LazyCodex:** uses PostCompact for cache resets and rule re-injection.
**LazyTrae:** Trae has no PostCompact event. Mitigated via SessionStart compaction detection + UserPromptSubmit context-pressure markers + a context-recovery hook.
**Impact:** Post-compact recovery is heuristic, not event-driven.
**Why:** Trae's hook surface lacks the event.

### 3. Codegraph MCP unavailable
**LazyCodex:** parsed AST call graph via codegraph.
**LazyTrae:** no suitable code-graph server for Trae; heuristic local context tools (`symbol_search`, `find_references`, `goto_definition`, `dependency_graph`) provided as fallback.
**Impact:** No precise AST call graph; blast-radius analysis is approximate.
**Why:** codegraph relies on external binaries not available on Trae.

### 4. Codegraph init hook + native post-compact recovery
The codegraph init hook depends on the codegraph MCP (gap 3), and post-compact recovery is heuristic-only rather than a native hook.

## Future Improvement Suggestions

### Priority 1: Native codegraph/LSP integration
If a Trae-compatible code-graph or LSP MCP becomes available, wire `symbol_search`/`goto_definition`/`find_references` to it, replacing grep heuristics with semantic intelligence.

### Priority 2: Native hook blocking
If Trae adds a deny/block hook contract, move the completion gate from the CLI layer back to a host Stop/SubagentStop hook (matching the WorkBuddy sibling's strategy) for defense-in-depth.

### Priority 3: Native PostCompact event
If Trae exposes PostCompact, replace heuristic context-recovery with event-driven cache reset + rule re-injection.

### Priority 4: Port deferred skills
`refactor`, `programming`, `frontend`, `git-master`, `ast-grep`, `lcx-report-bug` are currently embedded in `start-work` or deferred. Port as standalone skills if demand exists.

### Priority 5: Live orchestrator dogfood
A true end-to-end multi-agent session test: orchestrator spawns implementer → implementer produces evidence → `mark_task_done` verifies → reviewer accepts/rejects → librarian updates memory → `verify --must-pass` passes.

## Capability Labels Summary

| Label | Meaning |
|---|---|
| `semantic` | Matches LazyCodex semantics with a structured source of truth (state.json, DoneClaim, loop machine) |
| `cli-gated` | Enforcement via the CLI/MCP layer (`verify --must-pass`, `mark_task_done`) because Trae hooks can't block |
| `heuristic` | Grep/approximation-based fallback (context tools, post-compact recovery) |
| `host-substitution` | Trae covers the use case through a different surface (subagents vs threads, mkdir lock vs in-process lock) |
| `platform-gap` | Original surface not portable to Trae (PostCompact event, codegraph) |
| `native-enhancement` | LazyTrae-only (CLI doctor/sync, file-based team state) |

## Conclusion

LazyTrae achieves **strong parity (91.3%)** with LazyCodex/OmO's core agent-harness design on Trae IDE. The Explore → Plan → Implement → Verify → Manually QA loop is fully functional with evidence-gated completion, durable run state, and a long-horizon loop. The 4 remaining gaps are all platform-inherent (Trae lacks the hook event or external tool), each mitigated with a documented heuristic fallback.

The defining adaptation is the **enforcement strategy inversion**: where the WorkBuddy sibling bets on host hook blocking, LazyTrae — because Trae hooks cannot block — moves the completion gate into a CLI/MCP layer. Both preserve the Sisyphus "no evidence, no done" invariant; they just pick the mechanism their host allows.

## Public capability status contract

The v0.17 read-only capability report uses the vendor-owned LazySeries record: `schema_version`, `contract_version`, `contract_digest`, `host`, `capability`, `provider` (nullable), `status`, `reason_code` (nullable), `message`, `receipt` (nullable `{owner, schema_version, state}`), and object `details`. Its only public statuses are `host-ready`, `owned-ready`, `missing`, `incompatible`, `disabled`, `failed-optional`, and `not-initialized`. A status record reports observed readiness; it does not select, install, enable, or start a provider.

## Optional capability policy

Optional integrations remain opt-in. A status, doctor, or load-check does not run package managers, activate a provider, alter host configuration, export an MCP fragment, or make a network request. The existing automatic-tooling policy remains the authority for any separately requested lifecycle action. Normal CI is self-contained within this repository; paired LazyTrae/LazyBuddy parity is a release-only check that receives a sibling path explicitly and creates no runtime dependency.

## Receipt and safe removal

Removal accepts only exact receipt-owned entries. Expected mutable runtime entries are tolerated only where the receipt already owns them; unknown siblings, tampered entries, symlinks, and hardlinks are rejected. Project lockfiles, user configuration, caller-owned CodeGraph indexes, and host registrations survive. Use `lazytrae uninstall` for managed project assets; remove a Trae-host registration through that host's own UI or CLI rather than treating package removal as host removal.

## Package readiness versus host verification

`lazytrae load-check`, `doctor`, and the canonical status report verify package files, declared configuration, and local optional-state evidence. They do not prove that Trae discovered the project configuration, loaded a plugin, or connected an MCP server. A new host session and the host's MCP status are the required separate observation.

## JSON-RPC resilience

The stdio MCP transport is line-oriented JSON-RPC. Malformed JSON yields one `-32700` response with `id: null`; an invalid request yields `-32600`; notifications receive no response; and a later valid request on the same stream remains processable. Protocol JSON is the only stdout content. This documents package behavior, not proof that a host connected the server.

## Host-specific exclusions

LazyTrae keeps Trae-specific layouts and commands: project assets are `.trae/` and `.lazytrae/`; Trae CLI registration uses `trae-cli mcp add-json`; and Trae Work uses the explicit `lazytrae work install` command plus manual **Settings → MCP** registration. The project declaration inventory is ten MCP declarations: one `lazytrae` core declaration exposing 15 tools after connection and optional declarations, including filesystem and Playwright templates. Optional declaration presence is not activation, installation, or a live connection.

## Known unverified host behavior

Trae IDE discovery after reopening, Trae Work reload/discovery, host-managed MCP connection, and every non-macOS Trae Work skills location require manual host confirmation. The package does not claim that copied files, a declaration, or an installer command proves any of those host outcomes.

## macOS verification scope

The Trae Work global-skill destination `~/.trae-cn/skills/` and `lazytrae work install` behavior are verified on **macOS only**. Linux and Windows paths and host behavior are unverified; use an explicit `--skills-dir` only after the host reports the directory.
