# LazyTrae Versioned Execution Plan

> **v0.1 — Architecture and Parity Design.** Part of the v0.x series.
> This plan covers v0.2 through v0.14. All versions use the `v0.x` scheme.

## Version Index

| Version | Name | Objective | Depends On |
| --- | --- | --- | --- |
| v0.2 | Rules & Memory | Install the behavioral foundation | v0.1 |
| v0.3 | Skills & Commands | Implement core workflows as Trae Skills and command prompts | v0.2 |
| v0.4 | Custom Agents | Recreate OmO role separation using Trae custom agents | v0.3 |
| v0.5 | State Machine | Add durable long-horizon state | v0.4 |
| v0.6 | CLI Installer | Package LazyTrae so users don't hand-copy files | v0.5 |
| v0.7 | Hooks & Enforcement | Approximate LazyCodex lifecycle enforcement | v0.6 |
| v0.8 | MCP & Tools | Expose LazyTrae state through MCP | v0.7 |
| v0.9 | Long-Horizon Loop | Real LazyTrae equivalent of ulw-loop | v0.8 |
| v0.10 | Model Routing | Approximate OmO category routing | v0.9 |
| v0.11 | Team Mode | Recreate OmO-style parallelism | v0.10 |
| v0.12 | Dogfood | Prove LazyTrae can use itself | v0.11 |
| v0.13 | Diagnostics & Fixes | Diagnose and fix release-blocking gaps | v0.12 |
| v0.14 | Final Release | Produce a usable release | v0.13 |

---

## v0.2 — Rules & Memory

### Objective
Install the behavioral foundation: AGENTS.md, Trae Rules, operating manual, command index, and parity ledger.

### Files to Create/Modify
- `AGENTS.md` — create/update with LazyTrae managed blocks
- `.trae/rules/lazytrae.md` — create
- `docs/lazytrae-operating-manual.md` — create
- `docs/lazytrae-command-index.md` — create
- `docs/lazytrae-parity-ledger.md` — create (initial version)

### LazyCodex Reference
- Rules component: `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (static injection, dynamic injection, context pressure handling, post-compact recovery)
- Bundled rules: `lazycodex/plugins/omo/components/rules/bundled-rules/hephaestus.md`

### Implementation Steps
1. Read the current AGENTS.md to identify existing content and managed blocks.
2. Create `.trae/rules/lazytrae.md` with 8 core rules:
   - Inspect before editing
   - Plan before multi-file changes
   - Preserve LazyCodex semantics (document deviations)
   - Execute one checklist item at a time
   - Verification evidence required before completion
   - Reviewer/Oracle review required for long-horizon completion
   - Update memory after accepted changes
   - Never claim parity without evidence
3. Update AGENTS.md with LazyTrae managed block (project constitution, repository layout, operating rules, quick reference).
4. Create `docs/lazytrae-operating-manual.md` — comprehensive operating guide.
5. Create `docs/lazytrae-command-index.md` — index of all LazyCodex commands mapped to LazyTrae equivalents.
6. Create initial `docs/lazytrae-parity-ledger.md` from the architecture plan.

### Verification Steps
1. Confirm all 5 files exist.
2. Confirm every canonical LazyCodex method from the architecture plan appears in command index or parity ledger.
3. Confirm rules do not contradict LazyCodex source docs (spot-check against `lazycodex/packages/web/content/docs/`).
4. Run any available repo checks.

### Success Criteria
A Trae agent opening the repo immediately understands LazyTrae's operating contract.

### Rollback Strategy
Remove LazyTrae managed blocks from AGENTS.md, delete `.trae/rules/lazytrae.md`, and remove generated docs.

### Risks
- **Low**: AGENTS.md merge conflicts with existing content. Mitigation: use managed block markers (HTML comments) to isolate LazyTrae content.
- **Low**: Rules too verbose, causing context bloat. Mitigation: keep rules concise, target <100 lines for `.trae/rules/lazytrae.md`.

---

## v0.3 — Skills & Commands

### Objective
Implement the core LazyCodex workflows as Trae Skills and command prompts.

### Files to Create/Modify
#### Skills
- `.trae/skills/init-deep/SKILL.md` — create
- `.trae/skills/ulw-plan/SKILL.md` — create
- `.trae/skills/start-work/SKILL.md` — create
- `.trae/skills/ulw-loop/SKILL.md` — create
- `.trae/skills/verifier/SKILL.md` — create
- `.trae/skills/reviewer/SKILL.md` — create
- `.trae/skills/librarian/SKILL.md` — create
- `.trae/skills/migration-planner/SKILL.md` — create
- `.trae/skills/remove-ai-slops/SKILL.md` — create

#### Commands
- `.trae/commands/init-deep.md` — create
- `.trae/commands/ulw-plan.md` — create
- `.trae/commands/start-work.md` — create
- `.trae/commands/ulw-loop.md` — create
- `.trae/commands/ralph-loop.md` — create
- `.trae/commands/review-work.md` — create
- `.trae/commands/remove-ai-slops.md` — create
- `.trae/commands/handoff.md` — create
- `.trae/commands/stop-continuation.md` — create

#### Docs
- `docs/lazytrae-command-index.md` — update
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- Component skills: `lazycodex/plugins/omo/components/ulw-loop/skills/ulw-loop/SKILL.md`, `lazycodex/plugins/omo/components/ultrawork/skills/*/SKILL.md`, `lazycodex/plugins/omo/components/rules/skills/rules/SKILL.md`, `lazycodex/plugins/omo/components/lsp/skills/lsp/SKILL.md`, `lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md`
- Shared skills: `lazycodex/plugins/omo/skills/*/SKILL.md`
- Web docs: `lazycodex/packages/web/content/docs/init-deep.md`, `ulw-plan.md`, `start-work.md`, `ulw-loop.md`, `ultrawork.md`, `skills.md`

### Implementation Steps
1. For each skill, create `SKILL.md` with:
   - name, description/trigger conditions
   - canonical LazyCodex source reference (exact file path)
   - purpose, required context, step-by-step procedure
   - allowed edits, forbidden behavior
   - verification gates, failure handling
   - output format, handoff target
2. For each command, create `.md` with:
   - usage syntax, inputs, outputs, success criteria
   - full prompt template
3. Reference the canonical method map for every skill.
4. Ensure no skill assumes unavailable tools.
5. Update command index and parity ledger.

### Verification Steps
1. Every skill maps back to a canonical LazyCodex method.
2. Every command has usage, inputs, outputs, and success criteria.
3. No skill assumes unavailable tools (check against Trae built-in tool list).
4. Command index updated.
5. Parity ledger updated.

### Success Criteria
A user can manually drive LazyTrae in Trae using skills/commands only.

### Rollback Strategy
Delete generated `.trae/skills/` and `.trae/commands/` directories.

### Risks
- **Medium**: Skill prompts may be too long for effective context usage. Mitigation: keep SKILL.md files concise, use pointer pattern from LazyCodex ultrawork component.
- **Low**: Command names may conflict with existing Trae slash commands. Mitigation: prefix-check against known Trae commands.

---

## v0.4 — Custom Agents

### Objective
Recreate OmO's role separation using Trae custom agents and SOLO subagents.

### Files to Create/Modify
#### Agents
- `.trae/agents/sisyphus.md` — create (main orchestrator)
- `.trae/agents/prometheus.md` — create (planner)
- `.trae/agents/metis.md` — create (pre-planning risk analyst)
- `.trae/agents/momus.md` — create (plan reviewer)
- `.trae/agents/atlas.md` — create (executor)
- `.trae/agents/hephaestus.md` — create (deep autonomous worker)
- `.trae/agents/oracle.md` — create (reviewer/architecture consultant)
- `.trae/agents/librarian.md` — create (memory maintainer)
- `.trae/agents/explorer.md` — create (codebase scout)
- `.trae/agents/cleaner.md` — create (AI-slop remover)
- `.trae/agents/migration-planner.md` — create (host migration)

#### Docs
- `docs/lazytrae-agent-orchestration.md` — create
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- Agent TOML files: `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml`, `librarian.toml`, `plan.toml`, `metis.toml`, `momus.toml`
- Discipline agents doc: `lazycodex/packages/web/content/docs/discipline-agents.md`
- Ultrawork directive: `lazycodex/plugins/omo/components/ultrawork/directive.md`

### Implementation Steps
1. For each agent, define:
   - mission (what it does, when to invoke)
   - LazyCodex/OmO source behavior reference
   - allowed actions (tools, MCP)
   - forbidden actions (e.g., planner cannot edit product code)
   - required context files
   - tools/MCP expectations
   - model/mode guidance (Auto vs Max)
   - handoff format
   - verification responsibility
   - failure behavior
2. Create orchestration doc with flow diagram:
   ```
   init-deep → ulw-plan → plan review (Metis + Momus) → start-work (Atlas) → verifier → reviewer (Oracle) → librarian update → loop or completion
   ```
3. Ensure no conflicting authority between agents.
4. Planner (Prometheus) cannot edit product code.
5. Reviewer/Oracle (Momus for plans, Oracle for code) is read-only by default.
6. Explorer/Librarian are read-only unless explicitly updating docs/memory.
7. Atlas executes one checklist item at a time.

### Verification Steps
1. No conflicting authority between agents.
2. Planner cannot edit product code (check prompt constraints).
3. Reviewer/Oracle is read-only by default.
4. Explorer/Librarian are read-only unless explicitly updating docs/memory.
5. Atlas executes one checklist item at a time.
6. Orchestration doc has a readable diagram.
7. Parity ledger updated.

### Success Criteria
A Trae user can configure or invoke specialized LazyTrae agents from the generated Markdown definitions.

### Rollback Strategy
Remove `.trae/agents/` directory and generated orchestration doc.

### Risks
- **Medium**: Trae custom agents may not support all built-in tools needed for certain roles. Mitigation: verify against Trae agent tool list before finalizing; document any tool gaps.
- **Low**: Agent prompts may be too long, causing context pressure. Mitigation: keep prompts concise, reference skills rather than inlining full procedures.

---

## v0.5 — State Machine

### Objective
Stop relying on prompts alone; add durable long-horizon state.

### Files to Create/Modify
- `.lazytrae/config.json` — create
- `.lazytrae/state/boulder.json` — create (empty initial state)
- `.lazytrae/state/active-loop.json` — create (empty initial state)
- `.lazytrae/state/sessions.json` — create (empty initial state)
- `.lazytrae/evidence/test-runs.md` — create (template)
- `.lazytrae/evidence/verifier.md` — create (template)
- `.lazytrae/evidence/reviewer.md` — create (template)
- `.lazytrae/evidence/oracle-review.md` — create (template)
- `.lazytrae/evidence/completion.md` — create (template)
- `.lazytrae/evidence/handoff.md` — create (template)
- `.lazytrae/schemas/boulder.schema.json` — create
- `.lazytrae/schemas/active-loop.schema.json` — create
- `.lazytrae/schemas/evidence.schema.json` — create
- `.omo/plans/` — create directory
- `.omo/ulw-loop/` — create directory
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- ulw-loop constants: `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts`
- ulw-loop domain types: `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts`
- ulw-loop plan CRUD: `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts`
- ulw-loop evidence: `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts`
- ulw-loop quality gate: `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts`
- Boulder docs: `lazycodex/packages/web/content/docs/start-work.md`, `discipline-agents.md`

### Implementation Steps
1. Create `.lazytrae/config.json` with LazyTrae version, routing config, and feature flags.
2. Define boulder state schema: plan reference, tasks (id, title, status, evidence, assignee, started/completed timestamps), blockers, active task.
3. Define active-loop schema: status (idle/initializing/planning/active/verifying/reviewing/blocked/paused/complete/cancelled), goals, criteria, iteration counter, checkpoints, completion promise.
4. Define evidence schema: kind (test-run/verifier/reviewer/oracle/completion/handoff), timestamp, content, file references, verdict.
5. Create evidence file templates.
6. Create `.omo/` compatibility directories.
7. Document plan parser behavior (read Markdown plans, extract checklist tasks).
8. Document completion gates: all required tasks done, evidence exists, verification passed or waiver documented, reviewer/Oracle passed or caveats accepted, handoff/completion file exists.

### Verification Steps
1. Create a sample plan with checkboxes.
2. Parse it into boulder state (manually or with script).
3. Mark one task complete only with evidence.
4. Attempt to complete without evidence and confirm it fails (logic check).
5. Validate schemas against sample data.
6. Parity ledger updated.

### Success Criteria
LazyTrae can resume work across sessions and cannot honestly mark long-horizon work complete without evidence.

### Rollback Strategy
Remove `.lazytrae/state/`, `.lazytrae/schemas/`, `.lazytrae/evidence/`, `.lazytrae/config.json`, `.omo/` directories. Preserve docs.

### Risks
- **Low**: Schema design may need revision after implementation experience. Mitigation: version schemas from the start (include `version` field).
- **Low**: .omo mirror may diverge from LazyCodex format. Mitigation: reference LazyCodex type definitions directly.

---

## v0.6 — CLI Installer and Doctor

### Objective
Package LazyTrae so users do not hand-copy files.

### Files to Create/Modify
- `packages/cli/src/index.ts` — create (CLI entry point)
- `packages/cli/src/commands/init.ts` — create
- `packages/cli/src/commands/doctor.ts` — create
- `packages/cli/src/commands/sync.ts` — create
- `packages/cli/src/commands/uninstall.ts` — create
- `packages/cli/src/commands/verify.ts` — create
- `packages/cli/src/commands/handoff.ts` — create
- `packages/core/src/repo-scan.ts` — create (repo detection)
- `packages/trae-adapter/src/install-trae-rules.ts` — create
- `packages/trae-adapter/src/install-trae-skills.ts` — create
- `packages/trae-adapter/src/install-trae-commands.ts` — create
- `packages/trae-adapter/src/install-trae-agents.ts` — create
- `packages/trae-adapter/src/install-trae-hooks.ts` — create
- `packages/trae-adapter/src/install-trae-mcp.ts` — create
- `package.json` — update with bin entries
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- Entry point: `lazycodex/bin/lazycodex-ai.js` — thin alias to `npx oh-my-openagent omo install --platform=codex`
- Bootstrap component: `lazycodex/plugins/omo/components/bootstrap/src/cli.ts`, `provision.ts`, `setup.ts`
- Web docs: `lazycodex/packages/web/content/docs/installation.md`, `getting-started.md`

### Implementation Steps
1. Implement `lazytrae init`:
   - Detect repo root (search for `.git`, `package.json`, etc.)
   - Create `.trae/` artifacts (rules, commands, skills, agents, hooks, MCP)
   - Create `.lazytrae/` runtime directories (state, evidence, logs, schemas)
   - Create `.omo/` compatibility directories
   - Generate or merge AGENTS.md with managed blocks
   - Never overwrite user content outside managed blocks
2. Implement `lazytrae doctor`:
   - Validate rules exist and parse
   - Validate skills have SKILL.md
   - Validate commands exist
   - Validate agent prompts exist
   - Validate state schemas
   - Validate .omo mirror is present
   - Validate MCP config parses
   - Validate hook scripts are executable
   - Validate parity ledger covers all discovered methods
3. Implement `lazytrae sync`:
   - Update managed files
   - Preserve user edits outside managed blocks
   - Migrate schema versions
   - Refresh command/skill templates
4. Implement `lazytrae uninstall`:
   - Remove managed LazyTrae files/blocks
   - Preserve plans/evidence by default
   - Support `--purge-state` for full cleanup
5. Implement `lazytrae verify`:
   - Run verification against active boulder/loop state
6. Implement `lazytrae handoff`:
   - Generate handoff summary from current state

### Verification Steps
1. Run init twice and confirm idempotency.
2. Run doctor and confirm all checks pass.
3. Modify a managed block and run sync; confirm repair.
4. Run uninstall; confirm user content preserved.
5. Run uninstall --purge-state; confirm full cleanup.
6. Parity ledger updated.

### Success Criteria
A developer can install LazyTrae into any repo safely with `npx lazytrae-ai init`.

### Rollback Strategy
Use `lazytrae uninstall`. CLI is npm-based, so `npm uninstall -g lazytrae-ai` removes the binary.

### Risks
- **Medium**: AGENTS.md merge can be destructive if managed block markers are malformed. Mitigation: extensive testing with various AGENTS.md formats; always create backup before merge.
- **Low**: File permissions may cause hook script execution failures. Mitigation: doctor checks and warns; `chmod +x` on install.

---

## v0.7 — Hooks and Enforcement

### Objective
Approximate LazyCodex's lifecycle enforcement using Trae hooks.

### Files to Create/Modify
- `.trae/hooks/session-start.sh` — create
- `.trae/hooks/user-prompt-submit.sh` — create
- `.trae/hooks/pre-tool-use.sh` — create
- `.trae/hooks/post-tool-use.sh` — create
- `.trae/hooks/stop.sh` — create
- `packages/cli/src/commands/hook.ts` — create (hook dispatcher)
- `.lazytrae/state/post-compact.json` — create (PostCompact detection state)
- `.lazytrae/logs/hooks.ndjson` — create (hook event log)
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- Plugin manifest hooks: `lazycodex/plugins/omo/.codex-plugin/plugin.json` (lines 22-44)
- Component hooks: `lazycodex/plugins/omo/hooks/post-tool-use-checking-comments.json`, `lazycodex/plugins/omo/components/ulw-loop/hooks/hooks.json`, `lazycodex/plugins/omo/components/rules/hooks/hooks.json`, etc.
- Rules hook: `lazycodex/plugins/omo/components/rules/src/codex-hook.ts`
- Ultrawork hook: `lazycodex/plugins/omo/components/ultrawork/src/codex-hook.ts`
- Comment checker hook: `lazycodex/plugins/omo/components/comment-checker/src/codex-hook.ts`

### Implementation Steps
1. Create hook dispatcher (`lazytrae hook <event>`) as single entry point for all hook scripts.
2. Implement `session-start` hook:
   - Read active plan, active loop, blockers from state files
   - Inject context: "Active boulder: [status]. Current task: [task]. Blockers: [list]. Next action: [action]."
   - Detect PostCompact via state file and re-inject if needed
3. Implement `user-prompt-submit` hook:
   - Detect ulw, ultrawork, start-work, ulw-loop, handoff, stop-continuation keywords
   - Emit skill pointer or directive when keywords detected
   - Check for context-pressure markers
4. Implement `pre-tool-use` hook:
   - Enforce read-before-write where event metadata allows (check if file was read before edit)
   - Warn on destructive commands (rm -rf, force push, etc.)
5. Implement `post-tool-use` hook:
   - Record changed files (extract paths from tool input)
   - Run comment-checker if code was edited (optional, depends on comment-checker port)
   - Detect verification command outputs (test runners, linters)
   - Write to hook event log
6. Implement `stop` hook:
   - If active boulder/loop is incomplete, emit continuation prompt
   - Prevent false completion claims where enforcement is possible
   - Write stop event to session state

### Verification Steps
1. Simulate hook events with JSON fixtures.
2. Confirm active boulder status is injected on session-start.
3. Confirm ulw keyword detection on user-prompt-submit.
4. Confirm incomplete loop produces continuation reminder on stop.
5. Confirm hook logs are written to `.lazytrae/logs/hooks.ndjson`.
6. Parity ledger updated.

### Success Criteria
LazyTrae nudges Trae back to unfinished work instead of relying on conversation memory.

### Rollback Strategy
Disable hook config in `.trae/hooks/` or remove hook files entirely.

### Risks
- **Medium**: PostCompact detection is heuristic and may miss some compaction events. Mitigation: combine multiple detection strategies (SessionStart source, transcript markers, state file tracking).
- **Medium**: Hook scripts may add latency to Trae operations. Mitigation: keep hook scripts fast (<1s), use timeout in hook config, make comment-checker optional.
- **Low**: Hook scripts may fail silently. Mitigation: log all hook output to `.lazytrae/logs/hooks.ndjson`, doctor checks hook exit codes.

---

## v0.8 — MCP and Tools

### Objective
Expose LazyTrae state and verification tools through MCP.

### Files to Create/Modify
- `.trae/mcp.json` — create
- `packages/mcp/src/server.ts` — create (MCP server)
- `packages/mcp/src/tools/get-active-plan.ts` — create
- `packages/mcp/src/tools/get-boulder-status.ts` — create
- `packages/mcp/src/tools/get-next-task.ts` — create
- `packages/mcp/src/tools/record-evidence.ts` — create
- `packages/mcp/src/tools/mark-task-done.ts` — create
- `packages/mcp/src/tools/add-blocker.ts` — create
- `packages/mcp/src/tools/request-review.ts` — create
- `packages/mcp/src/tools/generate-handoff.ts` — create
- `packages/mcp/src/tools/get-parity-status.ts` — create
- `docs/lazytrae-mcp-and-tools.md` — create
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- MCP config: `lazycodex/plugins/omo/.mcp.json`
- MCP servers: grep_app, context7, codegraph, git_bash, lsp
- Codegraph MCP bridge: `lazycodex/plugins/omo/components/codegraph/src/mcp-bridge.ts`

### Implementation Steps
1. Create `.trae/mcp.json` with LazyTrae MCP server entry and optional template servers.
2. Implement LazyTrae MCP server with 9 tools:
   - `lazytrae.get_active_plan` — read and return current active plan
   - `lazytrae.get_boulder_status` — return boulder state summary
   - `lazytrae.get_next_task` — return next actionable task
   - `lazytrae.record_evidence` — write evidence to evidence file
   - `lazytrae.mark_task_done` — mark task complete with evidence
   - `lazytrae.add_blocker` — record a blocker
   - `lazytrae.request_review` — trigger review cycle
   - `lazytrae.generate_handoff` — generate handoff summary
   - `lazytrae.get_parity_status` — return parity ledger status
3. Add optional MCP templates for filesystem, git, playwright/browser, docs/context lookup, ast-grep, LSP diagnostics.
4. Create `docs/lazytrae-mcp-and-tools.md` with tool documentation.

### Verification Steps
1. Validate `.trae/mcp.json` syntax.
2. Start LazyTrae MCP server locally.
3. Call `get_boulder_status` and verify response.
4. Call `record_evidence` and confirm evidence file changes.
5. Call `get_next_task` and verify task selection.
6. Confirm graceful degradation when optional MCP servers are missing.
7. Parity ledger updated.

### Success Criteria
Trae agents can query and mutate LazyTrae state through stable tools instead of editing JSON manually.

### Rollback Strategy
Disable LazyTrae MCP entry in `.trae/mcp.json`; core state files still work manually.

### Risks
- **Low**: MCP server may have compatibility issues with Trae's MCP implementation. Mitigation: test against Trae's MCP protocol; use standard MCP SDK.
- **Low**: State file corruption from concurrent access. Mitigation: use file-based locking (same approach as LazyCodex ulw-loop).

---

## v0.9 — Long-Horizon Execution Loop

### Objective
Implement the real LazyTrae equivalent of ulw-loop.

### Files to Create/Modify
- `packages/core/src/loop-state.ts` — create (loop state machine)
- `packages/core/src/plan-parser.ts` — create (plan parsing)
- `packages/cli/src/commands/loop.ts` — create (loop CLI)
- `.lazytrae/state/active-loop.json` — update with real behavior
- `.lazytrae/logs/loop-events.ndjson` — create
- `.omo/ulw-loop/<run-id>/goals.json` — create (compatibility mirror)
- `.omo/ulw-loop/<run-id>/ledger.jsonl` — create (compatibility mirror)
- `docs/lazytrae-execution-loop.md` — create
- `docs/lazytrae-verifier-protocol.md` — create
- `docs/lazytrae-reviewer-protocol.md` — create
- `docs/lazytrae-failure-recovery.md` — create
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- ulw-loop full source: `lazycodex/plugins/omo/components/ulw-loop/src/` (all files)
- ulw-loop SKILL.md: `lazycodex/plugins/omo/components/ulw-loop/skills/ulw-loop/SKILL.md`
- Web docs: `lazycodex/packages/web/content/docs/ulw-loop.md`, `ultrawork.md`

### Implementation Steps
1. Implement loop state machine with 10 states:
   - idle → initializing → planning → active → verifying → reviewing → (blocked | paused | complete | cancelled)
2. Implement loop cycle (13 steps):
   - Load project memory → normalize goal → create completion promise → generate/load plan → select next task → implement one bounded unit → verify → retry or block on failure → review → update memory → continue or complete
3. Implement iteration caps: 500 in ultrawork mode, 100 in normal mode.
4. Implement checkpointing: save progress after each completed task.
5. Implement steering mutations: add_subgoal, split_subgoal, reorder_pending, revise_pending_wording, revise_criterion, annotate_ledger, mark_blocked_superseded.
6. Implement five evidence gates: plan reread, automated verification, manual-QA, adversarial QA, cleanup.
7. Implement .omo compatibility mirror: write goals.json, ledger.jsonl, brief.md in .omo/ulw-loop/<run-id>/.
8. Create protocol docs for verifier and reviewer.
9. Create failure recovery doc.

### Verification Steps
1. Simulate one documentation-only loop (no code changes).
2. Produce checkpoints.
3. Force a fake verification failure.
4. Confirm loop does not complete.
5. Fix failure.
6. Confirm reviewer passes.
7. Confirm completion file is written.
8. Confirm .omo mirror files are written.
9. Parity ledger updated.

### Success Criteria
LazyTrae can run an auditable end-to-end workflow and resume after interruption.

### Rollback Strategy
Run `lazytrae loop cancel` or set active-loop status to cancelled through CLI.

### Risks
- **Medium**: Loop may get stuck in infinite retry cycles. Mitigation: iteration cap, backoff on repeated failures, require user intervention after N consecutive failures.
- **Medium**: State file corruption on crash. Mitigation: atomic writes, file-based mutation locks, ledger-based recovery.
- **Low**: .omo mirror format may diverge from LazyCodex. Mitigation: reference LazyCodex type definitions directly; run compatibility tests.

---

## v0.10 — Model Routing

### Objective
Approximate OmO category routing.

### Files to Create/Modify
- `.lazytrae/config.json` — update with routing section
- `docs/lazytrae-model-routing.md` — create
- `.trae/agents/*.md` — update with routing hints
- `packages/cli/src/commands/run.ts` — create (optional runner)
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- Model catalog: `lazycodex/plugins/omo/model-catalog.json`
- Web docs: `lazycodex/packages/web/content/docs/model-routing.md`

### Implementation Steps
1. Add routing section to `.lazytrae/config.json`:
   - quick → Auto mode, atlas agent
   - deep → Max mode, hephaestus agent
   - ultrabrain → Max mode + strongest reasoning, oracle agent
   - visual-engineering → Max mode + visual model, sisyphus agent
   - writing → Auto/default, librarian agent
   - review → strongest reasoning, read-only, oracle agent
2. Update agent prompts with routing guidance (model/mode hints).
3. Create `docs/lazytrae-model-routing.md` with routing strategy.
4. Optional: implement `lazytrae run` command with trae-agent backend:
   - `lazytrae run --agent oracle --category ultrabrain "Review the current diff"`
   - `lazytrae run --agent explorer --category quick "Map the auth flow"`
   - `lazytrae run --loop active --trajectory .lazytrae/logs/active-loop.json`

### Verification Steps
1. Confirm native prompts include routing guidance.
2. If trae-agent is installed, run a harmless read-only task.
3. Store trajectory/log if runner is used.
4. Degrade gracefully when runner is absent.
5. Parity ledger updated.

### Success Criteria
Native Trae users get practical routing guidance; power users can get explicit routing through the optional CLI backend.

### Rollback Strategy
Disable runner config in `.lazytrae/config.json`; native LazyTrae continues working.

### Risks
- **Low**: Trae does not support programmatic model switching mid-session. Mitigation: routing is advisory only; document this limitation clearly.
- **Low**: trae-agent backend may not be available or compatible. Mitigation: make it fully optional; degrade gracefully.

---

## v0.11 — Team Mode / Parallel Work

### Objective
Recreate OmO-style parallelism creatively.

### Files to Create/Modify
- `docs/lazytrae-team-mode.md` — create
- `.lazytrae/team/team.json` — create (optional runtime)
- `.lazytrae/team/members/` — create (optional)
- `.lazytrae/team/mailbox/` — create (optional)
- `.lazytrae/team/tasklist.jsonl` — create (optional)
- `packages/cli/src/commands/team.ts` — create (optional)
- `docs/lazytrae-parity-ledger.md` — update

### LazyCodex Reference
- Team mode component: `lazycodex/plugins/omo/components/teammode/`
- Team mode skill: `lazycodex/plugins/omo/components/teammode/skills/teammode/SKILL.md`
- Web docs: `lazycodex/packages/web/content/docs/` (team mode references)

### Implementation Steps
1. Document native version:
   - Use Trae SOLO subagents for read-heavy specialist work
   - Use custom agents for Planner, Reviewer, Explorer, Librarian
   - Use one main orchestrator context for synthesis
   - Parallel read-heavy tasks allowed
   - Parallel write-heavy tasks require separate worktrees
2. Optional runtime version:
   - `.lazytrae/team/` directory structure
   - `lazytrae team create` — initialize team
   - `lazytrae team spawn <role>` — spawn worker
   - `lazytrae team status` — show team status
   - `lazytrae team collect` — gather results
3. Rules:
   - Reviewer, Librarian, Explorer are read-only by default
   - Main orchestrator must synthesize all results
   - No write conflicts between parallel workers

### Verification Steps
1. Spawn two read-only workers (Explorer + Librarian) against fixture repo.
2. Confirm separate logs for each worker.
3. Confirm parent synthesis report.
4. Confirm no write conflicts.
5. Parity ledger updated.

### Success Criteria
LazyTrae can parallelize exploration/review without corrupting implementation state.

### Rollback Strategy
Disable team config in `.lazytrae/config.json` and remove `.lazytrae/team/` runtime state.

### Risks
- **Medium**: Parallel write-heavy tasks may conflict without worktree isolation. Mitigation: enforce worktree requirement for write-heavy parallel tasks.
- **Low**: Team mode adds complexity that may not be needed for MVP. Mitigation: make runtime version optional; native version uses existing Trae subagent capabilities.

---

## v0.12 — Dogfood Run

### Objective
Prove LazyTrae can use itself.

### Files to Create/Modify
- `docs/lazytrae-dogfood-run.md` — create
- `docs/lazytrae-dogfood-plan.md` — create
- `docs/lazytrae-dogfood-review.md` — create
- `docs/lazytrae-parity-ledger.md` — update
- `docs/lazytrae-risk-register.md` — update

### LazyCodex Reference
- Dogfood evidence: `lazycodex/.omo/evidence/` (v11-consolidation.md, v11-slop-report.md, v11-full-e2e.txt, v11-lighthouse.txt, v12-* files, screenshots)

### Implementation Steps
1. Choose one small real task (e.g., improve one skill, add missing verification detail, fix parity-ledger gap, add smoke test, improve docs consistency).
2. Use the full LazyTrae workflow:
   - init-deep → ulw-plan → plan review → start-work → verifier → reviewer → librarian update → ulw-loop if verification fails → handoff
3. Document every step:
   - Selected task and why
   - Plan file
   - Implementation summary
   - Files changed
   - Verification commands and results
   - Reviewer decision
   - Librarian update
   - Final pass/fail status
4. Do not hide failures.

### Verification Steps
1. Show selected task.
2. Show plan.
3. Show changed files.
4. Show commands run.
5. Show verifier result.
6. Show reviewer result.
7. Show memory update.
8. Mark dogfood pass/fail.

### Success Criteria
LazyTrae's own workflow can improve LazyTrae and leave an audit trail.

### Rollback Strategy
Revert any changes made during dogfood run if they cause issues.

### Risks
- **Low**: Dogfood task may reveal issues that require significant rework. Mitigation: choose a small, low-risk task; document issues honestly.

---

## v0.13 — Diagnostics & Fixes

### Objective
Diagnose and fix release-blocking gaps before final release packaging.

### Files to Create/Modify
- `plan/v0.13-diagnostics-fixes.md` — execute the decision-complete diagnostics and fixes plan
- `docs/lazytrae-diagnostics-report.md` — record findings, fixes, and verification evidence

### Verification Steps
1. Run the diagnostics and fixes verification defined in `plan/v0.13-diagnostics-fixes.md`.
2. Record unresolved gaps for v0.14 release packaging.

### Success Criteria
Release-blocking gaps are either fixed with evidence or documented for v0.14.

---

## v0.14 — Final Parity Report and Release

### Objective
Produce a usable release.

### Files to Create/Modify
- `README-LAZYTRAE.md` — create
- `docs/lazytrae-quickstart.md` — create
- `docs/lazytrae-final-parity-report.md` — create
- `docs/lazytrae-known-gaps.md` — create
- `docs/lazytrae-command-index.md` — update (final)
- `docs/lazytrae-agent-orchestration.md` — update (final)
- `docs/lazytrae-verification-matrix.md` — update (final)
- `docs/lazytrae-dogfood-run.md` — update (final)
- `docs/lazytrae-parity-ledger.md` — update (final)
- `docs/lazytrae-risk-register.md` — update (final)

### LazyCodex Reference
- README: `lazycodex/README.md`
- Release artifacts: `lazycodex/package.json`, `lazycodex/bin/lazycodex-ai.js`
- CI/CD: `lazycodex/.github/workflows/`
- Web docs: `lazycodex/packages/web/content/docs/` (20 docs)

### Implementation Steps
1. Create `README-LAZYTRAE.md` with install, commands, architecture, FAQ.
2. Create `docs/lazytrae-quickstart.md` with 5-minute getting-started guide.
3. Create `docs/lazytrae-final-parity-report.md` with:
   - Original LazyCodex method, source path, LazyTrae equivalent, implementation status (complete/partial/deferred/not applicable), evidence path, verification method, caveats
4. Create `docs/lazytrae-known-gaps.md` with honest documentation of all gaps.
5. Final verification:
   - Run all repo tests/checks
   - Run `lazytrae doctor`
   - Run smoke parity check
   - Validate docs links
   - Confirm every skill has usage, inputs, outputs, success criteria
   - Confirm LazyTrae can be used without reading the original LazyCodex repo

### Verification Steps
1. Run all tests/checks.
2. Run `lazytrae doctor`.
3. Run smoke parity check.
4. Check every docs link.
5. Confirm every command/skill has usage, inputs, outputs, success criteria.
6. Confirm LazyTrae can be used without reading the original LazyCodex repo.

### Success Criteria
A developer can install and use LazyTrae from README alone.

### Rollback Strategy
Not applicable — this is the final release.

### Risks
- **Low**: Some gaps may remain unfilled. Mitigation: document honestly in known-gaps.md.
- **Low**: Release may not meet all parity targets. Mitigation: provide parity score estimates with clear methodology.
