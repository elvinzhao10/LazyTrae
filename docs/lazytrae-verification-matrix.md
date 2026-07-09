# LazyTrae Verification Matrix

> **v0.1 — Architecture and Parity Design.** Part of the v0.x series.
> This matrix defines verification criteria for every LazyTrae component mapped to its LazyCodex source.

## Verification Legend

| Status | Meaning |
| --- | --- |
| VERIFIED | Confirmed against LazyCodex source with exact path |
| DESIGN | Designed in architecture, not yet implemented |
| GAP | Known gap, substitute documented |
| N/A | Not applicable to Trae |

## 1. Project Memory

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| AGENTS.md loaded at session start | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (SessionStart handler) | AGENTS.md at repo root | DESIGN |
| Project rules injected at session start | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (runSessionStartHook) | `.trae/rules/lazytrae.md` | DESIGN |
| Rules re-injected at UserPromptSubmit | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (UserPromptSubmit handler) | `.trae/rules/lazytrae.md` (Trae reads rules on each prompt) | DESIGN |
| Dynamic rule matching on PostToolUse | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (runPostToolUseHook) | Hook-based PostToolUse extraction | DESIGN |
| Context pressure skip | `lazycodex/plugins/omo/components/rules/src/context-pressure.ts` | SessionStart/UserPromptSubmit detection | DESIGN |
| Post-compact rule re-injection | `lazycodex/plugins/omo/components/rules/src/post-compact-state.ts` | Post-compact detection via state file | GAP |

## 2. Skills

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| init-deep skill | `lazycodex/plugins/omo/skills/init-deep/SKILL.md` (inferred from shared skills) | `.trae/skills/init-deep/SKILL.md` | DESIGN |
| ulw-plan skill | `lazycodex/plugins/omo/skills/ulw-plan/SKILL.md` (inferred from shared skills) | `.trae/skills/ulw-plan/SKILL.md` | DESIGN |
| start-work skill | `lazycodex/plugins/omo/skills/start-work/SKILL.md` (inferred from shared skills) | `.trae/skills/start-work/SKILL.md` | DESIGN |
| ulw-loop skill | `lazycodex/plugins/omo/components/ulw-loop/skills/ulw-loop/SKILL.md` | `.trae/skills/ulw-loop/SKILL.md` | DESIGN |
| ultrawork directive | `lazycodex/plugins/omo/components/ultrawork/directive.md` | Embedded in ulw-loop skill | DESIGN |
| Skill pointer mechanism | `lazycodex/plugins/omo/components/ultrawork/src/skill-pointer.ts` | Trae native skill loading (eliminates pointer) | N/A |
| verifier skill | `lazycodex/plugins/omo/skills/review-work/SKILL.md` (inferred) | `.trae/skills/verifier/SKILL.md` | DESIGN |
| reviewer skill | `lazycodex/plugins/omo/skills/review-work/SKILL.md` (inferred) | `.trae/skills/reviewer/SKILL.md` | DESIGN |
| librarian skill | Not a standalone skill in LazyCodex; role is embedded in workflow | `.trae/skills/librarian/SKILL.md` | DESIGN |
| remove-ai-slops skill | `lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md` (inferred) | `.trae/skills/remove-ai-slops/SKILL.md` | DESIGN |

## 3. Commands

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| /init-deep | `lazycodex/packages/web/content/docs/init-deep.md` | `.trae/commands/init-deep.md` | DESIGN |
| /ulw-plan | `lazycodex/packages/web/content/docs/ulw-plan.md` | `.trae/commands/ulw-plan.md` | DESIGN |
| /start-work | `lazycodex/packages/web/content/docs/start-work.md` | `.trae/commands/start-work.md` | DESIGN |
| /ulw-loop | `lazycodex/packages/web/content/docs/ulw-loop.md` | `.trae/commands/ulw-loop.md` | DESIGN |
| /ralph-loop | `lazycodex/packages/web/content/docs/ulw-loop.md` (ralph-loop is alias) | `.trae/commands/ralph-loop.md` | DESIGN |
| /review-work | `lazycodex/packages/web/content/docs/` (referenced in workflow) | `.trae/commands/review-work.md` | DESIGN |
| /remove-ai-slops | `lazycodex/packages/web/content/docs/` (referenced in workflow) | `.trae/commands/remove-ai-slops.md` | DESIGN |
| /handoff | `lazycodex/packages/web/content/docs/` (referenced in workflow) | `.trae/commands/handoff.md` | DESIGN |
| /stop-continuation | `lazycodex/packages/web/content/docs/` (referenced in workflow) | `.trae/commands/stop-continuation.md` | DESIGN |

## 4. Custom Agents

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Explorer agent | `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` | `.trae/agents/explorer.md` | DESIGN |
| Librarian agent | `lazycodex/plugins/omo/components/ultrawork/agents/librarian.toml` | `.trae/agents/librarian.md` | DESIGN |
| Plan agent (Prometheus) | `lazycodex/plugins/omo/components/ultrawork/agents/plan.toml` | `.trae/agents/prometheus.md` | DESIGN |
| Metis agent | `lazycodex/plugins/omo/components/ultrawork/agents/metis.toml` | `.trae/agents/metis.md` | DESIGN |
| Momus agent | `lazycodex/plugins/omo/components/ultrawork/agents/momus.toml` | `.trae/agents/momus.md` | DESIGN |
| Executor (Atlas) | `lazycodex/packages/web/content/docs/discipline-agents.md` (lazycodex-executor) | `.trae/agents/atlas.md` | DESIGN |
| Hephaestus | `lazycodex/packages/web/content/docs/discipline-agents.md` (hephaestus) | `.trae/agents/hephaestus.md` | DESIGN |
| Oracle (gate reviewer) | `lazycodex/packages/web/content/docs/discipline-agents.md` (lazycodex-gate-reviewer) | `.trae/agents/oracle.md` | DESIGN |
| Sisyphus (orchestrator) | Not a standalone TOML; implicit in LazyCodex workflow | `.trae/agents/sisyphus.md` | DESIGN |
| Cleaner | `lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md` (inferred) | `.trae/agents/cleaner.md` | DESIGN |
| Migration planner | Not in LazyCodex; LazyTrae addition | `.trae/agents/migration-planner.md` | DESIGN |

## 5. Hooks

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| SessionStart hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 22) | `.trae/hooks/session-start.sh` | DESIGN |
| UserPromptSubmit hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 28) | `.trae/hooks/user-prompt-submit.sh` | DESIGN |
| PreToolUse hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 30) | `.trae/hooks/pre-tool-use.sh` | DESIGN |
| PostToolUse hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 33) | `.trae/hooks/post-tool-use.sh` | DESIGN |
| Stop hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 41) | `.trae/hooks/stop.sh` | DESIGN |
| PostCompact hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 38) | Post-compact detection (no direct Trae event) | GAP |
| SubagentStop hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 42) | Trae Stop hook (single event) | DESIGN |
| Comment checker | `lazycodex/plugins/omo/hooks/post-tool-use-checking-comments.json` | Optional in post-tool-use.sh | DESIGN |
| Ultrawork trigger detection | `lazycodex/plugins/omo/components/ultrawork/src/codex-hook.ts` | user-prompt-submit.sh keyword detection | DESIGN |
| Ulw-loop steering | `lazycodex/plugins/omo/components/ulw-loop/hooks/hooks.json` | user-prompt-submit.sh steering detection | DESIGN |
| LSP diagnostics | `lazycodex/plugins/omo/components/lsp/hooks/hooks.json` | Optional external LSP MCP | GAP |

## 6. MCP

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| MCP config file | `lazycodex/plugins/omo/.mcp.json` | `.trae/mcp.json` | DESIGN |
| grep_app MCP | `lazycodex/plugins/omo/.mcp.json` (line 3) | Optional in `.trae/mcp.json` | DESIGN |
| context7 MCP | `lazycodex/plugins/omo/.mcp.json` (line 6) | Optional in `.trae/mcp.json` | DESIGN |
| git_bash MCP | `lazycodex/plugins/omo/.mcp.json` (line 17) | Optional in `.trae/mcp.json` | DESIGN |
| codegraph MCP | `lazycodex/plugins/omo/.mcp.json` (line 10) | Optional external tool | GAP |
| lsp MCP | `lazycodex/plugins/omo/.mcp.json` (line 25) | Optional external LSP MCP | GAP |
| LazyTrae state MCP | Not in LazyCodex (LazyTrae addition) | `packages/mcp/src/server.ts` | DESIGN |

## 7. State Machine

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Boulder state | `lazycodex/packages/web/content/docs/start-work.md` (conceptual) | `.lazytrae/state/boulder.json` | DESIGN |
| Ulw-loop plan state | `lazycodex/plugins/omo/components/ulw-loop/src/domain-types.ts` (UlwLoopPlan) | `.lazytrae/state/active-loop.json` | DESIGN |
| Goal statuses | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (UlwLoopStatus) | Active-loop goal statuses | DESIGN |
| Criterion statuses | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (UlwLoopCriterionStatus) | Active-loop criterion statuses | DESIGN |
| Steering mutations | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (ULW_LOOP_STEERING_MUTATION_KINDS) | Active-loop steering mutations | DESIGN |
| Ledger events | `lazycodex/plugins/omo/components/ulw-loop/src/constants.ts` (ULW_LOOP_LEDGER_EVENT_KINDS) | `.lazytrae/logs/loop-events.ndjson` | DESIGN |
| Quality gate | `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts` | Evidence files + reviewer protocol | DESIGN |
| Evidence recording | `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts` | `.lazytrae/evidence/*.md` | DESIGN |
| Plan CRUD | `lazycodex/plugins/omo/components/ulw-loop/src/plan-crud.ts` | CLI + plan parser | DESIGN |
| Mutation lock | `lazycodex/plugins/omo/components/ulw-loop/src/plan-io.ts` (withUlwLoopMutationLock) | File-based locking | DESIGN |
| Session tracking | `lazycodex/plugins/omo/components/rules/src/session-state-lock.ts` | `.lazytrae/state/sessions.json` | DESIGN |
| .omo mirror | `lazycodex/.omo/` (evidence directory) | `.omo/plans/`, `.omo/ulw-loop/` | DESIGN |

## 8. Verification Gates

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Plan reread | `lazycodex/packages/web/content/docs/hooks-lifecycle.md` (five evidence gates) | Reviewer protocol step 1 | DESIGN |
| Automated verification | `lazycodex/packages/web/content/docs/tdd.md` | `.lazytrae/evidence/test-runs.md` | DESIGN |
| Manual-QA (real-surface proof) | `lazycodex/plugins/omo/components/ultrawork/directive.md` (Manual-QA channels) | `.lazytrae/evidence/verifier.md` | DESIGN |
| Adversarial QA | `lazycodex/packages/web/content/docs/manual-qa.md` | `.lazytrae/evidence/reviewer.md` | DESIGN |
| Cleanup | `lazycodex/packages/web/content/docs/hooks-lifecycle.md` (cleanup gate) | remove-ai-slops skill | DESIGN |
| Quality gate validation | `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts` | Reviewer/Oracle protocol | DESIGN |
| Reviewer roles | `lazycodex/plugins/omo/components/ulw-loop/src/quality-gate.ts` (REVIEWER_ROLES) | Oracle agent + reviewer skill | DESIGN |

## 9. Model Routing

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| Role-based model profiles | `lazycodex/plugins/omo/model-catalog.json` | `.lazytrae/config.json` routing section | DESIGN |
| Default model | `lazycodex/plugins/omo/model-catalog.json` (line 4) | Trae Auto mode | DESIGN |
| Plan mode reasoning | `lazycodex/plugins/omo/model-catalog.json` (line 7: xhigh) | Trae Max mode | DESIGN |
| Worker model | `lazycodex/plugins/omo/model-catalog.json` (line 17) | Trae Auto mode | DESIGN |
| Verifier model | `lazycodex/plugins/omo/model-catalog.json` (line 13) | Trae Max mode | DESIGN |
| Agent TOML model field | `lazycodex/plugins/omo/components/ultrawork/agents/explorer.toml` (line 4: model = "gpt-5.4-mini") | Agent prompt routing hints | DESIGN |

## 10. CLI

| Criterion | LazyCodex source | LazyTrae target | Status |
| --- | --- | --- | --- |
| CLI entry point | `lazycodex/bin/lazycodex-ai.js` | `packages/cli/src/index.ts` | DESIGN |
| init command | `lazycodex/bin/lazycodex-ai.js` (install alias) | `lazytrae init` | DESIGN |
| doctor command | `lazycodex/packages/web/content/docs/installation.md` (doctor reference) | `lazytrae doctor` | DESIGN |
| sync command | Not in LazyCodex (LazyTrae addition) | `lazytrae sync` | DESIGN |
| uninstall command | `lazycodex/packages/web/content/docs/installation.md` (uninstall reference) | `lazytrae uninstall` | DESIGN |
| verify command | `lazycodex/packages/web/content/docs/tdd.md` (verification workflow) | `lazytrae verify` | DESIGN |
| handoff command | `lazycodex/packages/web/content/docs/` (handoff workflow) | `lazytrae handoff` | DESIGN |

## 11. Non-Portable Features

| Feature | LazyCodex source | Why non-portable | Substitute | Status |
| --- | --- | --- | --- | --- |
| PostCompact hook | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 38) | Trae has no PostCompact event | SessionStart + UserPromptSubmit detection | GAP |
| Dynamic rule matching | `lazycodex/plugins/omo/components/rules/src/codex-hook.ts` (PostToolUse) | Trae rules are static | Hook-based PostToolUse extraction | DESIGN |
| Codex marketplace install | `lazycodex/bin/lazycodex-ai.js` (install alias) | Trae has no plugin marketplace | `npx lazytrae-ai init` | DESIGN |
| Hashline edit enforcement | Codex edit tools | Trae edit tools differ | PreToolUse hook + CLI guard | GAP |
| SubagentStop event | `lazycodex/plugins/omo/.codex-plugin/plugin.json` (line 42) | Trae has single Stop event | Single Stop hook | DESIGN |
| LSP daemon | `lazycodex/plugins/omo/components/lsp/` | Trae has no built-in LSP MCP | Optional external LSP MCP | GAP |
| Codegraph | `lazycodex/plugins/omo/components/codegraph/` | Trae has no codegraph equivalent | Optional external tool | GAP |
| Telemetry | `lazycodex/plugins/omo/components/telemetry/` | Trae has its own telemetry | Not ported | N/A |
| Auto-update | `lazycodex/plugins/omo/components/bootstrap/` | LazyTrae is npm-based | `npx lazytrae-ai sync` | DESIGN |

## Summary

| Category | Total | DESIGN | GAP | N/A |
| --- | --- | --- | --- | --- |
| Project Memory | 6 | 5 | 1 | 0 |
| Skills | 10 | 9 | 0 | 1 |
| Commands | 9 | 9 | 0 | 0 |
| Custom Agents | 11 | 11 | 0 | 0 |
| Hooks | 11 | 9 | 2 | 0 |
| MCP | 7 | 5 | 2 | 0 |
| State Machine | 12 | 12 | 0 | 0 |
| Verification Gates | 7 | 7 | 0 | 0 |
| Model Routing | 6 | 6 | 0 | 0 |
| CLI | 6 | 6 | 0 | 0 |
| Non-Portable | 9 | 4 | 4 | 1 |
| **TOTAL** | **94** | **83** | **9** | **2** |

**Coverage**: 83/94 criteria (88.3%) have concrete design. 9 are known gaps with documented substitutes. 2 are not applicable.