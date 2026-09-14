# LazyTrae v1.2.3 — platform compatibility patch

**Release date:** 2026-09-14

This release prepares the v1.2.3 package. It does not publish a tag, GitHub
release, marketplace entry, host registration, or proprietary host execution.
Package readiness and host readiness remain separate authorities.

This is a patch release. It changes host-facing MCP declaration validation,
setup and status output, and plan parsing. Workflow and decision-memory
features are **not** part of this release; they are scheduled for v1.3.0.

## Eval-driven fixes

- MCP declarations are validated before they are trusted. Every declared server
  must use a space-free `command`; a declaration that violates this reports a
  typed error naming the server and the remediation instead of loading anyway.
- Only `${workspaceFolder}` is expanded as a documented variable. An
  unsupported variable is reported rather than silently passed through, so a
  declaration cannot appear valid while referencing an unresolvable path.
- The project-level MCP opt-in is presented as a host setting. `init` prints
  the enable-and-confirm step for the selected host and states that enabling
  the toggle is not an observation that a server is running.
- `status` prints the remaining step per host and names the failing component
  with its detail, so a reader does not have to infer the next action.
  Package readiness and host readiness stay separate authorities.
- Plan parsing accepts the canonical `## TODOs` heading and the legacy
  `## Todos` form. A non-empty plan that parses zero tasks now fails with an
  actionable error rather than reporting success, and missing or duplicate task
  identifiers are reported instead of matched by guesswork.
- Shipped hook patterns use POSIX character classes, so a host tool surface
  that interposes a command shim without extended-class support does not
  silently change the destructive-command guard.

## Measured efficiency

This patch does not change the compact execution evidence figures. The v1.2.2
measurements remain the current authority. No new efficiency claim is made
here, and no unavailable token reduction is asserted.

## Host capability matrix

| Product surface | v1.2.3 package capability | Host evidence boundary |
| --- | --- | --- |
| TraeCode | Local project assets, core MCP declaration, and native context presentation. | Discovery, hooks, session, MCP connection, and execution require current observation. |
| TraeWork | Explicit profile plus approval-gated Skills copy and manual MCP JSON. | A presentation is advisory; desktop/local paths do not prove execution. |
| TraeCode CLI | Local project configuration and receipt-owned candidate generation. | Candidate and presentation stay inert/unobserved until a selected build/session is observed. |

Package checks, generated files, and a probe remain package evidence only.
Every host is **pending host proof** until observed in a fresh session; this
release does not claim that any host loaded, enabled, or connected anything.

## Migration and upgrade

Upgrade through the durable release-owned lifecycle launcher. Inventory managed,
modified, unknown, linked, and caller-owned assets before promotion. Replace
only receipt-owned unmodified assets; preserve user changes and host-managed
settings. Run package checks, then start a fresh host session and observe the
selected route before reporting host readiness.

Declarations that already use a space-free `command` and a documented variable
need no change. A project-level MCP surface that was previously enabled by hand
still requires the host opt-in to be confirmed in the current build.

## Known risks

- Discovery, hooks, session, MCP connection, and execution remain host-owned
  and pending without current-session evidence.
- Command validation is a local declaration boundary. It does not prove that a
  declared server starts, that its arguments are safe, or that a host will load
  it.
- Host tool surfaces may interpose their own command shims. A shim that does
  not implement POSIX regular-expression classes can change the behavior of
  shipped shell checks on that host; this release converts the affected hook
  patterns to POSIX character classes but cannot constrain arbitrary host shims.
- Same-version ref movement, a changed runtime/executable, or a changed host
  fingerprint invalidates prior evidence and requires re-verification.

## Rollback

Use the durable launcher’s receipt-scoped offboard or rollback flow. Remove
only v1.2.3 receipt-owned unmodified assets after approval. Preserve modified,
unknown, linked, caller-owned, and host-managed files and registrations; never
restore an older release over user changes. For a stale runtime, use a fresh
verified checkout for scoped offboard and then onboard the desired immutable
release.
