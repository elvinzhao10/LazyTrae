# LazyTrae plugin

## Unreleased 1.4.1 — verification, history and scale

The combined former 1.4.1 and 1.4.2 scope is implemented in this development branch. Package metadata and the published baseline remain **1.4.0**; this PR does not publish a release. Live-host acceptance is **deferred by the maintainer as of 2026-10-30**, and remains pending.

- Retain versioned verification scenarios, compare attempts by their source/criterion/plan subject, and promote an observed failure into an unverified regression scenario.
- Bind rerun review to the exact plan, criterion and captured source. Pending, rejected, stale and used approvals cannot authorize another native attempt; independent verification remains required.
- Inspect checkpoint/decision history through authenticated, paginated reads. Deduplicate identical runtime events with transactional recovery while retaining the original ledger and failed attempts.
- Preserve first-review plan bytes, correct legacy review-state updates, and harden owned-process cleanup against PID reuse and exit races.
- Reduce repeated replay and unnecessary review-source capture in measured local cases. These measurements do not establish whole-task latency, token or cost savings.

See the [1.4.1 completion and validation record](docs/verification/1.4.1-completion.md) and [usage/contracts](docs/verification/1.4.1-verification-history.md).

The current package version is v1.4.0; fresh-session native-host activation remains pending. Current CN documentation describes unified TRAE with Agent and IDE modes. The existing route names remain version-specific package adapters; the source repository audit is `docs/reference/platform-status-2026-10-30.md`.

The dashboard includes a visual run monitor with separate execution and verification progress, activity and token charts, retained-run efficiency charts, a searchable resource trace, and a Health inventory. Charts reflect available recorded data; missing usage remains unknown and comparisons do not establish an efficiency improvement. Research capture records findings and supports SHA-256-bound evidence references without copying the source or granting verification. Drafts, filters and display state survive background refresh; identical revisions are skipped.

## Durable installation

**Node.js LTS 24 (recommended) or 22 (supported alternative)** and **Git** are required. Run `lifecycle onboard`
only from `https://github.com/elvinzhao10/LazyTrae.git`, then use
`node "<install-root>/LazyTrae/launcher.js"` for `lifecycle update`,
`lifecycle status`, plan-first `lifecycle offboard`, and project commands.
The exact durable tree is
`LazyTrae/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`;
the bootstrap checkout may be deleted. A moved same-version tag requires
`--confirm-revision <full-sha>`, and a stale Node runtime requires scoped
offboard/re-onboard rather than receipt edits. Package readiness never implies
a live host: **HOST READINESS: PENDING** without current observation.

This is the self-contained distributable package for LazyTrae on TraeCode,
TraeWork, and TraeCode CLI. It includes the project configuration, companion CLI,
and local MCP server needed for its package lifecycle.

The package contains Trae configuration, the `lazytrae` CLI, and the local
stdio MCP server. Package CI runs on Ubuntu and macOS per the workflow; current host activation remains pending without fresh-session evidence. Package readiness verifies
copied assets and declarations; it does not prove host discovery or an MCP
connection.

The self-contained CLI tarball carries the CLI, local MCP implementation,
templates, package-local `LICENSE` and `NOTICE`, and its production dependency
closure. A cold offline install checks that artifact; it does not prove host
discovery or an MCP connection.

This package is part of the LazyTrae learning project. It is
primarily inspired by LazyCodex; [NOTICE](../NOTICE) records the LazyCodex and
OmO upstream attribution. It is an independent implementation and does not
require LazyCodex or OmO at runtime. For TraeWork, the release-owned
launcher's `init --host work` invokes the bounded Work skill installation; use
the same launcher with `work status` to inspect the copied package assets.

## Layout

| Path | Purpose |
| --- | --- |
| `.trae/` | Trae project configuration: skills, commands, agents, rules, hooks, and MCP declaration. |
| `.lazytrae/` | Versioned schemas and default configuration assets. |
| `packages/cli/` | Installable CLI: installer, doctor, verification gate, lifecycle, tooling, and MCP launcher. |
| `packages/mcp/` | Node stdio implementation for the local core MCP server. |
| `packages/cli/tooling/lsp/` | Locked LSP provider manifests used by the managed LSP lifecycle. |

`packages/cli/templates/` is the source of truth for files copied into consumer
projects. Keep it self-contained and run the CLI test suite after changes.

## Install, verify, and remove

Bootstrap the current package from a verified official source checkout, then use the
durable launcher rather than treating that checkout as the installed runtime:

```bash
node "<verified-source-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js" \
  lifecycle onboard --source https://github.com/elvinzhao10/LazyTrae \
  --install-root "<absolute-install-root>" --project "<absolute-project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle status \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" init --host ide
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" load-check --host ide
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" doctor
```

The source checkout is transport only and may be removed after promotion. The
durable install root must be absolute, non-root, and outside disposable
downloads or caches; the launcher does not depend on PATH or a global npm
install.

The onboarding protocol detects or asks for the host, runs safe package checks,
and reports **package readiness** separately from **host readiness**. Before
copying TraeWork Skills, adding a Settings → MCP connector, or registering
TraeCode CLI, it asks for approval. It then gives one exact host action and waits;
after the user responds it inspects the app with Computer Use. Reload/new
session is a separate action. Host readiness requires one real Skill/command
and the expected `lazytrae` core MCP connection; local checks alone leave it
pending. Work's default Skills location is verified only on macOS
(`~/.trae-cn/skills/`), and its connector remains manual.

Availability labels are evidence boundaries: the release launcher and
generated configuration are the **documented package route**; supplied macOS
IDE/Work observations are an **observed prerelease route**; and the current
surface remains **HOST READINESS: PENDING** until observed. For Work, run the
absolute local launcher with `load-check --host work`; for CLI, use
`load-check --host cli`. Copy only the JSON between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. Paste it into Work's
**Settings → MCP** or the selected CLI build's documented/manual MCP settings
flow after approval. No public universal MCP registration command is assumed.
The supplied QA could not access TraeCode CLI, so its live-host route remains
explicitly unverified.

Automatic local tooling is temporary and receipt-owned: `rg`, `sg`, and the
read-only LSP bridge may be selected for a task without changing host or
project configuration. CodeGraph and remote providers remain explicit optional
lifecycles; onboarding, doctor, and InitDeep do not enable them.

Adaptive selection reads native current task/loop/session state and produces a
capsule only for a complete matching identity. Host presentation remains
advisory (`presented-to-host` / `not-observed`), so the package does not claim
proprietary Trae execution. `init` and `sync` preflight managed conflicts and
transactionally promote only receipt-owned assets, preserving caller state,
evidence, modified, unknown, and linked bytes.

The shipped execution templates keep onboarding and review handoffs compact:
they record read-only pre-task provenance, validate the planned safe argv checks
once, and reference the task delta and evidence instead of copying full plans.
Completion recovery requires the exact task/revision/criterion-bound terminal
report; runtime criteria include a real transition. The five review lanes stay
mandatory, but only failed, missing, stale, or input-affected lanes rerun.
Context capsule free text is redacted, and a stale active goal cannot produce a
checkpoint.

Remove only receipt-owned package assets through the durable launcher. Start
with the non-mutating lifecycle plan, then confirm only the exact product root:

```bash
node "<install-root>/LazyTrae/launcher.js" lifecycle offboard \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle offboard \
  --install-root "<install-root>" --project "<project-root>" --yes --json
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" uninstall --yes
```

These commands preserve modified, unknown, caller-owned, linked, and
host-managed paths. Remove MCP registrations manually: Work through **Settings
→ MCP**, CLI through the selected build's documented MCP settings flow, and IDE
through its project MCP UI. Never assume a universal CLI command or guess a
host-managed location. If recovery is needed, only an explicitly verified
lifecycle-owned sibling bootstrap lock or product `staging/`/`locks/` artifact
may be recovered; the caller workspace is preserved.

## For package contributors

```bash
cd packages/cli
npm run test:all
node src/index.js --help
```

`npm test` runs the archive-contained package verification suite. `npm run
test:source` runs every other discovered `*.test.js`; the two inventories are
disjoint, and `npm run test:all` runs their complete non-overlapping union.
The harness defaults to two workers, accepts `LAZYTRAE_TEST_CONCURRENCY=1`
through `4`, and keeps the lock/process timing tests on its proven-safe serial
path. Helper modules in `test/` are never discovered as tests.

Risk-based `verify --json` reports an in-memory monotonic `elapsed_ms` total
and an `elapsed_ms` value for every gate outcome. These timings are returned
only in the report; they are not added to persisted telemetry. Validated
cost/outcome telemetry stores completed records with its own `elapsed_ms`,
invocation, evidence, rerun, rework, gate-outcome, and token-source fields;
it does not establish a checked-in efficiency baseline.

For contributors, keep source/template mirrors aligned, preserve receipt
ownership boundaries, and run the CLI suite before changing package behavior.
