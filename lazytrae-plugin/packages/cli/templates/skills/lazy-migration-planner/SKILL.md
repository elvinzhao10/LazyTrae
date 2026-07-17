---
name: lazy-migration-planner
description: "Migration planning for adapting LazyTrae workflows to other host platforms. Use when adapting to a different IDE, tool, or platform. Triggers: migration plan, adapt to platform, convert to host, migrate workflow, port to."
---

# migration-planner

Migration planning skill for adapting LazyTrae workflows to other host platforms.

## Global Trae Work fallback

This installed skill is self-contained. It does not require repository documentation or a parity ledger. Build the comparison from the current project's available LazyTrae components and the target platform's official documentation.

## Purpose

Plan the adaptation of LazyTrae workflows (skills, commands, agents, hooks, state management) to a different host platform. The migration planner identifies what is portable, what needs adaptation, and what is a gap on the target platform.

## Required Context to Inspect

- The target platform's capabilities (rules, skills, commands, agents, hooks, MCP, subagents).
- The current project's available LazyTrae components (skills, commands, agents, hooks, MCP configuration, and state files).
- The target platform's documentation (from documentation-search or provided by user).

## Step-by-Step Procedure

### Phase 1: Platform Discovery

1. **Research the target platform** — request documentation-search to understand:
   - Does it have a rules/config system? How are rules injected?
   - Does it have a skills/plugins system? What is the format?
   - Does it have custom agents/subagents? How are they defined?
   - Does it have hooks/events? What events are available?
   - Does it have MCP support? What is the config format?
   - Does it have state management? Is there a runtime?
2. **Map capabilities** — create a capability matrix: LazyTrae → Target Platform.

### Phase 2: Gap Analysis

1. **Identify portable features** — features that map directly to target platform capabilities.
2. **Identify adaptation needs** — features that need translation but have a target equivalent.
3. **Identify gaps** — features with no target equivalent. Document substitutes.
4. **Identify non-applicable** — features that are not needed on the target platform.

### Phase 3: Migration Plan

Write a migration plan with:
1. **Architecture mapping** — how each LazyTrae component maps to the target platform.
2. **Feature prioritization** — what to implement first, what can wait, what is deferred.
3. **Risk assessment** — what is likely to break, what needs special handling.
4. **Implementation order** — phased approach with dependencies.

### Phase 4: Deliverable

Produce a migration plan document at `.lazytrae/plans/migration-<target>.md` with the same structure as a LazyTrae plan file.

## Allowed Edits

- Create `.lazytrae/plans/migration-<target>.md`.
- Read project files and request documentation or web-search capabilities.
- Update a project parity record only when the current project already provides one.

## Forbidden Behavior

- Do NOT implement the migration. This is planning only.
- Do NOT assume target platform capabilities without verification.
- Do NOT claim a feature is portable without evidence from the target platform docs.
- Do NOT skip the gap analysis — every feature must be classified.

## Verification Gates

1. **Plan reread**: Every LazyTrae feature is accounted for in the migration plan.
2. **Automated verification**: Capability claims are backed by documentation references.
3. **Manual-QA**: The migration plan is actionable — a downstream worker can execute it.
4. **Adversarial QA**: Gaps are explicitly identified with documented substitutes.
5. **Cleanup**: No temporary research files left behind.

## Failure Handling

- If target platform documentation is unavailable: document what is assumed, mark as unverified.
- If a key feature has no target equivalent: classify as GAP, propose a substitute or workaround.
- If the target platform is incompatible: document the incompatibility and recommend alternatives.

## Output Format

```markdown
# Migration Plan: LazyTrae → <Target Platform>

## TL;DR
> Summary: <1-2 sentences>
> Portable: <N> features
> Adaptation: <N> features
> Gaps: <N> features

## Platform Capability Matrix
| LazyTrae Feature | LazyTrae Basis | Target Equivalent | Status |
|------------------|------------------|-------------------|--------|
| ...              | ...              | ...               | PORTABLE / ADAPT / GAP / N/A |

## Architecture Mapping
[Detailed mapping of each component]

## Migration Phases
### Phase 1: Foundation
### Phase 2: Core Workflows
### Phase 3: Advanced Features

## Risk Assessment
## Gaps and Substitutes
```

## Handoff Target

After the migration plan is approved, hand off to `start-work` for execution on the target platform.
