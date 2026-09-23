# LazyTrae v1.3.1 release candidate

**Status:** Unpublished. v1.3.0 remains the latest stable release. This candidate has passed repository tests and PR CI; Trae activation in a fresh host session still needs live testing.

## What changed

- **Safer execution:** Intent routing distinguishes explicit work requests from planning requests; ambiguous or denied requests remain plan-only. Isolation distinguishes directory allocation from Git worktree provisioning, rejects untracked caller changes, and preserves populated allocations during release and recovery.
- **Better evidence:** Outcome comparisons hash the supplied task, budget, and permission snapshots and reject mismatched cohorts. Reports distinguish absent, partial, and validated evidence, count explicit host-billed costs from failed runs, and reject fixture telemetry as execution data. Hashes verify supplied bytes, not the truth of their contents.
- **Predictable delegation:** Subagents keep the current model by default. A plan can propose task-specific routing, but switching requires an explicit plan decision and `--allow-switch`. Host-scoped suggestions are advisory; they do not alter host configuration or claim native model availability. Unsupported `auto`, `max`, and `lite` subagent aliases are omitted.
- **Current guidance:** The installed onboarding guide and README now agree: Node.js LTS 24 is recommended, 22 is supported, and the lifecycle accepts 20 for compatibility. Contributor and release documentation reflect the candidate. Obsolete attribution and initial-port files were removed; credits and licenses remain in NOTICE and LICENSE.

## Verification and remaining test

The candidate passed repository source, package, publication, and CLI checks, plus all nine checks on [PR #36](https://github.com/elvinzhao10/LazyTrae/pull/36). Those checks do not establish that a release archive loads in a host. Fresh-session TraeCode, TraeWork, and TraeCode CLI installation, activation, MCP, specialist, cancellation, and completed-task behavior remain unobserved. No measured productivity, speed, or native-cost improvement is claimed.

## Upgrade and rollback

Keep v1.3.0 as the stable version until the exact v1.3.1 archive and host routes are verified. Before upgrading, record the installed version and lifecycle ownership, then validate the exact candidate archive. To roll back, stop the host session and use the lifecycle offboard/rollback route for the previous release. Remove only unmodified receipt-owned assets; preserve modified, unknown, linked, caller-owned, and host-managed files. Start a fresh session to verify the restored installation.
