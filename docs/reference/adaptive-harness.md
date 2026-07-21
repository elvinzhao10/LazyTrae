# Adaptive Harness: Two-Shape Snapshot Design

> Reference for v1.0.3 maintainers. The adaptive harness intentionally persists
> two distinct shapes of the same logical decision. Confusing them is the most
> common source of review feedback.

## 1. Overview

LazyTrae v1.0.3 introduces an adaptive harness whose decision output is captured in **two distinct shapes** that serve different consumers. They are NOT redundant: each is optimized for a specific job, and the translation between them is deliberately deferred to the future orchestrator.

The first shape is a **portable camelCase "decision snapshot"** produced by `classifyAdaptiveDecision` in `lazytrae-plugin/packages/cli/src/lib/adaptive-decision.js`. It mirrors the LazyBuddy portable contract shape (plan Section 11 example) and is what cross-repo parity fixtures and test assertions compare against.

The second shape is a **persisted snake_case "loop state"** stored on `loopState.adaptive`, defined in `lazytrae-plugin/packages/cli/src/lib/adaptive-snapshot.js` and validated by `validateAdaptiveSnapshot` plus the JSON Schema in `lazytrae-plugin/.lazytrae/schemas/active-loop.schema.json`. It is optimized for loop-state persistence and human-readable status display via `lazytrae completion-status`.

**LazyBuddy persists only the camelCase portable shape** (matching plan Section 11); **LazyTrae persists the snake_case shape.** The translation between the two is documented in test helpers but NOT yet implemented in production code — it is the future orchestrator's responsibility, deferred beyond v1.0.3.

## 2. Shape A: Portable decision snapshot (camelCase)

- **Lives in:** the `snapshot` field returned by `classifyAdaptiveDecision` (`adaptive-decision.js` line 156; `buildSnapshot` at line 74).
- **Schema:** `lazytrae-plugin/packages/cli/contracts/adaptive-harness-contract.v1.json` `snapshot_schema` (line 246) and `adaptive-harness-contract.v1.schema.json`.
- **Used for:** cross-repo parity, fixture comparison, and test assertions in `lazytrae-plugin/packages/cli/test/adaptive-integration.test.js`. **Also persisted by LazyBuddy** as its run-state `adaptive` block.

The 14 fields per plan Section 11:

| Field | Notes |
| --- | --- |
| `decisionId` | Unique identifier for the adaptive decision. |
| `requestDigest` | Digest of the original user request. **Being renamed to `requestSlug` in the v1.0.3 patch**; production `buildSnapshot` still emits `requestDigest` today. |
| `mode` | Selected workflow mode (`direct`, `assisted`, `planned`, `orchestrated`, `long-horizon`). |
| `stages` | Ordered list of selected stages. |
| `currentStage` | Active stage (first entry of `stages` at decision time). |
| `responsibilities` | Named specialist responsibilities engaged. |
| `capabilityClasses` | Required capability classes. |
| `runtimeResolution` | Map of capability class to resolved provider. |
| `reasons` | Material reasons for the selected mode and omissions. |
| `escalationCount` | Automatic depth escalations applied (bounded by `max_auto_escalations=2`). |
| `revisionMarker` | Repository revision marker for resume compatibility checks. |
| `blocker` | Current blocker, or `null` when not blocked. |
| `nextAction` | Next action to take in the current stage. |
| `singleWriter` | Single-writer identity; the contract sets `single_writer: "orchestrator"` as a top-level const on `snapshot_schema`. |

> The production `buildSnapshot` also carries a `version: 1` field ahead of `decisionId`; it is part of the on-disk portable object but is not counted in the Section 11 field list above.

## 3. Shape B: Persisted loop state (snake_case)

- **Lives in:** the `loopState.adaptive` field on the active-loop state.
- **Defined / validated by:** `REQUIRED_FIELDS` in `adaptive-snapshot.js` (line 15), `validateAdaptiveSnapshot` (line 73), and the `adaptive` block in `lazytrae-plugin/.lazytrae/schemas/active-loop.schema.json` (line 166).
- **Used for:** loop-state persistence, atomic writes via `loop-store.saveLoop`, and human-readable status display via `lazytrae completion-status`.

The 14 required fields (`adaptive-snapshot.js` `REQUIRED_FIELDS`):

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | string | One of the five valid modes. |
| `stages` | string[] | Selected workflow stages. |
| `responsibilities` | string[] | Selected specialist responsibilities. |
| `capabilities` | string[] | Selected capability classes. |
| `not_selected` | object | Explicitly omitted `stages` and `capabilities`. |
| `approval_required` | boolean | Whether approval is required before proceeding. |
| `reasons` | string[] | Material selection reasons. |
| `started_at` | string\|null | ISO timestamp when the decision started. |
| `updated_at` | string\|null | Stamped by `writeAdaptiveSnapshot` on write. |
| `completed_at` | string\|null | ISO timestamp when the decision completed. |
| `escalation_count` | integer | Number of automatic depth escalations (max 2). |
| `escalation_history` | object[] | Ordered escalation records. |
| `last_resolution` | object\|null | Last runtime resolution of capabilities to providers. |
| `single_writer` | string | Const `"orchestrator"`; `validateAdaptiveSnapshot` rejects any other value. |

## 4. Translation between shapes

The translation from Shape A (portable decision snapshot) to Shape B (persisted loop state) is **the future orchestrator's responsibility** and is NOT yet implemented in production code. It is deferred beyond v1.0.3.

The reference mapping lives in the test helper `decisionToLoopAdaptiveBlock` in `lazytrae-plugin/packages/cli/test/adaptive-integration.test.js` (line 65). It reads `decision.snapshot` (camelCase) and emits the 14-field snake_case block that `writeAdaptiveSnapshot` accepts. Key mappings:

- `decision.mode`, `decision.stages`, `decision.responsibilities`, `decision.capabilities`, `decision.not_selected`, `decision.approval_required`, `decision.reasons`, and `decision.runtime_resolution` come from the decision envelope, not the snapshot.
- `escalation_count` is sourced from `snapshot.escalationCount`; `escalation_history` starts as `[]`; `last_resolution` is copied from `decision.runtime_resolution`; `single_writer` is hardcoded to `"orchestrator"`.
- `started_at`, `updated_at`, `completed_at` initialize to `null` and are stamped by `writeAdaptiveSnapshot` on write.

When the production orchestrator lands, it must perform this same translation when persisting a decision to loop state. Until then, only tests exercise the full detector → mapping → snapshot flow.

## 5. Why the divergence is intentional

Plan Section 10 explicitly allows this divergence: *"Parity tests do NOT compare: storage paths, installation flows."* The two shapes serve different consumers with different constraints:

- **Shape A (portable, camelCase)** is optimized for **contract parity and cross-repo fixture comparison**. It carries fields like `decisionId`, `requestDigest`, `revisionMarker`, and `nextAction` that a portable contract consumer (LazyBuddy, fixture harnesses, parity tests) needs to reason about a decision without knowing how any host persists it.
- **Shape B (persisted, snake_case)** is optimized for **loop-state persistence and human-readable status display**. It carries timestamp triples (`started_at` / `updated_at` / `completed_at`), `escalation_history`, and `not_selected` transparency fields that the loop store and `lazytrae completion-status` render for humans.

Forcing one shape to serve both jobs would either bloat the portable contract with host-persistence concerns, or starve the loop-state display of fields it needs. The divergence keeps each consumer's contract minimal.

## 6. Maintenance hazard warning

Future maintainers must internalize this dual-shape design before touching adaptive code:

- **When adding a new field, decide which shape(s) it belongs to.** Contract concerns belong in Shape A and `adaptive-harness-contract.v1.json` `snapshot_schema`; persistence/display concerns belong in Shape B, `REQUIRED_FIELDS`, and `active-loop.schema.json`. Some fields legitimately appear in both shapes under different names (e.g., `escalationCount` ↔ `escalation_count`).
- **When comparing LazyTrae and LazyBuddy run state, remember they persist different shapes.** LazyBuddy persists Shape A; LazyTrae persists Shape B. A field-for-field diff of the two persisted blocks will fail by design — that is not a parity regression.
- **The `adaptive-harness-contract.v1.json` schema is the portable shape (Shape A) — NOT the LazyTrae persisted shape.** Do not validate `loopState.adaptive` against `adaptive-harness-contract.v1.schema.json`; validate it against `active-loop.schema.json` and `validateAdaptiveSnapshot` instead.
- **The `requestDigest` → `requestSlug` rename is in flight.** Until the v1.0.3 patch lands, production code emits `requestDigest`. Update the portable contract schema and any fixture comparators together when the rename lands.
