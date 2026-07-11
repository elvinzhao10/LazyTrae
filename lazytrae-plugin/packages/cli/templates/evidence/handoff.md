# Session Handoff

> **Handoff Summary** — What the next session needs to know to continue.
> LazyCodex source: `lazycodex/packages/web/content/docs/` (handoff workflow)

## Template

### Handoff Summary

- **Session ID**: `<session id>`
- **Handoff date**: `<ISO 8601 timestamp>`
- **Agent**: `<agent name>`

### What Was Accomplished

- `<accomplishment 1>`
- `<accomplishment 2>`
- ...

### Current State

- **Plan file**: `.lazytrae/plans/<plan-name>.md`
- **Tasks completed**: `<N>/<M>`
- **Current task**: `<task id>` — `<description>` (status: `<status>`)
- **Active loop**: `<active/inactive>`
- **Loop iteration**: `<N>/500`

### Evidence Produced

- `.lazytrae/evidence/test-runs.md`
- `.lazytrae/evidence/verifier.md`
- `.lazytrae/evidence/reviewer.md`
- `.lazytrae/evidence/oracle-review.md`
- `.lazytrae/evidence/completion.md`

### Remaining Gaps

- `<gap 1>`
- `<gap 2>`
- ...

### Blockers

- `<blocker 1>` — `<reason>`
- `<blocker 2>` — `<reason>`

### Next Prompt

```
<paste the next prompt to continue>
```

---

## Example (filled)

### Handoff Summary

- **Session ID**: trae:session-abc123
- **Handoff date**: 2026-07-09T12:00:00Z
- **Agent**: Sisyphus

### What Was Accomplished

- Created `.lazytrae/config.json` with LazyTrae configuration (version, features, paths, model routing, iteration caps).
- Created `.lazytrae/state/boulder.json` — durable plan task tracker with schema_version 2.
- Created `.lazytrae/state/active-loop.json` — loop state tracking with all 7 goal statuses, 7 steering mutations, and 500 iteration cap.
- Created `.lazytrae/state/sessions.json` — session tracking with compaction state.
- Created 6 evidence templates in `.lazytrae/evidence/` (test-runs, verifier, reviewer, oracle-review, completion, handoff).
- Created 3 JSON Schemas in `.lazytrae/schemas/` (boulder, active-loop, evidence).
- Created `.lazytrae/plans/` and `.lazytrae/loop/` runtime directories.
- Created `docs/lazytrae-state-machine.md` — comprehensive state machine documentation.
- Created `.lazytrae/plans/sample-plan.md` — sample plan for verification.
- Updated parity ledger, command index, and AGENTS.md with COMPLETE statuses.

### Current State

- **Plan file**: `.lazytrae/plans/v0.5-state-machine.md`
- **Tasks completed**: 10/10
- **Current task**: None (all complete)
- **Active loop**: Inactive
- **Loop iteration**: N/A

### Evidence Produced

- `.lazytrae/evidence/test-runs.md`
- `.lazytrae/evidence/verifier.md`
- `.lazytrae/evidence/reviewer.md`
- `.lazytrae/evidence/oracle-review.md`
- `.lazytrae/evidence/completion.md`

### Remaining Gaps

- No automated schema validation CLI (deferred to v0.6).
- No runtime loop execution (deferred to v0.9).
- No hook integration for state persistence (deferred to v0.7).

### Blockers

- None.

### Next Prompt

```
LazyTrae v0.6 — CLI Installer and Doctor.

Read plan/v0.6-cli-installer.md for the full execution prompt.
Implement `lazytrae init`, `lazytrae doctor`, `lazytrae sync`, `lazytrae verify`, `lazytrae handoff`, and `lazytrae uninstall`.
```
