# LazyTrae v1.4.0 - vendored dashboard core and native Trae adapter

A feature release across the six LazySeries siblings: the family's portable
dashboard core is vendored identically into every package and wired through a
native Trae adapter.

## Project platform (2026-10-07)

- The persistent project record is vendored as the family's second pinned
  tree: `shared/project/` + `project.vendor.json` re-pin to family tree
  `95c0e0fc…` (source revision `7bf5bd8`). Trae's owning adapter stays the
  Node store at `src/lib/project-state.js` (`.lazytrae/state/project.json`,
  journaled state transactions, read-only active-loop identity mapping, and
  the neutral `.lazyseries/project.json` registry); the vendored Python
  bridge route is not shipped here by the family boundary.
- Trae's capability declaration remains distinct from the siblings'
  dashboard-host capability record: per-surface readiness is declared through
  the host-capability-matrix, and the project-adapter suite now asserts that
  matrix claims `host-executed`/`host-observed` for no capability without a
  fresh current-session probe (mutation-proven).
- Boundaries stay explicit: the vendored git-observation collectors are
  byte-pinned but wired into no Trae project route (this surface exposes no
  git view; commit links stay producer-side `source_revision`); native host
  embedding, chat handoff, and host wake remain unobserved; host readiness
  stays pending.

## Eval-driven fixes

- The portable dashboard core (projection, command/queue reducers, browser UI)
  is vendored from the LazyBuddy source tree byte-identically and pinned in
  `shared/dashboard.vendor.json`; the Trae adapter, authenticated loopback
  service, and bounded execute/verify workload are native to this package.
- The core MCP server gains its sixteenth tool, `lazytrae.dashboard`
  (start/open/status/stop/snapshot/context). It manages the owned browser
  dashboard or reads native task context; it does not execute tasks.
- Every stale "15 tools" string in the README, AGENTS guides, evaluation,
  reference docs, CLI package README, and the MCP description writers is
  corrected to 16, and the managed-entry identity constant moves together
  with its template writers.
- The family's persistent project core is vendored into
  `shared/project/` (pinned in `shared/project.vendor.json`) and exposed
  through a native Trae store: `lazytrae project init|read|command`. The
  record is strictly opt-in — `read` and `command` are inert typed
  not-initialized results before an explicit `init`, and the seventeenth
  core MCP tool `lazytrae.project` (read/command) never initializes and never
  schedules work. Project, dashboard and native loop share one repository
  identity (`trae:<sha256>`); a plan links to an inspected native run, never a
  created one.
- The adapter suite covers CAS and replay, cycle rejection, queue persistence,
  revision-bound execution with an independent verifier, failed/cancelled/
  dirty/stale history, authentication and path boundaries, owned lifecycle,
  restart, and crash recovery. The packed-route MCP test exercises the
  documented local `npm pack` tarball route.

## Measured efficiency

No latency, token, cost, or native-host performance improvement is claimed.
The dashboard service binds an owned loopback port with an authentication
boundary; queue edits never start work, so planning traffic cannot trigger
execution. Host embedding, chat handoff, and wake remain unobserved.

## Host capability matrix

TraeCode, TraeWork, and TraeCode CLI remain three independent hosts. The
dashboard is package-owned local software: it does not prove that a host
embedded it, handed off a chat, or woke from a host event. `dashboard
context` reports `host_execution: not-observed`. **HOST READINESS: PENDING**
until the selected current client demonstrates discovery, skill/command
execution, relevant hooks, and MCP connections.

## Migration and upgrade

Use the receipt-aware lifecycle update with an explicit project binding.
Preserve populated run state, modified assets, unknown files, and host
settings. Existing 1.3.5 tags and assets remain intact. Managed MCP entries
written by 1.3.5 carry the previous core description; run `lazytrae sync`
after upgrading so managed entries match the current identity.

Read [AGENTS.md](AGENTS.md), [README.md](README.md), and the selected host
guide before following a native installation route.

## Known risks

Until `lazytrae-ai` 1.4.0-family versions are published to npm,
`lazytrae-plugin/packages/mcp` cannot resolve its pinned CLI dependency with
a plain `npm ci`; the documented local `npm pack` tarball route in
[Test and release verification](docs/09-test-and-release-verification.md) is
the workaround. `packages/cli` itself has no unpublished dependency and stays
installable. Authenticated current-client acceptance remains pending: a
copied configuration, manifest validation, or isolated lifecycle fixture
cannot establish host loading. Native host embedding, chat handoff, and wake
stay unobserved.

## Rollback

Retain the previous release and receipts. Follow the scoped lifecycle removal
or rollback plan, preserving user-modified and foreign assets. Stop the owned
dashboard service with `lazytrae dashboard stop` before rollback; host-managed
registrations require their selected client's removal flow; never remove
credentials, sessions, or entire shared configuration directories.

## Prior release notes

# LazyTrae v1.3.5 - runtime verification and platform clarity

A maintenance release across the six LazySeries siblings. It carries forward
the workflow and run-integrity foundation from 1.3.0 through 1.3.4.

## Eval-driven fixes

- Runtime-floor checks execute named package, installation and lifecycle tests.
  Missing or unknown exercises and failed subprocesses cannot report PASS.
- Optional TypeScript LSP installation is tested separately with engine-strict
  dependency installation and the installed server executable.
- Hook payloads are bounded before parsing and kept out of process arguments.
  Invalid or oversized events preserve each adapter's exit and state contract.
- Current product names, configuration scopes and native extension capabilities
  are distinguished from legacy routes and unverified live integration.

## Measured efficiency

Packed CLI releases exclude generated optional-provider dependency trees while retaining their bundled runtime dependency closure. This prevents source-side provider installations from inflating the tarball or overflowing package-test output buffers.

Hook boundary repairs avoid payload-sized process arguments and bound input
memory. The first host-independent verification unit is vendored identically
in sibling packages, with product-specific exercises in small adapters.
No latency, token, cost or native-host performance improvement is claimed.
Persistent LSP sessions and event-ledger compaction remain future measured work.

## Host capability matrix

TraeCode, TraeWork and TraeCode CLI remain separate surfaces. Current CN TraeCode documents blocking hooks, while this package's legacy hook adapter remains advisory. CLI 2.0 documents plugins, skills and MCP; its configuration must not be inferred from legacy CLI candidates.

See [the dated platform audit](docs/reference/platform-status-2026-10-02.md).
**HOST READINESS: PENDING** until the selected current client demonstrates
discovery, skill/command execution, relevant hooks and MCP connections.
Official feature documentation and package tests are separate evidence.

## Dependencies and runtime requirements

Node.js 24 is recommended. Core lifecycle compatibility remains Node.js 20;
LazyTrae's standalone CLI also retains its separate Node.js 18 compatibility
tier. Optional TypeScript language-server 6.x requires Node.js 22.22.2 or later;
5.x providers retain their own Node.js 20 requirement.
Python language-server providers are aligned at basedpyright 1.40.1.
LazyTrae uses fast-uri 4.2.1 directly and the patched 3.1.8 Ajv edge, with
security and normalization regressions preserved.

## Migration and upgrade

Use the receipt-aware lifecycle update with an explicit project binding.
Preserve populated run state, modified assets, unknown files and host settings.
Select the exact client and version before following a native installation route.
Kimi Code clients can share configuration; Kimi Work is a separate target.

Read [AGENTS.md](AGENTS.md), [README.md](README.md) and the selected host guide.
Use a newly versioned archive; existing 1.3.4 tags and assets remain intact.

## Known risks

Authenticated current-client acceptance remains pending. A copied configuration,
manifest validation, or isolated lifecycle fixture cannot establish host loading.
Optional providers must satisfy their own runtime floor.
Native features added upstream are not automatically wired into the adapter.

## Rollback

Retain the previous release and receipts. Follow the scoped lifecycle removal
or rollback plan, preserving user-modified and foreign assets. Host-managed
registrations require their selected client's removal flow; never remove
credentials, sessions or entire shared configuration directories.
