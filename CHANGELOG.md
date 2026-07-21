# Changelog

All notable public changes to LazyTrae are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.3] - 2026-07-20

### Added

- Adaptive harness contract (`adaptive-harness-contract.v1.json`) shared
  byte-identical across LazyTrae and LazyBuddy, with paired sha256 digest
  parity and no runtime coupling between repositories.
- Ten behavioral fixtures under `contracts/fixtures/v103/` covering direct,
  assisted, planned, orchestrated, long-horizon, provider-fallback,
  explicit-override, escalation-bound, and responsibility-ownership
  scenarios.
- Thin adaptive adapter for LazyTrae (`adaptive-decision.js`,
  `adaptive-mapping.js`, `adaptive-snapshot.js`, `adaptive-explanation.js`)
  that extends the existing detector, broker, loop state, and completion-gate
  seams without duplicating execution logic.
- Optional additive `adaptive` snapshot block in loop/run state
  (single-writer, backward-compatible); existing v1.0.2 state without the
  block continues to load.
- Deterministic seven-step decision policy: explicit override then compatible
  continuation then long-horizon then orchestrated then planned then
  assisted then direct, selecting the lowest sufficient mode.
- Bounded escalation: at most two automatic depth escalations per decision,
  after which a blocked-state record is produced.
- Authority-safe capability fallback with substitution reporting through
  existing status surfaces.
- Adaptive explanation through the existing `completion-status` command
  output (mode, selected stages, responsibilities, capabilities,
  not-selected, approval required).
- Capability-qualified Trae IDE, Trae Work, and Trae CLI mappings.

### Changed

- `formatAdaptiveExplanation` now surfaces `Reasons:` and `Substituted:`
  sections when fallback occurs.
- `completion-status` command output extended with the adaptive explanation
  when an `adaptive` block is present in state.
- Updated package, runtime, template, and onboarding identities to v1.0.3.
  Local-first onboarding remains the primary route.

### Known Gaps (deferred to v1.0.4)

- Continuation resume: the classifier does not yet resume from compatible
  snapshots (plan Section 6 step 2). Every request produces a fresh
  decision. Pinned by xfail tests.
- Evidence freshness: `revisionMarker` is constant (`git:HEAD`); stale
  snapshot detection and the re-verification trigger signal are not
  implemented. Pinned by xfail tests.
- Live-host QA: Trae IDE, Trae Work, and Trae CLI live-host verification
  PENDING (no live host available in the release session). Package evidence
  and fixture-based parity verified; live-host evidence not captured.

### Unchanged

- Authority boundaries: read-only and package-owned capabilities activate
  automatically; installations, persistence, host settings, credentials, and
  remote access require approval.
- Host readiness boundaries: package evidence is not live-host evidence.
- No new MCP servers, remote providers, host settings, or production
  dependencies.
- No cross-repository runtime dependencies.
- No state-store replacement or memory migration.
- No dynamic command or hook registration.
- Explicit named workflows (`lazy-ulw-plan`, `lazy-start-work`,
  `lazy-review-work`, `lazy-ulw-loop`) remain authoritative.

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
