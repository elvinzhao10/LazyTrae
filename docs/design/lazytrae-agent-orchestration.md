# LazyTrae Agent Orchestration

> **v0.4 — Custom Agents and Role Specialization.**
> This document describes how LazyTrae agents interact, delegate, and resolve conflicts.

## 1. Orchestration Principle

**Completion judgment is never handed wholesale to a sub-agent.** The parent session (Sisyphus) keeps ownership of goals, constraints, and final judgment. Sub-agents are used to read terrain, find gaps, execute tasks, or assist review — but the parent always decides when work is complete.

This mirrors the historical source record principle from `discipline-agents.md`:
> "Even with multiple roles, completion judgment is never handed wholesale to a sub-agent. The parent Codex session keeps ownership of goals, constraints, and final judgment."

## 2. Orchestration Flow

```
                    ┌─────────────┐
                    │  User Goal  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Sisyphus  │ ◄── Main Orchestrator
                    │  (Parent)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐ ┌──────▼──────┐ ┌──▼──────────┐
     │  Explorer  │ │  Librarian  │ │  Prometheus  │
     │  (read-only)│ │  (read-only)│ │  (planner)   │
     └────────────┘ └─────────────┘ └──────┬───────┘
                                           │
                                ┌──────────┼──────────┐
                                │          │          │
                         ┌──────▼─────┐ ┌──▼──────┐   │
                         │   Metis    │ │  Momus  │   │
                         │ (gap anal) │ │ (review)│   │
                         └────────────┘ └────┬────┘   │
                                            │        │
                                    ┌───────▼────────▼──────┐
                                    │    Plan Approved?      │
                                    └───────┬────────┬──────┘
                                            │ YES    │ NO (iterate)
                                            │        │
                              ┌─────────────┼────────┘
                              │             │
                    ┌─────────▼──┐   ┌──────▼──────┐
                    │   Atlas    │   │ Hephaestus  │
                    │ (executor) │   │ (deep work) │
                    └─────────┬──┘   └──────┬──────┘
                              │             │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Verifier   │
                              │ (skill)     │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │   Cleaner   │
                              │ (slop rem)  │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │   Oracle    │
                              │ (reviewer)  │
                              └──────┬──────┘
                                     │
                         ┌───────────┼───────────┐
                         │           │           │
                  ┌──────▼──────┐    │    ┌──────▼──────┐
                  │  APPROVE    │    │    │  ITERATE/   │
                  │             │    │    │  REJECT     │
                  └──────┬──────┘    │    └──────┬──────┘
                         │           │           │
                  ┌──────▼──────┐    │    ┌──────▼──────┐
                  │  Librarian  │    │    │   Back to   │
                  │  (update)   │    │    │  Sisyphus   │
                  └──────┬──────┘    │    └─────────────┘
                         │           │
                  ┌──────▼──────┐    │
                  │  All Tasks  │    │
                  │  Complete?  │    │
                  └──────┬──────┘    │
                         │           │
                  ┌──────┼──────┐    │
                  │ YES  │      │ NO │
                  │      │      │    │
           ┌──────▼──┐   │  ┌──▼───────┐
           │  DONE   │   │  │ Next Task│
           └─────────┘   │  │ (loop)   │
                         │  └──────────┘
                         │
              ┌──────────▼──────────┐
              │  Migration Planner  │
              │  (on-demand only)   │
              └─────────────────────┘
```

### Phase-by-Phase Flow

**Phase 1: Explore** (init-deep)
1. Sisyphus receives the user goal
2. Sisyphus spawns Explorer (read-only) to map the codebase terrain
3. Sisyphus spawns Librarian (read-only) for external documentation research
4. Sisyphus synthesizes exploration results

**Phase 2: Plan** (ulw-plan)
1. Sisyphus delegates to Prometheus for plan generation
2. Prometheus interviews the user, explores the codebase, writes ONE plan file
3. [Optional] Prometheus can call Explorer and Librarian for parallel context
4. Metis reviews the draft plan for gaps, contradictions, ambiguity
5. Momus reviews the plan for executability: references, startability, QA scenarios
6. Momus issues OKAY / ITERATE / REJECT
7. If ITERATE: Prometheus fixes (max 2 auto-rounds), then re-submit to Momus
8. If REJECT: Sisyphus surfaces the issue to the user

**Phase 3: Implement** (start-work)
1. Sisyphus delegates to Atlas for one task at a time
2. Atlas reads the plan, executes one checklist item, tests, commits
3. For complex tasks: Sisyphus delegates to Hephaestus instead
4. Hephaestus runs the full Explore → Plan → Implement → Verify → Manually QA loop
5. Verifier (skill) runs automated verification: tests, lint, type-check, build
6. Cleaner removes AI-generated slop while preserving behavior

**Phase 4: Review** (review-work)
1. Oracle reviews the implementation
2. Oracle checks the five evidence gates:
   - Plan reread
   - Automated verification
   - Manual-QA
   - Adversarial QA
   - Cleanup
3. Oracle issues APPROVE / ITERATE / REJECT

**Phase 5: Memory Update** (librarian update)
1. Librarian updates AGENTS.md, command index, parity ledger
2. Librarian ensures consistency across all documentation

**Phase 6: Loop or Complete**
1. Sisyphus checks if all tasks are complete
2. If complete: produce handoff summary, declare DONE
3. If not complete: advance to next task, loop back to Phase 3

## 3. Agent Delegation Matrix

| Agent | Called By | Can Call | Authority |
| --- | --- | --- | --- |
| **Sisyphus** | User (direct) | All other agents | Full orchestration. Only agent that decides when to loop or stop. |
| **Prometheus** | Sisyphus | Explorer, Librarian, Metis, Momus | Plan file write only. Cannot edit product code. |
| **Metis** | Sisyphus, Prometheus | None | Read-only. Gap analysis only. |
| **Momus** | Sisyphus, Prometheus | None | Read-only. Plan review only. Issues OKAY/ITERATE/REJECT. |
| **Atlas** | Sisyphus | Explorer, Librarian | One task at a time. Cannot modify plans. |
| **Hephaestus** | Sisyphus | Explorer, Librarian | Full implementation autonomy. Cannot modify plans. |
| **Oracle** | Sisyphus | None | Read-only by default. Issues APPROVE/ITERATE/REJECT. |
| **Librarian** | Sisyphus, any agent | None | Read-only for codebase. Write-permitted for docs/memory only. |
| **Explorer** | Sisyphus, any agent | None | Read-only. Codebase search only. |
| **Cleaner** | Sisyphus | None | Surgical slop removal. Cannot change behavior. |
| **Migration Planner** | Sisyphus | Explorer, Librarian | Plan file write only. Cannot edit product code. |

## 4. Authority Table

| Authority | Sisyphus | Prometheus | Metis | Momus | Atlas | Hephaestus | Oracle | Librarian | Explorer | Cleaner | Migration Planner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Read codebase** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Read docs** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Edit product code** | — | **✗** | **✗** | **✗** | ✓ | ✓ | **✗** | **✗** | **✗** | ✓ | **✗** |
| **Write plan files** | ✓ | ✓ | **✗** | **✗** | — | — | **✗** | — | **✗** | — | ✓ |
| **Update docs/memory** | ✓ | — | **✗** | **✗** | — | — | **✗** | ✓ | **✗** | — | — |
| **Run build/tests** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Run git operations** | ✓ | — | **✗** | **✗** | ✓ | ✓ | — | ✓ | **✗** | ✓ | — |
| **Approve/reject plans** | ✓ | — | — | ✓ | — | — | — | — | — | — | — |
| **Approve/reject work** | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| **Decide loop/stop** | ✓ | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** | **✗** |
| **Spawn subagents** | ✓ | ✓ | — | — | ✓ | ✓ | — | — | — | — | — |

Legend: ✓ = allowed, — = not applicable (role doesn't need this), **✗** = explicitly forbidden

## 5. Conflict Resolution Rules

### Rule 1: No Two Agents Have Conflicting Authority
Every authority is assigned to exactly one role. There is no overlap that could cause conflicts:
- **Plan approval**: Momus only (with Sisyphus override for user decisions)
- **Work approval**: Oracle only (with Sisyphus override for user decisions)
- **Loop/stop decision**: Sisyphus only
- **Memory updates**: Librarian only
- **Code edits**: Atlas or Hephaestus only (not Prometheus, not Oracle)
- **Plan edits**: Prometheus only (not Atlas, not Hephaestus)

### Rule 2: Read-Only Default for Reviewers
Oracle, Metis, Momus, and Explorer are read-only by default. If they need to write, the parent session (Sisyphus) must explicitly grant permission.

### Rule 3: Planner Cannot Implement
Prometheus plans. Atlas or Hephaestus implements. Never the same agent for both. This separation prevents the planner from biasing the implementation toward the plan.

### Rule 4: Parent Session Has Final Judgment
A subagent saying "done" does not close the work. Sisyphus verifies independently. Oracle review is advisory — Sisyphus makes the final completion decision.

### Rule 5: Single Task Execution
Atlas executes exactly one checklist item per invocation. If a task is too complex for Atlas, Sisyphus escalates to Hephaestus.

### Rule 6: Iteration Cap
- Plan iteration: max 2 auto-rounds (Momus → Prometheus → Momus). If not resolved, escalate to user.
- Implementation retry: max 2 attempts per task. If still failing, block and escalate.
- AI-slop cleanup: max 2 passes. If slop persists, report and document.

### Rule 7: Evidence Before Advancement
No phase advances without evidence:
- Plan → Evidence: plan file exists, Momus approved
- Implement → Evidence: tests pass, lint clean, build succeeds
- Review → Evidence: all five gates passed
- Complete → Evidence: Oracle approved, Librarian updated, handoff produced

## 6. Subagent Invocation Pattern

In Trae, only the built-in "Agent" can call custom agents. The pattern is:

```
Sisyphus (built-in Agent) calls:
  ├── Explorer (custom agent) — "Find where X is implemented in the codebase"
  ├── Librarian (custom agent) — "Research the Y library API for version Z"
  ├── Prometheus (custom agent) — "Create a work plan for feature X"
  ├── Metis (custom agent) — "Review this plan for gaps and contradictions"
  ├── Momus (custom agent) — "Verify this plan is executable"
  ├── Atlas (custom agent) — "Execute task N from the plan"
  ├── Hephaestus (custom agent) — "Build feature X from scratch"
  ├── Oracle (custom agent) — "Review the implementation against the plan"
  ├── Cleaner (custom agent) — "Remove AI slop from the changed files"
  └── Migration Planner (custom agent) — "Create a migration plan for platform Y"
```

Each subagent has independent context — they do not share the parent's conversation history unless explicitly passed.

## 7. Model Routing Guidance

| Agent | Trae Mode | Reasoning | historical source record Equivalent |
| --- | --- | --- | --- |
| Sisyphus | Max | High | (implicit orchestrator) |
| Prometheus | Max | xhigh | gpt-5.5, xhigh |
| Metis | Max | High | gpt-5.5, high |
| Momus | Max | xhigh | gpt-5.5, xhigh |
| Atlas | Auto | Standard | worker profile |
| Hephaestus | Max | High | worker profile (deep) |
| Oracle | Max | Highest | verifier profile |
| Librarian | Auto | Low | gpt-5.4-mini, low |
| Explorer | Auto | Low | gpt-5.4-mini, low |
| Cleaner | Auto | Standard | (embedded in remove-ai-slops) |
| Migration Planner | Max | High | (LazyTrae addition) |

## 8. References

- historical source record agents: historical source record*.toml`
- historical source record discipline agents: historical source record
- historical source record ultrawork directive: historical source record
- LazyTrae architecture: `docs/lazytrae-architecture-plan.md`
- LazyTrae agents: `.trae/agents/*.md`
- LazyTrae skills: `.trae/skills/*/SKILL.md`