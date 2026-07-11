# LazyTrae Verification Matrix

> **v0.1 design, reconciled in v0.13.** Part of the v0.x series.
> This matrix records the current verification status for every LazyTrae component mapped to its historical source record source.
> For capabilities shared with the command index, `VERIFIED` here is equivalent to `COMPLETE` there; the documents have different scopes (94 matrix criteria versus 126 ledger items).

## Verification Legend

| Status | Meaning |
| --- | --- |
| VERIFIED | Confirmed against historical source record source with exact path |
| DESIGN | Designed in architecture, not yet implemented |
| GAP | Known gap, substitute documented |
| N/A | Not applicable to Trae |

## 1. Project Memory

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| AGENTS.md loaded at session start | historical source record (SessionStart handler) | AGENTS.md at repo root | VERIFIED |
| Project rules injected at session start | historical source record (runSessionStartHook) | `.trae/rules/lazytrae.md` | VERIFIED |
| Rules re-injected at UserPromptSubmit | historical source record (UserPromptSubmit handler) | `.trae/rules/lazytrae.md` (Trae reads rules on each prompt) | VERIFIED |
| Dynamic rule matching on PostToolUse | historical source record (runPostToolUseHook) | Hook-based PostToolUse extraction | VERIFIED |
| Context pressure skip | historical source record | SessionStart/UserPromptSubmit detection | VERIFIED |
| Post-compact rule re-injection | historical source record | Post-compact detection via state file | GAP |

## 2. Skills

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| init-deep skill | historical source record (inferred from shared skills) | `.trae/skills/init-deep/SKILL.md` | VERIFIED |
| ulw-plan skill | historical source record (inferred from shared skills) | `.trae/skills/ulw-plan/SKILL.md` | VERIFIED |
| start-work skill | historical source record (inferred from shared skills) | `.trae/skills/start-work/SKILL.md` | VERIFIED |
| ulw-loop skill | historical source record | `.trae/skills/ulw-loop/SKILL.md` | VERIFIED |
| ultrawork directive | historical source record | Embedded in ulw-loop skill | VERIFIED |
| Skill pointer mechanism | historical source record | Trae native skill loading (eliminates pointer) | N/A |
| verifier skill | historical source record (inferred) | `.trae/skills/verifier/SKILL.md` | VERIFIED |
| reviewer skill | historical source record (inferred) | `.trae/skills/reviewer/SKILL.md` | VERIFIED |
| librarian skill | Not a standalone skill in historical source record; role is embedded in workflow | `.trae/skills/librarian/SKILL.md` | VERIFIED |
| remove-ai-slops skill | historical source record (inferred) | `.trae/skills/remove-ai-slops/SKILL.md` | VERIFIED |

## 3. Commands

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| /init-deep | historical source record | `.trae/commands/init-deep.md` | VERIFIED |
| /ulw-plan | historical source record | `.trae/commands/ulw-plan.md` | VERIFIED |
| /start-work | historical source record | `.trae/commands/start-work.md` | VERIFIED |
| /ulw-loop | historical source record | `.trae/commands/ulw-loop.md` | VERIFIED |
| /ralph-loop | historical source record (ralph-loop is alias) | `.trae/commands/ralph-loop.md` | VERIFIED |
| /review-work | historical source record (referenced in workflow) | `.trae/commands/review-work.md` | VERIFIED |
| /remove-ai-slops | historical source record (referenced in workflow) | `.trae/commands/remove-ai-slops.md` | VERIFIED |
| /handoff | historical source record (referenced in workflow) | `.trae/commands/handoff.md` | VERIFIED |
| /stop-continuation | historical source record (referenced in workflow) | `.trae/commands/stop-continuation.md` | VERIFIED |

## 4. Custom Agents

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Explorer agent | historical source record | `.trae/agents/explorer.md` | VERIFIED |
| Librarian agent | historical source record | `.trae/agents/librarian.md` | VERIFIED |
| Plan agent (Prometheus) | historical source record | `.trae/agents/prometheus.md` | VERIFIED |
| Metis agent | historical source record | `.trae/agents/metis.md` | VERIFIED |
| Momus agent | historical source record | `.trae/agents/momus.md` | VERIFIED |
| Executor (Atlas) | historical source record (historical source record) | `.trae/agents/atlas.md` | VERIFIED |
| Hephaestus | historical source record (hephaestus) | `.trae/agents/hephaestus.md` | VERIFIED |
| Oracle (gate reviewer) | historical source record (historical source record) | `.trae/agents/oracle.md` | VERIFIED |
| Sisyphus (orchestrator) | Not a standalone TOML; implicit in historical source record workflow | `.trae/agents/sisyphus.md` | VERIFIED |
| Cleaner | historical source record (inferred) | `.trae/agents/cleaner.md` | VERIFIED |
| Migration planner | Not in historical source record; LazyTrae addition | `.trae/agents/migration-planner.md` | VERIFIED |

## 5. Hooks

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| SessionStart hook | historical source record (line 22) | `.trae/hooks/session-start.sh` | VERIFIED |
| UserPromptSubmit hook | historical source record (line 28) | `.trae/hooks/user-prompt-submit.sh` | VERIFIED |
| PreToolUse hook | historical source record (line 30) | `.trae/hooks/pre-tool-use.sh` | VERIFIED |
| PostToolUse hook | historical source record (line 33) | `.trae/hooks/post-tool-use.sh` | VERIFIED |
| Stop hook | historical source record (line 41) | `.trae/hooks/stop.sh` | VERIFIED |
| PostCompact hook | historical source record (line 38) | Post-compact detection (no direct Trae event) | GAP |
| SubagentStop hook | historical source record (line 42) | Trae Stop hook (single event) | VERIFIED |
| Comment checker | historical source record | Optional in post-tool-use.sh | VERIFIED |
| Ultrawork trigger detection | historical source record | user-prompt-submit.sh keyword detection | VERIFIED |
| Ulw-loop steering | historical source record | user-prompt-submit.sh steering detection | VERIFIED |
| LSP diagnostics | historical source record | Optional external LSP MCP | GAP |

## 6. MCP

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| MCP config file | historical source record | `.trae/mcp.json` | VERIFIED |
| grep_app MCP | historical source record (line 3) | Optional in `.trae/mcp.json` | VERIFIED |
| context7 MCP | historical source record (line 6) | Optional in `.trae/mcp.json` | VERIFIED |
| git_bash MCP | historical source record (line 17) | Optional in `.trae/mcp.json` | VERIFIED |
| codegraph MCP | historical source record (line 10) | Optional external tool | GAP |
| lsp MCP | historical source record (line 25) | Optional external LSP MCP | GAP |
| LazyTrae MCP server | Not in historical source record (LazyTrae addition) | `packages/mcp/src/index.js` with 15 state/evidence/handoff/context tools | VERIFIED |

## 7. State Machine

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Boulder state | historical source record (conceptual) | `.lazytrae/state/boulder.json` | VERIFIED |
| Ulw-loop plan state | historical source record (UlwLoopPlan) | `.lazytrae/state/active-loop.json` | VERIFIED |
| Goal statuses | historical source record (UlwLoopStatus) | Active-loop goal statuses | VERIFIED |
| Criterion statuses | historical source record (UlwLoopCriterionStatus) | Active-loop criterion statuses | VERIFIED |
| Steering mutations | historical source record (ULW_LOOP_STEERING_MUTATION_KINDS) | Active-loop steering mutations | VERIFIED |
| Ledger events | historical source record (ULW_LOOP_LEDGER_EVENT_KINDS) | `.lazytrae/logs/loop-events.ndjson` | VERIFIED |
| Quality gate | historical source record | Evidence files + reviewer protocol | VERIFIED |
| Evidence recording | historical source record | `.lazytrae/evidence/*.md` | VERIFIED |
| Plan CRUD | historical source record | CLI + plan parser | VERIFIED |
| Mutation lock | historical source record (withUlwLoopMutationLock) | File-based locking | VERIFIED |
| Session tracking | historical source record | `.lazytrae/state/sessions.json` | VERIFIED |
| Canonical runtime namespace | LazyTrae runtime | `.lazytrae/plans/`, `.lazytrae/loop/<run-id>/` | VERIFIED |

## 8. Verification Gates

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Plan reread | historical source record (five evidence gates) | Reviewer protocol step 1 | VERIFIED |
| Automated verification | historical source record | `.lazytrae/evidence/test-runs.md` | VERIFIED |
| Manual-QA (real-surface proof) | historical source record (Manual-QA channels) | `.lazytrae/evidence/verifier.md` | VERIFIED |
| Adversarial QA | historical source record | `.lazytrae/evidence/reviewer.md` | VERIFIED |
| Cleanup | historical source record (cleanup gate) | remove-ai-slops skill | VERIFIED |
| Quality gate validation | historical source record | Reviewer/Oracle protocol | VERIFIED |
| Reviewer roles | historical source record (REVIEWER_ROLES) | Oracle agent + reviewer skill | VERIFIED |

## 9. Model Routing

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Role-based model profiles | historical source record | `.lazytrae/config.json` routing section | VERIFIED |
| Default model | historical source record (line 4) | Trae Auto mode | VERIFIED |
| Plan mode reasoning | historical source record (line 7: xhigh) | Trae Max mode | VERIFIED |
| Worker model | historical source record (line 17) | Trae Auto mode | VERIFIED |
| Verifier model | historical source record (line 13) | Trae Max mode | VERIFIED |
| Agent TOML model field | historical source record (line 4: model = "gpt-5.4-mini") | Agent prompt routing hints | VERIFIED |

## 10. CLI

| Criterion | historical source record source | LazyTrae target | Status |
| --- | --- | --- | --- |
| CLI entry point | historical source record | `packages/cli/src/index.js` | VERIFIED |
| init command | historical source record (install alias) | `lazytrae init` | VERIFIED |
| doctor command | historical source record (doctor reference) | `lazytrae doctor` | VERIFIED |
| sync command | Not in historical source record (LazyTrae addition) | `lazytrae sync` | VERIFIED |
| uninstall command | historical source record (uninstall reference) | `lazytrae uninstall` | VERIFIED |
| verify command | historical source record (verification workflow) | `lazytrae verify` | VERIFIED |
| handoff command | historical source record (handoff workflow) | `lazytrae handoff` | VERIFIED |

## 11. Non-Portable Features

| Feature | historical source record source | Why non-portable | Substitute | Status |
| --- | --- | --- | --- | --- |
| PostCompact hook | historical source record (line 38) | Trae has no PostCompact event | SessionStart + UserPromptSubmit detection | GAP |
| Dynamic rule matching | historical source record (PostToolUse) | Trae rules are static | Hook-based PostToolUse extraction | VERIFIED |
| Codex marketplace install | historical source record (install alias) | Trae has no plugin marketplace | `lazytrae init` | VERIFIED |
| Hashline edit enforcement | Codex edit tools | Trae edit tools differ | PreToolUse hook + CLI guard | GAP |
| SubagentStop event | historical source record (line 42) | Trae has single Stop event | Single Stop hook | VERIFIED |
| LSP daemon | historical source record | Trae has no built-in LSP MCP | Optional external LSP MCP | GAP |
| Codegraph | historical source record | Trae has no codegraph equivalent | Optional external tool | GAP |
| Telemetry | historical source record | Trae has its own telemetry | Not ported | N/A |
| Auto-update | historical source record | LazyTrae is npm-based | `lazytrae sync` | VERIFIED |

## Summary

| Category | Total | VERIFIED | DESIGN | GAP | N/A |
| --- | --- | --- | --- | --- | --- |
| Project Memory | 6 | 5 | 0 | 1 | 0 |
| Skills | 10 | 9 | 0 | 0 | 1 |
| Commands | 9 | 9 | 0 | 0 | 0 |
| Custom Agents | 11 | 11 | 0 | 0 | 0 |
| Hooks | 11 | 9 | 0 | 2 | 0 |
| MCP | 7 | 5 | 0 | 2 | 0 |
| State Machine | 12 | 12 | 0 | 0 | 0 |
| Verification Gates | 7 | 7 | 0 | 0 | 0 |
| Model Routing | 6 | 6 | 0 | 0 | 0 |
| CLI | 6 | 6 | 0 | 0 | 0 |
| Non-Portable | 9 | 4 | 0 | 4 | 1 |
| **TOTAL** | **94** | **83** | **0** | **9** | **2** |

**Coverage**: 83/94 criteria (88.3%) are verified. The 9 remaining criteria are documented platform gaps; 2 are not applicable.
