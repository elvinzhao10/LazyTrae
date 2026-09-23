# LazyTrae v1.3.1

**Status:** Published stable release. Repository and package checks passed; see [PR #36](https://github.com/elvinzhao10/LazyTrae/pull/36) for change and CI history. Trae activation in a fresh host session still needs live testing.

## Eval-driven fixes

- **Safer execution:** Intent routing distinguishes explicit work requests from planning requests; ambiguous or denied requests remain plan-only. Isolation distinguishes directory allocation from Git worktree provisioning, rejects untracked caller changes, and preserves populated allocations during release and recovery.
- **Better evidence:** Outcome comparisons hash the supplied task, budget, and permission snapshots and reject mismatched cohorts. Reports distinguish absent, partial, and validated evidence, count explicit host-billed costs from failed runs, and reject fixture telemetry as execution data. Hashes verify supplied bytes, not the truth of their contents.
- **Predictable delegation:** Subagents keep the current model by default. A plan can propose task-specific routing, but switching requires an explicit plan decision and `--allow-switch`. Host-scoped suggestions are advisory; they do not alter host configuration or claim native model availability. Unsupported `auto`, `max`, and `lite` subagent aliases are omitted.
- **Current guidance:** The installed onboarding guide and README now agree: Node.js LTS 24 is recommended, 22 is supported, and the lifecycle accepts 20 for compatibility. Contributor and release documentation reflect v1.3.1. Obsolete attribution and initial-port files were removed; credits and licenses remain in NOTICE and LICENSE.

## Measured efficiency

No measured productivity, speed, or native-cost improvement is claimed. Local source, package, publication, and CLI checks passed; [PR #36](https://github.com/elvinzhao10/LazyTrae/pull/36) records the current CI results.

## Host capability matrix

| Host | Candidate route | Live status |
| --- | --- | --- |
| TraeCode | Project | Pending fresh-session test |
| TraeWork | User Skills or documented selected route | Pending fresh-session test |
| TraeCode CLI | CLI | Pending fresh-session test |

## Migration and upgrade

Before upgrading, record the installed version and lifecycle ownership, then validate the exact v1.3.1 archive. Treat package verification and native-host activation as separate checks.

## Known risks

Repository and CI checks do not establish that a release archive loads in a host. Installation, activation, MCP, specialist, cancellation, and completed-task behavior remain unobserved in fresh Trae sessions. Evidence hashes bind supplied bytes but do not establish their independent truth.

## Rollback

Stop the host session and use the lifecycle offboard/rollback route for the previous release. Remove only unmodified receipt-owned assets; preserve modified, unknown, linked, caller-owned, and host-managed files. Start a fresh session to verify the restored installation.
