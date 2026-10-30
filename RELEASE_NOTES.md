# LazyTrae v1.4.0

## Unreleased 1.4.1 — verification, history and scale

The combined former 1.4.1 and 1.4.2 scope is implemented in this development branch. Package metadata and the published baseline remain **1.4.0**; this PR does not publish a release. Live-host acceptance is **deferred by the maintainer as of 2026-10-30**, and remains pending.

- Retain versioned verification scenarios, compare attempts by their source/criterion/plan subject, and promote an observed failure into an unverified regression scenario.
- Bind rerun review to the exact plan, criterion and captured source. Pending, rejected, stale and used approvals cannot authorize another native attempt; independent verification remains required.
- Inspect checkpoint/decision history through authenticated, paginated reads. Deduplicate identical runtime events with transactional recovery while retaining the original ledger and failed attempts.
- Preserve first-review plan bytes, correct legacy review-state updates, and harden owned-process cleanup against PID reuse and exit races.
- Reduce repeated replay and unnecessary review-source capture in measured local cases. These measurements do not establish whole-task latency, token or cost savings.

See the [1.4.1 completion and validation record](docs/verification/1.4.1-completion.md) and [usage/contracts](docs/verification/1.4.1-verification-history.md).

LazyTrae 1.4.0 adds the shared local project dashboard and persistent project
record to the existing planning, execution and verification workflows.

## Dashboard and project work

- An authenticated local dashboard with eight destinations: **Overview, Project,
  Plans, Health, Execution, Git, Evidence and Research**.
- A project record, editable plans, queue planning and research capture, with
  source revisions and evidence references visible for review.
- A run monitor that separates execution progress from verified completion,
  plus reported token usage, resource activity and retained-run history.
- A Health inventory of package components, separate from observed host activity.

The collapsible sidebar, contextual Details and expandable pan/zoom maps keep
navigation within the project. Source edits use authenticated native project
binding and revision checks. Queue edits do not start work. Plans and research
retain source revision and evidence references; these references are not
immutable source copies or verification verdicts. Unknown usage stays unknown,
and recorded comparisons do not establish efficiency savings.

The core MCP server exposes 17 tools. `lazytrae.dashboard` manages the local
service or reads task context; `lazytrae.project` reads and updates an explicitly
initialized project record. Neither MCP tool executes work.

The dashboard and project cores are hash-pinned in the package's
[vendor manifests](lazytrae-plugin/packages/cli/shared/dashboard.vendor.json), with a separate
[project manifest](lazytrae-plugin/packages/cli/shared/project.vendor.json). See the
[documentation index](docs/README.md) for package architecture and usage.

## Host capability matrix

Current CN TRAE combines Agent and IDE modes; TRAE SOLO CN and CLI are
separate surfaces. The `TraeCode`, `TraeWork` and `TraeCode CLI` names remain
version-specific package adapters. CLI 2.0 uses TOML configuration; the legacy
JSON handoff is not a universal registration command. CN hooks and subagents
have their own protocol and discovery rules. Package hooks remain advisory.
See the [platform audit](docs/reference/platform-status-2026-10-27.md) before
choosing a region, build, mode and route.

## Known risks

**HOST READINESS: PENDING.** Package checks do not prove plugin loading, hook
execution, model selection or live MCP connections. Browser embedding, chat
handoff and host wake remain unobserved. No current-session model selection or provider entitlement is established.

## Migration and upgrade

Use Node.js 24 LTS (recommended) or Node.js 22 LTS and Git. The core lifecycle
also accepts Node.js 20 for compatibility. Optional providers have their own
runtime requirements; onboarding does not enable them.

Use the [installation guide](docs/03-install-and-host-verification.md) and
[AGENTS.md](AGENTS.md) for the selected route. Update only receipt-owned assets
and preserve modified or unknown files,
project history and host settings. Do not combine a full-plugin route
with its fallback. After updating, observe a fresh host session separately
from package checks.

## Rollback

Keep the previous release and its receipts. Rollback and removal remain
receipt-scoped; follow the [removal guide](docs/08-safe-removal.md) instead of
deleting host directories.

## Eval-driven fixes

Source writes check the expected revision before mutation, and project stores
reject a foreign runtime identity. Package verification covers these local
boundaries separately from native host acceptance.

## Measured efficiency

Usage and retained-run comparisons display recorded inputs only. Missing usage
is not zero, fixture measurements are not live host measurements, and this
release makes no token, time, resource or cost-saving claim.

## Release verification and distribution

The [release workflow](.github/workflows/release.yml) checks the tag against the
package version and gates publication on the full CLI suite, standalone MCP runtime tests and publication checks.
It builds `lazytrae-ai-v1.4.0.tgz` for the selected tag and publishes it as a GitHub Release
asset. The workflow packs the CLI with `npm pack` after its verification gates;
existing published assets are retained. This workflow does not publish to npm
and does not make `lazytrae-ai` or `@lazytrae/mcp-server` available from that
registry. Registry-dependent workspace installation requires separate
publication; use durable GitHub onboarding or the documented local tarball
route for source verification.

Final CI and release-job outcomes belong to the tagged commit's Actions run;
these notes do not substitute for that result or for current-session host
acceptance. Reproduction commands are in the
[test and release guide](docs/09-test-and-release-verification.md).

Historical release entries remain in [CHANGELOG.md](CHANGELOG.md) and dated
platform audit documents.
