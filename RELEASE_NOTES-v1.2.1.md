# LazyTrae v1.2.1 — release safety and interrupt handling

This file prepares the coordinated v1.2.1 patch release. It does not publish a
tag, GitHub release, marketplace entry, or host registration. Package readiness
and host readiness remain separate authorities.

## Eval-driven fixes

- Pull requests now exercise publication documentation, package installation,
  standalone MCP, product naming, workflow syntax, and fixture isolation gates.
- Weekly compatibility coverage runs the supported Node.js versions and checks
  dependency freshness without changing the release or weakening tests.
- SIGINT received while an optional provider is starting is forwarded to the
  child process immediately; startup then waits for the child exit instead of
  lingering until the provider timeout.

## Measured efficiency

The post-v1.2.0 README retains the checked-in measurements: the direct fixture
completed 13 assertions in one invocation with 2,531 bytes of required
evidence, and the six-module fixture completed 57 assertions in one invocation
with 9,403 evidence bytes. Both recorded zero reruns and zero rework. Timing and
token totals remain explicitly unavailable, so this release claims no inferred
savings. CI adds release safety and weekly compatibility coverage rather than
changing these measurements.

## Host capability matrix

| Product surface | v1.2.1 package capability | Host evidence boundary |
| --- | --- | --- |
| TraeCode | Project Skills, commands, rules, agents, hooks, and one core local MCP declaration | Ready only after a fresh observed session and current fingerprint-bound evidence |
| TraeWork | Explicit desktop/local package profile and approval-gated Skills copy | Web, mobile, and cloud profiles are descriptors; host readiness remains pending without observation |
| TraeCode CLI (`traecli`) | Receipt-owned inert candidate generation and package checks | No universal registration or uninstall command is invented; a current runner probe is required |
| CodeBuddy / WorkBuddy | Provided by the paired LazyBuddy package, not LazyTrae | Use LazyBuddy's package and host-specific evidence boundaries |

## Migration and upgrade

Upgrade from v1.2.0 only through the durable release-owned lifecycle launcher.
Inventory managed, modified, unknown, and unrelated assets before promotion;
replace only managed assets and preserve user changes, historical fixtures,
schema versions, credentials, host settings, and genuine `.trae/` compatibility
paths. A generated file or passing package check never upgrades host readiness.

## Known risks

- Live TraeCode, TraeWork, and TraeCode CLI readiness remains pending unless a
  current supported build and session are visibly observed.
- Weekly compatibility and pull-request checks reduce regression risk but do
  not prove host discovery, registration, hook execution, or MCP connection.
- Same-version ref movement, a changed runtime, or a changed host fingerprint
  invalidates prior evidence and requires the documented confirmation or
  re-onboarding path.

## Rollback

Use the durable launcher's receipt-scoped offboard or rollback flow. Remove only
v1.2.1 receipt-owned unmodified assets after approval, preserve modified or
unknown files and host registrations, and never restore v1.2.0 over user
changes. If runtime identity is stale, use a fresh verified checkout for scoped
offboard and then onboard the desired immutable release.
