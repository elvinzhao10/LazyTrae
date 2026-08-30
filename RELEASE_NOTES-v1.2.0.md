# LazyTrae v1.2.0 — evidence-bound execution and release integrity

This file prepares the coordinated v1.2.0 package. It does not publish a tag,
GitHub release, marketplace entry, or host registration. Package readiness and
host readiness remain separate authorities.

## Eval-driven fixes

- Completion now requires revision-bound, independently verified evidence and
  rejects stale context, spoofed dirty-tree probes, weak or missing artifacts,
  and changed capability fingerprints.
- Transactional loop state and task leases recover after interruption and use
  atomic publication so concurrent work cannot claim another task's namespace.
- Bounded cost telemetry records invocations, evidence bytes, reruns, rework,
  concurrency, and unavailable token/timing telemetry without inventing data.
- Deterministic risk classification scales verification work while preserving
  the final completion and evidence gates.
- Contributor verification now discovers only `*.test.js`, partitions source
  and package coverage without overlap, defaults to bounded concurrency `2`
  (maximum `4`), and keeps proven lock/process timing tests serial. Risk-gate
  JSON reports include in-memory monotonic total and per-gate timing without
  adding telemetry persistence.
- Current TraeCode surfaces, adapters, status, receipts, and capability evidence
  are fingerprint-bound. TraeCode CLI remains configuration-only until observed.
- Network redirects, local MCP transport, path boundaries, and sensitive output
  are hardened; lifecycle regression coverage preserves modified, unknown, and
  unrelated files through v1.1.0-to-v1.2.0 upgrade and removal.

## Measured efficiency

Checked-in fixtures under
`lazytrae-plugin/packages/cli/test/fixtures/efficiency/` record the comparison.
The direct scenario completed 13 assertions in one invocation with 2,531 bytes
of required evidence, zero reruns, and zero rework. The six-module scenario
completed 57 assertions in one invocation with 9,403 evidence bytes, zero
reruns, and zero rework. Both passed the same three gates: exact assertions,
completion classification, and required evidence. Validation elapsed time and
token totals are explicitly unavailable in the checked-in records, so no timing
or token savings are claimed. The fixtures use `validation_elapsed_ms` to keep
that missing baseline measurement distinct from live verification report timing.

## Host capability matrix

| Product surface | v1.2.0 package capability | Host evidence boundary |
| --- | --- | --- |
| TraeCode | Project Skills, commands, rules, agents, hooks, and one core local MCP declaration | Ready only after a fresh observed session and current fingerprint-bound evidence |
| TraeWork | Explicit desktop/local package profile and approval-gated Skills copy | Web, mobile, and cloud profiles are descriptors; host readiness remains pending without observation |
| TraeCode CLI (`traecli`) | Receipt-owned inert candidate generation and package checks | No universal registration or uninstall command is invented; a current runner probe is required |
| CodeBuddy / WorkBuddy | Provided by the paired LazyBuddy package, not LazyTrae | Use LazyBuddy's package and host-specific evidence boundaries |

## Migration and upgrade

Upgrade only through the durable release-owned lifecycle launcher. A v1.1.0
receipt may be upgraded to v1.2.0 after inventorying managed, modified, unknown,
and unrelated assets. Preserve schema versions, v1/v2 contract filenames,
historical fixtures, credentials, host settings, and user changes. A generated
file or passing package check never upgrades host readiness.

## Known risks

- Live TraeCode, TraeWork, and TraeCode CLI readiness is still pending unless a
  current supported build/session is visibly observed.
- Risk-scaled verification reduces unnecessary intermediate work, but final
  release, security, parity, and evidence gates remain mandatory.
- Same-version ref movement, a changed runtime, or changed host fingerprint
  invalidates prior evidence and requires the documented confirmation or
  re-onboarding path.

## Rollback

Use the durable launcher's receipt-scoped offboard/rollback flow. Remove only
v1.2.0 receipt-owned unmodified assets after approval, preserve modified or
unknown files and host registrations, and never restore v1.1.0 over user
changes. If runtime identity is stale, use a fresh verified checkout for scoped
offboard and then onboard the desired immutable release.
