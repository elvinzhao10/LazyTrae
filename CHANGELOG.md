# Changelog

All notable public changes to LazyTrae are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.3] - 2026-07-20

### Changed

- Shipped the adaptive harness: outcome-first selection of the smallest
  sufficient workflow mode (direct, assisted, planned, orchestrated,
  long-horizon) with bounded escalation, authority-safe capability fallback,
  and an additive single-writer adaptive snapshot that preserves local-first
  onboarding and the existing v1.0.2 state contract.
- Updated current package, runtime, template, and onboarding documentation
  identities for the v1.0.3 release; local-first onboarding remains the
  primary route and host readiness stays PENDING until a fresh Trae session
  is observed.
- Added the shared `adaptive-harness-contract.v1.json` and behavioral
  fixtures, byte-identical across LazyTrae and LazyBuddy, with paired digest
  parity and no runtime coupling between repositories.
- Extended the existing detector, broker, loop state, and completion-gate
  seams with a thin adaptive adapter; no new MCP server, no new provider, no
  state-store replacement, and no dynamic command or hook registration.
- Kept explicit named workflows authoritative; the harness selects
  capabilities automatically only when the user states an outcome without
  naming a workflow.

### Verification

- Package checks validate local files and declarations only; host discovery
  and MCP connection remain pending until a fresh Trae session is observed.

## [1.0.2] - 2026-07-18

### Changed

- Shipped the local-first onboarding hotfix: a v1.0.2 release can be run from
  its permanent folder while package readiness stays separate from observed
  Trae host readiness.
- Updated current package, runtime, template, and onboarding documentation
  identities for the v1.0.2 release.
- Prepared all six package and lockfile pairs for reproducible publication.
- Made the permanent release launcher the primary route, including paths with
  spaces, with no dependency on a global `lazytrae` PATH entry.
- Qualified IDE/Work behavior as prerelease observation and kept every current
  host result pending until Computer Use or user-supplied evidence verifies a
  real Skill/command and the core MCP connection.
- Standardized Work and CLI on paste-ready MCP JSON; no undocumented universal
  Trae CLI registration command is prescribed.

### Fixed

- Refused initialization without an ancestor Git project before any mutation,
  preventing accidental wrong-parent changes.
- Delayed the terminal `Done.` message until Work installation and load-check
  both succeed.
- Made Work skill installation rollback transaction-owned writes while
  preserving concurrent or replaced caller content and allowing clean retry.

### Verification

- Package checks validate local files and declarations only; host discovery and
  MCP connection remain pending until a fresh Trae session is observed.

## [1.0.1] - 2026-07-17

### Fixed

- Prevented Node's test discovery from recursively treating the fixture runner
  itself as another test process.
- Isolated temporary npm cache and log state so test results do not depend on a
  contributor's global npm cache ownership or contents.

### Changed

- Updated GitHub Actions to current SHA-pinned artifact and checkout releases.
- Clarified source installation, project initialization, the Trae `onboard`
  prompt, release downloads, and the contribution workflow.

### Verification

- The complete package suite, publication checks, package dry run, YAML workflow
  parsing, and an installed CLI/MCP smoke path are release gates.

## [1.0.0] - 2026-07-16

- First stable public release of the self-contained LazyTrae CLI, project
  templates, local MCP server, completion gates, and explicit optional-tooling
  lifecycle.

[1.0.3]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/elvinzhao10/LazyTrae/releases/tag/v1.0.0
