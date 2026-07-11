# LazyTrae Project Rules

> These rules are injected into agent context by Trae at session start.
> See `AGENTS.md` for the full project constitution.

## Core Operating Rules

### Inspect Before Editing
- Read the current project's `AGENTS.md`, README, relevant source, and tests before editing.
- Use the installed LazyTrae skills and commands as the workflow source of truth.
- If external parity material is available, treat it as reference evidence, not as a required local directory.

### Plan Before Multi-File Changes
- For ambiguous or multi-file work, use `/lazy-ulw-plan` before changing product files.
- Store active plans in `.lazytrae/plans/`; keep loop state in `.lazytrae/loop/`.
- Keep LazyTrae configuration, state, and evidence in `.lazytrae/`.

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
- Update the project's local instructions or documentation only when the accepted change makes them stale.
- Preserve evidence in `.lazytrae/evidence/` and runtime state in `.lazytrae/state/` when the workflow uses them.

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

- Project instructions: `AGENTS.md`
- Trae integration: `.trae/`
- LazyTrae configuration and evidence: `.lazytrae/`
- Plans and loop state: `.lazytrae/plans/` and `.lazytrae/loop/`
