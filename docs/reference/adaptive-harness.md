# Adaptive Harness: Canonical Snapshot

> Reference for v1.0.3 maintainers. LazyTrae produces and persists one exact
> camelCase adaptive snapshot. There is no snake_case persistence shape or
> production translation layer.

## 1. One production shape

`classifyAdaptiveDecision` returns a decision envelope with a canonical
`snapshot`. When an active loop exists, `processAdaptivePrompt` passes that same
snapshot to `writeAdaptiveSnapshot`, which validates it, deep-copies it into
`loopState.adaptive`, and saves the loop through the existing atomic state
writer. No field mapping occurs between classification and persistence.

The closed shape is defined in three matching places:

- `REQUIRED_FIELDS` and `validateAdaptiveSnapshot` in
  `lazytrae-plugin/packages/cli/src/lib/adaptive-snapshot.js`;
- `definitions.snapshot` in
  `lazytrae-plugin/packages/cli/contracts/adaptive-harness-contract.v1.schema.json`;
- the optional `adaptive` block in
  `lazytrae-plugin/.lazytrae/schemas/active-loop.schema.json`.

The shared root contract remains behavior-only. Its fixtures carry the
canonical snapshot, while runtime/provider resolution stays excluded from the
portable contract.

## 2. Exact 20-field snapshot

The validator accepts exactly these 20 fields and rejects additional fields:

| Field | Purpose |
| --- | --- |
| `version` | Snapshot schema version; fixed at `1`. |
| `decisionId` | Decision identity. A compatible continuation retains it; reclassification creates a new one. |
| `requestDigest` | SHA-256 digest of the exact UTF-8 prompt bytes. |
| `mode` | One of `direct`, `assisted`, `planned`, `orchestrated`, or `long-horizon`. |
| `stages` | Ordered selected stages. |
| `currentStage` | Saved stage and continuation position; it must be present in `stages`. |
| `responsibilities` | Selected responsibility classes. |
| `capabilityClasses` | Selected portable capability classes, never provider names. |
| `capabilitySubstitutions` | Any class-level fallback and its evidence downgrade. |
| `approval` | Exact `{ requiredClasses, status }` action-class approval state. |
| `escalationCount` | Number of recorded automatic transitions, from `0` through `2`. |
| `escalationHistory` | Ordered transitions; its length and sequence numbers match `escalationCount`. |
| `revisionFingerprint` | `{ status, digest }`; unavailable revision evidence is represented by `{ status: "unavailable", digest: null }`. |
| `scopeFingerprint` | SHA-256 digest of the canonical task boundary. |
| `hostFingerprint` | SHA-256 digest of the capability and authority boundary. |
| `risk` | Current `low`, `standard`, `material`, or `high` risk classification. |
| `reasons` | Portable reasons for the decision. |
| `blocker` | Structured bounded-escalation blocker, or `null`. |
| `nextAction` | Portable next action for the current decision. |
| `verificationLevel` | `targeted`, `standard`, `independent`, or `live-surface`. |

`runtimeResolution`, `revisionMarker`, snake_case aliases, timestamps, and a
`singleWriter` marker are not snapshot fields. The single-writer rule is an
operational boundary: the adaptive runtime owns writes to `loopState.adaptive`;
Skills, agents, hooks, and MCPs do not mutate the block directly.

## 3. Classification, continuation, and persistence

The production path is:

1. `processAdaptivePrompt` computes the request, revision, scope, and host
   identity material and reads an existing active-loop snapshot when present.
2. `classifyAdaptiveDecision` selects the lowest sufficient mode. A continuation
   resumes only when `requestDigest`, `revisionFingerprint`, `scopeFingerprint`,
   and `hostFingerprint` remain compatible and current risk and approval still
   match.
3. Compatible continuation preserves the decision identity, current stage, and
   valid prior escalation history while applying current bounded escalation
   signals. Material identity change, risk change, or approval change produces
   a fresh decision; stale completion is rejected and diagnostic evidence is
   retained by the runtime.
4. `mapAdaptiveDecisionToSurfaces` resolves portable classes onto verified
   package surfaces. This mapping is outside the snapshot.
5. With an active loop, `writeAdaptiveSnapshot` validates and persists the
   canonical object unchanged. Without an active loop, the runtime returns the
   decision and reports `skipped:no-active-loop`; it does not create lifecycle
   state implicitly.

Automatic escalation is bounded at two transitions. Verification failure can
add a debugging stage, broader revealed scope can increase the mode by one
level, and a further failure after the bound produces the complete structured
blocker instead of an unbounded repair loop.

## 4. Authority and evidence boundaries

Responsibility selection and approval are separate:

- exploration, planning, implementation, debugging, verification, continuity,
  quality review, release review, and security review are automatic
  responsibilities;
- approval is required only for the concrete action classes listed in the
  contract, including installation, persistent capability changes, credentials
  or paid services, remote data egress, browser or desktop control, host/MCP
  settings mutations, and account, marketplace, or publish mutations.

Selecting `orchestrated`, `release-review`, or `security-review` does not itself
request approval. A requested approval-class action does.

Package qualification and a persisted directive do not prove host execution.
The emitted directive records `hostExecution: "not-observed"`; host readiness
remains pending until the selected Trae surface is observed separately.

## 5. Maintainer checks

When the snapshot changes, update the runtime validator, contract fixture
schema, active-loop schemas, fixtures, and round-trip tests together. Keep all
of them closed to extra fields and keep provider identifiers out of portable
text.

Useful focused checks from `lazytrae-plugin/packages/cli` are:

```bash
node --test test/adaptive-snapshot.test.js test/adaptive-contract.test.js \
  test/adaptive-integration.test.js test/adaptive-installed-runtime.test.js \
  test/state-contracts.test.js
```

These checks establish the local snapshot and persistence contract. They do not
establish discovery, hook execution, a running host session, or an MCP
connection.
