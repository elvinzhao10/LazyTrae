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

- **Plan file**: `.omo/plans/<plan-name>.md`
- **Tasks completed**: `<N>/<M>`
- **Current task**: `<task id>` — `<description>` (status: `<status>`)
- **Active loop**: `<active/inactive>`
- **Loop iteration**: `<N>/500`

### Evidence Produced

- `.lazytraework/evidence/test-runs.md`
- `.lazytraework/evidence/verifier.md`
- `.lazytraework/evidence/reviewer.md`
- `.lazytraework/evidence/oracle-review.md`
- `.lazytraework/evidence/completion.md`

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

- Created `.lazytraework/config.json` with LazyTrae configuration (version, features, paths, model routing, iteration caps).
- Created `.lazytraework/state/boulder.json` — durable plan task tracker with schema_version 2.
- Created `.lazytraework/state/active-loop.json` — loop state tracking with all 7 goal statuses, 7 steering mutations, and 500 iteration cap.
- Created `.lazytraework/state/sessions.json` — session tracking with compaction state.
- Created 6 evidence templates in `.lazytraework/evidence/` (test-runs, verifier, reviewer, oracle-review, completion, handoff).
- Created 3 JSON Schemas in `.lazytraework/schemas/` (boulder, active-loop, evidence).
- Created `.omo/` compatibility mirror directories.
- Created `docs/lazytrae-state-machine.md` — comprehensive state machine documentation.
- Created `.omo/plans/sample-plan.md` — sample plan for verification.
- Updated parity ledger, command index, and AGENTS.md with COMPLETE statuses.

### Current State

- **Plan file**: `.omo/plans/v0.5-state-machine.md`
- **Tasks completed**: 10/10
- **Current task**: None (all complete)
- **Active loop**: Inactive
- **Loop iteration**: N/A

### Evidence Produced

- `.lazytraework/evidence/test-runs.md`
- `.lazytraework/evidence/verifier.md`
- `.lazytraework/evidence/reviewer.md`
- `.lazytraework/evidence/oracle-review.md`
- `.lazytraework/evidence/completion.md`

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