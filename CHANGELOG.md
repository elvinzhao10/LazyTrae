# Changelog

All notable public changes to LazyTrae are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-08-19

### Changed

- Published v1.1 native-host documentation boundaries for three independent
  surfaces: Trae IDE, Trae Work, and Trae CLI.
- Kept local-first onboarding on the release-owned launcher while preserving
  the boundary between package evidence and host-owned execution.
- Defined distinct generator, profile, probe, package-readiness, and
  host-readiness evidence modes. Current writers are v2; v1 receipts remain
  immutable, read-only compatibility inputs.
- Documented Work's explicit `--client`/`--execution` matrix and its
  desktop/local-only local-worktree, executable, skills-path, and bundle
  boundary.
- Documented `.traecli/` candidates as receipt-owned inert configuration that
  needs an exact fingerprinted probe before any structured-runner invocation.

### Security and removal boundaries

- No universal host CLI, marketplace publish/install, cloud upload, or native
  capability is claimed. Host discovery, registration, credentials, sessions,
  connector launch, and execution stay host-owned.
- Offboard and removal preserve host registrations and caller-modified
  candidates; package evidence cannot grant host-removal authority.

### Verification

- Current documentation separates package readiness from host readiness and
  retains `pending` until current fingerprint-bound probe, registration,
  session, MCP, and observation evidence agree.

## [1.0.3] - 2026-07-20

The durable route requires **Node.js LTS 20 or newer** and **Git**. It accepts
only `https://github.com/elvinzhao10/LazyTrae.git`; `lifecycle onboard`,
`lifecycle update`, `lifecycle status`, and plan-first `lifecycle offboard`
manage
`LazyTrae/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
`node "<install-root>/LazyTrae/launcher.js"` remains stable after source
deletion. Same-version ref movement requires `--confirm-revision <full-sha>`;
runtime replacement uses scoped offboard/re-onboard. Package success leaves
**HOST READINESS: PENDING** until current observation.

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

### Continuation and Evidence Freshness (W4.5 + W4.6)

- Compatible continuation resume: when a Section 11 snapshot is supplied via
  `context.snapshot` and both `requestDigest` and `revisionMarker` match the
  fresh values, the classifier resumes the saved `currentStage`, preserves
  the snapshot's `mode`, and carries over `escalationCount` per plan Section
  6 step 2. Incompatible revision markers or request digests force a fresh
  decision; the original snapshot is preserved in-place for diagnosis.
- Evidence freshness: when `context.prior_snapshot.revisionMarker` differs
  from `context.current_revision_marker`, the classifier restarts from the
  `understand` stage in assisted mode and emits stale / re-verification
  reasons (plan Section 18). No new lineage database is introduced; the
  existing `completion-gates.js` verifier surface is reused.
- `revisionMarker` is now accepted via `composeDecision`/`buildSnapshot`
  options so the orchestrator can supply a content-derived marker; the
  default remains `git:HEAD` for backward compatibility.

### Known v1.0.3 gaps

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
[1.1.0]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.3...v1.1.0
[1.0.2]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/elvinzhao10/LazyTrae/releases/tag/v1.0.0
