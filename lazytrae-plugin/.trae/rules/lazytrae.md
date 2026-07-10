<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

# LazyTrae Project Rules

> These rules are injected into agent context by Trae at session start.
> See `AGENTS.md` for the full project constitution.

## Core Operating Rules

### Inspect Before Editing
- Always read the actual LazyCodex source files before implementing any feature.
- Never invent LazyCodex behavior from memory.
- The `lazycodex/` directory is the canonical source of truth.

### Plan Before Multi-File Changes
- Read the versioned plan file in `plan/` before starting work.
- Follow versions in order: v0.0 -> v0.1 -> ... -> v0.14.
- Each version has objective, deliverables, steps, verification, and rollback.

### Preserve LazyCodex Semantics
- Keep command names (`init-deep`, `ulw-plan`, `start-work`, `ulw-loop`) where they communicate parity.
- Preserve workflow phases: Explore -> Plan -> Implement -> Verify -> Manually QA.
- Preserve the five evidence gates: plan reread, automated verification, manual-QA, adversarial QA, cleanup.
- Document any deviation from LazyCodex semantics.

### Execute One Checklist Item at a Time
- During `start-work`, execute one plan checkbox at a time.
- Never batch multiple tasks in a single step.
- Reconcile every plan step: completed, blocked (reason), or removed (reason).

### Verification Evidence Required
- Completion is invalid without evidence.
- Evidence includes: commands run, outputs, exit status, changed files, manual checks, reviewer findings.
- Never claim parity without evidence.

### Reviewer/Oracle Review Required
- Long-horizon completion requires reviewer/Oracle pass.
- Reviewer should be read-only by default.
- A child agent saying "done" does not close the work.

### Update Memory After Changes
- After accepted changes, update AGENTS.md, command index, and parity ledger.
- Keep the parity ledger current with implementation status.

## Git Workflow

- Use conventional commits.
- Keep commits atomic.
- Stage only the files you changed.
- No `git add -A` or `git add .`.
- No `git commit --no-verify`.
- No force pushes.

## Version Numbering

All versions use the `v0.x` scheme. Do not use `v1.x`, `v2.x`, etc.

## Key References

- Constitution: `AGENTS.md`
- Architecture: `docs/lazytrae-architecture-plan.md`
- Parity ledger: `docs/lazytrae-parity-ledger.md`
- Operating manual: `docs/lazytrae-operating-manual.md`
- Command index: `docs/lazytrae-command-index.md`
- LazyCodex source: `lazycodex/`
