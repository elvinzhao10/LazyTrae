# LazyTrae Model Routing

> **v0.10 — Model Routing and Optional Trae Agent Backend.** Part of the v0.x series.
> This document describes how LazyTrae approximates OmO's category-based model routing on the Trae platform.

## 1. LazyCodex Model Routing (Canonical Source)

LazyCodex uses a **model catalog** at `lazycodex/plugins/omo/model-catalog.json` with role-based model profiles:

| Profile | Model | Reasoning Effort | Purpose |
| --- | --- | --- | --- |
| default | `gpt-5.5` | `high` | Baseline model for most tasks |
| plan mode | `gpt-5.5` | `xhigh` | Strong reasoning for planning |
| verifier | `gpt-5.5` | `high` | Oracle model for judgment |
| worker | `gpt-5.5` | `high` | Fast capable coding model |

Agent TOML files specify model per role (e.g., `explorer.toml` uses `gpt-5.4-mini` with `low` effort, `plan.toml` uses `gpt-5.5` with `xhigh` effort).

LazyCodex also maintains `managedProfiles` for legacy compatibility (not applicable to LazyTrae).

## 2. Trae Modes (Verified from docs.trae.cn)

Trae provides two built-in modes:

| Mode | Behavior |
| --- | --- |
| **Auto** | Standard context window, efficient tool usage. Best for straightforward tasks. |
| **Max** | Larger context window, more tool-heavy runs. Best for complex reasoning and multi-file changes. |

Trae also supports custom models. Users can configure provider/model selection for their sessions.

## 3. LazyTrae Routing Table

LazyTrae maps six routing categories to Trae modes and agents:

| Category | Trae Mode | Default Agent(s) | Description |
| --- | --- | --- | --- |
| **quick** | Auto | atlas, explorer, cleaner | Fast, efficient execution. For mechanical work: code search, AI-slop cleanup, checklist execution. |
| **deep** | Max | hephaestus, prometheus, migration-planner | Deep reasoning for complex implementation, autonomous debugging, strategic planning, cross-platform analysis. |
| **ultrabrain** | Max | metis, oracle | Strongest reasoning available. For risk analysis, critical judgment, pre-completion verification gates. |
| **visual-engineering** | Max | sisyphus | Visual and frontend-capable model. For UI-heavy work, orchestration, visual QA. |
| **writing** | Auto | librarian | Documentation, research, memory maintenance. Auto mode unless documentation architecture is complex. |
| **review** | Max | oracle, momus | Strongest reasoning, read-only review stance. For plan review (Momus OKAY/ITERATE/REJECT) and post-implementation code review (Oracle). |

## 4. Category Selection Guide

### When to Use Each Category

- **quick** — Single-file edits, grep-style search, test runs, formatting, mechanical refactors. Any task where the answer is obvious from the code.
- **deep** — Multi-file changes, debugging sessions, architectural work, new feature implementation, dependency analysis. Tasks requiring sustained reasoning across related components.
- **ultrabrain** — Pre-planning risk analysis (Metis), final verification gate review (Oracle), critical security reviews, design decisions with long-term consequences.
- **visual-engineering** — UI/frontend implementation, visual QA, browser-based testing, layout work, responsive design, accessibility audits.
- **writing** — Documentation generation, research reports, README updates, parity ledger maintenance, command index updates.
- **review** — Plan review (Momus), post-implementation review (Oracle), adversarial QA, regression testing, compliance verification. Always read-only.

### Escalation Rules

| From | Escalate To | When |
| --- | --- | --- |
| quick | deep | Task grows beyond simple edit; requires understanding of multiple subsystems |
| deep | ultrabrain | Implementation reveals design contradictions or missing constraints |
| writing | deep | Documentation requires understanding of complex architecture |
| deep | ultrabrain | Implementation is complete and needs final verification |

## 5. Agent-to-Category Mapping

Each agent defaults to a specific category:

| Agent | Default Category | Trae Mode | Rationale |
| --- | --- | --- | --- |
| atlas | quick | Auto | Checklist executor — fast, precise, mechanical |
| explorer | quick | Auto | Fast parallel search — not reasoning-heavy |
| cleaner | quick | Auto | Mechanical AI-slop cleanup |
| hephaestus | deep | Max | Complex autonomous debugging and implementation |
| prometheus | deep | Max | Strategic planning needs strong reasoning |
| migration-planner | deep | Max | Cross-platform analysis and gap synthesis |
| metis | ultrabrain | Max | Risk analysis needs strongest reasoning |
| oracle | ultrabrain / review | Max | Final judgment — two categories depending on role (gate review vs code review) |
| sisyphus | visual-engineering | Max | Orchestration and visual QA |
| librarian | writing | Auto | Documentation and research |
| momus | review | Max | Plan review needs strong judgment |

## 6. Native Mode: Routing Hints in Agent Prompts

Each agent's prompt file (`.trae/agents/*.md`) includes a **Model Routing** section with:
- Default category
- Recommended Trae mode (Auto / Max)
- When to escalate to a higher category

These hints are advisory. In native Trae, the user manually selects Auto or Max mode. The routing hints help users decide which mode and agent to use for a given task.

Skills (`.trae/skills/*/SKILL.md`) also include mode recommendations where the skill's complexity warrants it.

## 7. Optional Runner Mode: trae-agent CLI Integration

The `lazytrae run` command provides an optional backend that integrates with `trae-agent` CLI:

```bash
lazytrae run --agent atlas --category quick "Implement the auth endpoint"
lazytrae run --agent oracle --category ultrabrain "Review the current diff"
lazytrae run --loop active
```

When `trae-agent` is installed:
- Routes to the appropriate provider/model based on the routing config
- Records trajectory to `.lazytraework/logs/`

When `trae-agent` is NOT installed:
- Prints a graceful fallback message with routing recommendations
- Tells the user exactly which Trae mode and agent to use manually

## 8. Trajectory Recording

When the runner is used, each invocation logs a trajectory entry to `.lazytraework/logs/` with:
- Timestamp
- Agent name
- Category
- Prompt
- Provider/model used (if trae-agent was invoked)
- Exit status

## 9. Graceful Degradation

The routing system degrades gracefully:
- Without `trae-agent`: prints routing guidance instead of failing
- Without routing config: defaults to Auto mode
- Without agent context: falls back to the parent session's model

## 10. Config Schema

The routing section in `.lazytraework/config.json`:

```json
{
  "routing": {
    "<category>": {
      "traeMode": "auto | max",
      "description": "<human-readable description>",
      "agents": ["<agent-name>", ...]
    }
  }
}
```

Six categories required: `quick`, `deep`, `ultrabrain`, `visual-engineering`, `writing`, `review`.

## References

- LazyCodex model catalog: `lazycodex/plugins/omo/model-catalog.json`
- LazyCodex agent TOML files: `lazycodex/plugins/omo/components/ultrawork/agents/*.toml`
- Trae modes: https://docs.trae.cn/ide_auto-mode, https://docs.trae.cn/enterprise_max-mode
- LazyTrae routing config: `.lazytraework/config.json` (routing section)
- LazyTrae agent files: `.trae/agents/*.md`
