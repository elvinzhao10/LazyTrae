# LazyTrae

![LazyTrae](lazytrae-banner.jpg)

LazyTrae is a self-contained workflow harness for **Trae IDE**, **Trae Work**,
and **Trae CLI**. Its companion command installs project assets, checks local
readiness, runs completion gates, and launches a local stdio MCP server.

## Current release boundary (v1.1.0)

v1.1.0 documents three independent native hosts. LazyTrae may generate local
assets, profile a selected Work context, or collect a bounded host probe; the
host alone owns discovery, registration, session lifetime, connector launch,
and credentials. A package result never promotes **package readiness** to
**host readiness**.

- **Trae IDE:** `.trae/` assets and an optional bounded probe are package
  evidence, not IDE discovery or a live MCP connection.
- **Trae Work:** select `--client desktop|web|mobile` and
  `--execution local|cloud` independently. Only desktop/local may use a local
  worktree, executable, skills path, or bundle; other profiles are descriptors
  only and do not upload, log in, or use cloud credentials.
- **Trae CLI:** `traecli-candidate generate` writes receipt-owned `.traecli/`
  configuration candidates. They are inert: no discovery, registration, marketplace installation, or execution is implied. Invocation requires an
  exact fingerprinted probe that proves a structured runner for the current
  session and worktree.

Current writers emit v2 readiness records. Historical v1 records remain
read-only compatibility evidence. No current route publishes to a marketplace, installs a marketplace package, uploads project data, or invents a native host command.

It is verified on macOS only. Package checks establish copied assets and local
contracts; the selected Trae surface remains the authority for discovery,
hook execution, and MCP connection.

## Start with the outcome

State the result you need, acceptance criteria, and the surface that must
prove it. Use the smallest workflow that fits the uncertainty and risk:

| Situation | Ask for | Why |
| --- | --- | --- |
| Small, well-understood change | A normal request | Avoid process for process's sake. |
| Unfamiliar repository | `lazy-init-deep` | Establish project-local instructions and context. |
| Broad or ambiguous change | `lazy-ulw-plan` | Make decisions reviewable before editing. |
| Approved plan | `lazy-start-work` | Execute against explicit acceptance criteria. |
| Failure | “Debug why … fails” | Reproduce, compare hypotheses, and verify the fix. |
| Material-risk completion | `lazy-review-work` | Add independent quality, QA, security, and scope checks. |
| Long-running goal | `lazy-ulw-loop` | Keep durable state and checkpoints. |

For a CLI project, invoke the release-owned launcher with `verify --must-pass`
before reporting a task complete. Trae hooks are advisory; hard completion
decisions live in the CLI and MCP gates.

## Historical adaptive harness (v1.0.3)

The historical v1.0.3 release introduced an **adaptive harness** that selects the smallest
sufficient workflow for an outcome-based request, composes existing Skills,
agents, commands, MCPs, tools, hooks, and verifiers, can persist an additive
single-writer snapshot in an active loop, and explains material choices. Named
workflows (`lazy-ulw-plan`, `lazy-start-work`, `lazy-review-work`,
`lazy-ulw-loop`, `lazy-init-deep`, `lazy-verifier`) remain authoritative;
explicit user requests are never silently downgraded.

### Five modes

The harness selects the lowest mode that satisfies all identified risk,
uncertainty, continuation, and verification requirements.

| Mode | When selected |
| --- | --- |
| `direct` | Localized change, clear acceptance criteria, targeted verification sufficient. |
| `assisted` | Unfamiliar subsystem, cross-file tracing, primarily debugging, bounded implementation. |
| `planned` | Acceptance criteria incomplete, multi-system change, decisions must precede edits. |
| `orchestrated` | Security-sensitive, release/publication, destructive migration, or independent review required. Review responsibilities are automatic; requested approval-class actions still pause. |
| `long-horizon` | Multi-session work, durable checkpoints, bounded continuation loop. |

### Automatic selection and explicit override

For an ordinary outcome request the classifier evaluates an ordered
seven-step policy (explicit user workflow → compatible continuation →
long-horizon → high-risk or multi-system → broad or ambiguous → unfamiliar or
diagnostic → small and clear) and selects the first match. An explicit named
workflow always wins; the classifier may only add required verification or
approval boundaries.

### Bounded escalation and capability fallback

Verification failure adds a debugging stage. A broader-scope failure may
escalate the mode by one level. No more than two automatic depth escalations
are permitted per decision; further failure produces a blocked-state record
with reproduced failure, attempted approaches, current evidence, and the exact
next user decision required. When a preferred capability is unavailable, the
harness selects a safe fallback in the same capability class, reports the
substitution, and weakens verification claims when the fallback is weaker — it
never claims equivalent evidence.

### Adaptive snapshot

When an active loop exists, the harness writes one additive, optional,
camelCase `adaptive` block without a translation layer. Its exact 20 fields are
`version`, `decisionId`, `requestDigest`, `mode`, `stages`, `currentStage`,
`responsibilities`, `capabilityClasses`, `capabilitySubstitutions`, `approval`,
`escalationCount`, `escalationHistory`, `revisionFingerprint`,
`scopeFingerprint`, `hostFingerprint`, `risk`, `reasons`, `blocker`,
`nextAction`, and `verificationLevel`. The adaptive runtime is the single
writer; existing prior-version state without the block continues to load.

### Authority

Read-only and package-owned capabilities activate automatically. Installing a
dependency, persisting a provider beyond the task, modifying host or marketplace
settings, changing MCP registrations, using credentials, using a paid service,
sending repository data to a remote provider, or controlling a browser surface
all require approval. Quality, release, and security review responsibilities
run automatically. Approval follows the requested action class, not the
selected workflow mode or review responsibility.

### Historical v1.0.3 policy behavior

Current package tests enforce that `investigate why` selects
`assisted`; broad validation refactors select `planned`; work explicitly
spanning the next week selects `long-horizon`; and concrete credential changes
or Git pushes require approval. These current package checks do not replace a
fresh host observation; an unobserved Trae host remains **HOST READINESS:
PENDING**.

### Contract reference

The behavior-only contract is shared byte-identically with LazyBuddy at
[`lazytrae-plugin/packages/cli/contracts/adaptive-harness-contract.v1.json`](lazytrae-plugin/packages/cli/contracts/adaptive-harness-contract.v1.json),
paired with its JSON Schema and sha256 digest. Fixtures live under
`lazytrae-plugin/packages/cli/contracts/fixtures/v103/`. The full contract
semantics, authority levels, fallback rules, evidence labels, and known v1.0.3
gaps are documented in
[`docs/v1.0.3-adaptive-harness-contract.md`](docs/v1.0.3-adaptive-harness-contract.md).

## Design mindset

LazyTrae treats a task as an evidence problem: define the observable outcome,
keep authority with the host and user, choose local tools before heavier
providers, and exercise the surface the user actually cares about. A passing
unit test is useful evidence, not automatically proof of a CLI, page, API, or
host integration.

The package keeps `.trae/` and `.lazytrae/` project assets separate from host
settings, credentials, marketplace state, and live sessions. It does not turn
a package readiness result into a claim about a running Trae host.

## Install and onboard

Prerequisites are **Node.js LTS 20 or newer** and **Git**. Bootstrap only from
the verified official origin, `https://github.com/elvinzhao10/LazyTrae.git`
(the `.git` suffix is optional). A checkout is transport for the first command,
not the installed runtime and not host evidence.

Run the source checkout's v1.1.0 entrypoint once to create the durable
installation. Replace the two absolute placeholders; do not use a temporary
install root:

```bash
node "<verified-source-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js" \
  lifecycle onboard \
  --source https://github.com/elvinzhao10/LazyTrae \
  --install-root "<absolute-install-root>" \
  --project "<absolute-project-root>" \
  --json
```

The default `<install-root>` is `~/Library/Application Support/LazySeries` on
macOS, `${XDG_DATA_HOME:-~/.local/share}/lazyseries` on Linux, and
`%LOCALAPPDATA%\LazySeries` on Windows. An explicit root must be absolute,
non-root, durable, and outside a disposable download or cache directory.
After onboarding, use only the stable launcher:

```bash
node "<install-root>/LazyTrae/launcher.js" lifecycle status \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" \
  init --host ide
```

The original checkout may then be deleted. The durable release continues to
work because `launcher.js` dispatches through `active.json` to a verified,
commit-addressed bundle under `releases/`.

```text
<install-root>/
└── LazyTrae/
    ├── active.json
    ├── launcher.js
    ├── releases/<version>-<12-char-commit>/
    ├── receipts/<receipt-id>.json
    ├── rollback/                 # at most one verified prior release
    ├── staging/                  # empty outside a transaction
    └── locks/                    # empty outside a transaction
```

The lifecycle accepts only the official HTTPS GitHub repository, its optional
`.git` form, or an official `/tree/<ref>` URL. It disables credential helpers
and redirects, resolves the selected ref to a full 40-character commit SHA,
checks the v1.0.3 manifests and lifecycle contract digests, runs the staged
self-test, and only then promotes the release. A moved same-version ref is not
silently trusted: `lifecycle update` exits with the resolved SHA and must be
re-run with `--confirm-revision <full-sha>`.

If lifecycle state collides with an existing path or an interrupted operation,
the caller workspace is preserved. `lifecycle recover-bootstrap-lock` is
limited to an explicitly verified lifecycle-owned sibling bootstrap lock or
product `staging/`/`locks/` artifact and requires `--yes`; it never authorizes
removal or replacement of caller workspace files.

### Upgrade from v1.0.2

Use `lifecycle onboard` to create the v1.1.0 durable root, then run the stable
launcher with `doctor`, `load-check`, and `init`/`sync`. Only managed project
assets are replaced; modified or unknown files are preserved. See the
[v1.1.0 migration guide](docs/v1.1.0-migration-guide.md) for recovery,
rollback-retention, runtime-refresh, and scoped-offboard rules.

The agent first detects or asks for **Trae IDE**, **Trae Work**, or **Trae CLI**,
then runs only safe package checks and project-local setup from the durable
launcher. Package readiness is reported separately from host
readiness:

```bash
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" \
  init --host ide
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" \
  load-check --host ide
```

Before copying Trae Work Skills, adding a Settings → MCP connector, or
registering Trae CLI, the agent asks for approval. After approval it gives one
exact host action and waits. Once you respond, it inspects the app with
Computer Use; any reload/new-session step is a separate one-action handoff.
If Computer Use is unavailable, a user-pasted verbatim status or screenshot is
acceptable observed evidence; without either form of observation, **HOST
READINESS: PENDING**.
Host readiness is complete only after one real Skill/command and every expected
`lazytrae` core MCP connection are observed. Local checks alone leave host
readiness **pending**.

The durable launcher and generated files are the **documented package
route**. The supplied macOS IDE/Work results are an **observed prerelease
route**, not a universal host guarantee. Trae CLI receives paste-ready MCP JSON
and a manual settings handoff because no public universal MCP registration
command is assumed. For Work, run the absolute local launcher with `load-check
--host work`; for CLI, use `load-check --host cli`. Copy only the JSON between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. Paste it in Work's
**Settings → MCP** or the selected CLI build's documented/manual MCP settings
flow only after approval. Paste, reload/new session, and live test remain
separate one-action handoffs. Until then, **HOST READINESS: PENDING**.
The supplied QA could not access Trae CLI, so its live-host route remains
explicitly unverified.

See [AGENTS.md](AGENTS.md) for the host-specific artifact boundary and manual
steps. The source is available at the [LazyTrae repository](https://github.com/elvinzhao10/LazyTrae),
with v1.1.0 release boundaries in [RELEASE_NOTES-v1.1.0.md](RELEASE_NOTES-v1.1.0.md).

## Verify and remove

The stable launcher with `load-check --host ide` reports **package readiness**
only. `lifecycle status` never upgrades host readiness from files or local
checks; without a current user-supplied or Computer Use observation, **HOST
READINESS: PENDING**.

`lifecycle offboard` first prints a non-mutating plan and exits for
confirmation. Re-run with `--yes` only after reviewing the exact product root.
It removes only receipt-owned LazyTrae state, refuses modified or unknown
content, and preserves the caller workspace, other LazySeries products, and
host settings. `lifecycle recover-bootstrap-lock` may address only an
explicitly verified lifecycle-owned sibling bootstrap lock or product
`staging/`/`locks/` artifact, and requires `--yes` after that verification.
Remove the host registration separately through the selected host, one approved
GUI action at a time.

The distributable is a **self-contained CLI tarball**: after installation it
does not require a source checkout. See
[lazytrae-plugin/README.md](lazytrae-plugin/README.md) for package commands
and optional tooling lifecycle details.

## Package inventory

| Surface | Count | Role |
| --- | ---: | --- |
| CLI | 17 | Command modules for installation, state, verification, tooling, and lifecycle actions. |
| Skills | 17 | Host-facing workflow policies copied from canonical templates. |
| MCP declarations | 8 | One executable core server and seven disabled placeholders. |

## Technical reference and evaluation

The source-level explanation lives in [docs/README.md](docs/README.md). It
maps template installation, managed writes, state validation, the CLI/MCP
boundary, tooling ownership, and the release checks with diagrams tied to the
implementation.

For a capability-by-capability comparison with the original reference harness,
including what LazyTrae implements and where it intentionally differs, see
[lazytrae-evaluation.md](lazytrae-evaluation.md). Attribution and provenance
are recorded in [NOTICE](NOTICE); this is an independent implementation with
no external harness runtime dependency.

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for attribution and provenance.

## Contributing

Issues and focused pull requests are welcome:

1. Search [existing issues](https://github.com/elvinzhao10/LazyTrae/issues) and
   open one for substantial behavior changes or reproducible bugs.
2. Fork the repository, create a short-lived branch from `main`, and make one
   focused change.
3. Run `npm ci --ignore-scripts`, `npm test`, `npm run test:publication`, and
   `npm pack --dry-run --json` from `lazytrae-plugin/packages/cli`.
4. Update user-facing documentation when behavior changes, then open a pull
   request explaining the outcome, compatibility impact, and verification.
5. Respond to review and wait for required checks before merge.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the complete workflow. Report
vulnerabilities privately according to [SECURITY.md](SECURITY.md), never in a
public issue.
