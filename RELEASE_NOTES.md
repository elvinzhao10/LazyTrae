# LazyTrae v1.2.2 — compact execution evidence, redacted context, and transaction-safe lifecycle

**Release date:** 2026-09-05

This release prepares the v1.2.2 package. It does not publish a tag, GitHub
release, marketplace entry, host registration, or proprietary host execution.
Package readiness and host readiness remain separate authorities.

## Eval-driven fixes

- Automatic selection reads the native current task, loop, and session state.
  A bounded context capsule is emitted only when work, run, task, request,
  revision, scope, and plan identity agree; incomplete or mismatched state is
  not reused.
- Real handoff and hook adapters keep their host boundary explicit:
  `dispatch: presented-to-host` and `host_execution: not-observed`. A Trae UI
  presentation is not evidence that a proprietary host executed it.
- `init` and `sync` preflight managed MCP/config conflicts and use the existing
  receipt-owned transactional promotion path. Caller state, evidence, modified,
  unknown, and linked bytes remain preserved; an interruption publishes no
  partial receipt and a clean rerun can proceed.
- Execution and review handoffs now carry a fixed short contract plus the
  task-specific delta and artifact references, rather than repeating full plan
  prose. Before work, the contract records read-only status and owned-path
  provenance; safe plan checks are exact argv vectors, validated once.
- A completion report is accepted only when its task, execution revision,
  criteria, and artifact references match the active goal. Runtime criteria
  additionally require an entrypoint and a real before/after transition.
  Review preserves passing lanes and reruns only lanes that failed, are
  missing/stale, or received affected input; all five current lanes still need
  PASS before completion.
- Secret-bearing free text is redacted from emitted context capsules while
  structural identity remains exact. A checkpoint with a stale
  `active_goal_id` now fails before state mutation instead of falling back to
  another goal.

## Measured efficiency

The representative native context preimage is 7,227 bytes and its complete
capsule is 1,076 bytes: 6,151 bytes, or **85.11% smaller**. This is an explicit
before/after packet measurement only. It does not claim token reduction, fewer
workers, faster host execution, or behavior inside an unobserved proprietary
host.

The compact execution report removes repeated plan and role prose by reference;
it does not make an unmeasured token, latency, worker-count, or host-execution
claim.

## Host capability matrix

| Product surface | v1.2.2 package capability | Host evidence boundary |
| --- | --- | --- |
| TraeCode | Local project assets, core MCP declaration, and native context presentation. | Discovery, hooks, session, MCP connection, and execution require current observation. |
| TraeWork | Explicit profile plus approval-gated Skills copy and manual MCP JSON. | A presentation is advisory; desktop/local paths do not prove execution. |
| TraeCode CLI | Local project configuration and receipt-owned candidate generation. | Candidate and presentation stay inert/unobserved until a selected build/session is observed. |

## Migration and upgrade

Upgrade through the durable release-owned lifecycle launcher. Inventory managed,
modified, unknown, linked, and caller-owned assets before promotion. Replace
only receipt-owned managed content; preserve user changes, state, evidence,
credentials, host settings, schema/contract history, and manual registrations.
Package checks never promote host readiness. Onboarding and review templates
retain the same boundary while recording only read-only pre-task provenance,
validated safe checks, compact terminal reports, and artifact paths.

## Known risks

- macOS package paths are the verified scope. Linux, Windows, and proprietary
  Trae host execution remain unobserved unless separately observed in a current
  selected session.
- A partial, stale, or mismatched native identity has no reusable context
  capsule; create a fresh handoff instead.
- Same-version ref movement, a changed Node runtime, or a changed host
  fingerprint invalidates prior lifecycle evidence and requires the documented
  confirmation or scoped re-onboarding path.
- A terminal result missing its active task/revision/criterion identity, a
  runtime transition, or a current five-lane review is not recoverable as
  completion evidence.
- This is still a pre-publication package: no tag, GitHub release, marketplace
  entry, or host registration is created by these notes.

## Rollback

Use the durable launcher’s receipt-scoped offboard or rollback flow. Remove
only v1.2.2 receipt-owned unmodified assets after approval. Preserve modified,
unknown, linked, caller-owned, and host-managed files and registrations; never
restore an older release over user changes. For a stale runtime, use a fresh
verified checkout for scoped offboard and then onboard the desired immutable
release.
