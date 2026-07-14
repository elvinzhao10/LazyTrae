# LazyTrae v0.17 Alignment Candidate Evidence

> Published package baseline: v0.16.0-alpha.1. The v0.17 candidate is not a
> separate published package version until a release-version bump is made.

> Current release evidence, not a historical parity score or a certification of a Trae host session.

## What is implemented and checked

The v0.16.0-alpha.1 package contains 17 skills, 9 commands, 11 agent definitions, 8 hook scripts across 5 configured events, and 8 MCP declarations: one executable `lazytrae` core server plus seven disabled placeholders. The local core server exposes 15 tools after connection. Context7, `grep_app`, filesystem, and Playwright are not provisioned by default. An explicit `lazytrae tooling enable <capability>` request is required only to persist a namespaced `lazytrae_*` MCP server selection. The installer keeps its canonical project data under `.trae/` and `.lazytrae/`; it does not require a legacy runtime directory to operate.

The release adds a package-owned tooling contract, provider adapters, and a
task-scoped broker. It detects existing compatible `rg` and `sg` providers
before provisioning pinned local fallbacks in a private receipt-owned toolpack,
supports separate read-only TypeScript/JavaScript and Python LSP providers, and
discovers repository-native lint/typecheck/test/build commands without running
them unless selected. Automatic activation is temporary: it does not change
project MCP configuration, project tooling state, dependencies, lockfiles, or
host settings. Provider selection reports redacted setup/status information;
credentials are opaque references, not stored values. Metered calls need an
explicit bounded budget. CodeGraph and Playwright need approval, and browser
authentication, forms, external writes, purchases, destructive actions, and
secret reads always need approval. CodeGraph never claims or removes the
caller-owned project index.

The older `lazytrae tooling enable <capability>` path remains only as explicit
persistent compatibility: it may add a namespaced `lazytrae_*` MCP entry after
an operator chooses it. Onboarding and InitDeep install package-owned skills,
commands, rules, hooks, agents, schemas, and the one core MCP declaration, but
never use that persistent path. `setup`, `providers`, `providers configure`,
and `providers test` expose provider readiness without secret disclosure.

The release checks exercise the source-local CLI and package artifacts:

- `npm ci --ignore-scripts` and `npm test` in the CLI and MCP packages. The CLI suite covers template parity, source/packaged MCP equivalence, a fresh `init`/`load-check`/`doctor` fixture, tooling lifecycle paths, namespace migration, path-boundary cases, and safe uninstall lifecycle cases.
- `lazytrae load-check --host ide|work|cli` for copied-file and declaration readiness.
- `lazytrae uninstall --yes`, `--soft`, and `--purge-state` lifecycle coverage. Removal is content-checked: modified or unknown files and normal runtime records are preserved. Receipt-owned toolpacks and policy artifacts are removed only through their exact lifecycle commands; project uninstall never guesses host paths or deletes caller-owned indexes.
- `lazytrae work install`, `status`, and `uninstall` coverage with an explicit skills directory. Work uninstall removes only exact, unmodified LazyTrae skills and rejects symlink or hard-link traversal.

These are implementation and package-readiness checks. They do not show that an IDE or CLI host discovered configuration, invoked a hook, loaded a plugin, or connected the MCP process.

## Host-compatibility boundary

| Surface | Current evidence | Required manual observation |
| --- | --- | --- |
| Trae IDE | Project files and declarations are generated and checked. | Reopen the project; verify discovery and the MCP connection in the IDE. |
| Trae Work on macOS | The CLI's default global-skills target is `~/.trae-cn/skills/`; file-copy, status, and bounded removal behavior are checked. | Restart/reload Trae Work, confirm skill discovery, and add/confirm `lazytrae mcp` in **Settings → MCP**. |
| Trae Work on Linux or Windows | No default location or live-host behavior is verified. | Obtain the host-reported directory, pass it with `--skills-dir`, and verify the session manually. |
| Trae CLI | Project configuration and the registration command are documented. | Run `trae-cli mcp add-json ...`, start a new session, and observe the connection. |

The 15-tool count applies only after the local MCP server connects. Package readiness alone is not an MCP connection test.

## Safe removal contract

`lazytrae uninstall --yes` removes only exact bundled project assets. `--soft` limits removal to verified `.trae/` assets; `--purge-state` also removes only exact runtime templates, and the two options cannot be combined. The command does not change host MCP registration. On macOS, `lazytrae work uninstall` removes only exact, unmodified installed skills. Remove host MCP registrations separately; for non-macOS paths, use an explicitly confirmed `--skills-dir` value.

## Public capability status contract

`tooling capability-status --json`, `load-check`, and `doctor` report canonical
package readiness without enabling, installing, or registering a capability.
The records distinguish package data and observed local state from a host
session; they are evidence for a copied package, not a claim that Trae loaded it.

## Optional capability policy

Optional Context7, `grep_app`, filesystem, Playwright, LSP, and CodeGraph
paths remain disabled or inactive until an operator makes the documented
explicit request. Status and readiness commands are read-only. Approval,
budget, egress, and host-UI merge decisions remain separate from package
verification.

## Receipt and safe removal

Receipt ownership is the boundary for managed tooling removal. Modified,
foreign, linked, caller-owned, project, and host-managed paths are preserved;
the host's MCP registration is removed manually through the host.

## Package readiness versus host verification

Package readiness checks copied files, declarations, and local contracts. It
does not prove discovery, hook execution, a running session, or an MCP
connection; those require manual observation in the selected Trae host.

## JSON-RPC resilience

The packaged stdio server is checked for JSON-RPC request handling and stdout
protocol discipline. That package-level check does not prove that a host has
started, connected, or exercised the server.

## Host-specific exclusions

- **Host integration:** Trae IDE, Work, and CLI each require their documented
  reopen, reload, registration, or new-session observation.
- **State/path:** project assets use `.trae/` and `.lazytrae/`; the verified
  Trae Work skills location is macOS `~/.trae-cn/skills/`.
- **Inventory:** LazyTrae declares eight MCP entries, with one executable core
  server and seven disabled placeholders; filesystem and Playwright are not
  enabled by the base package.

## Known unverified host behavior

Live host discovery, hook execution, marketplace behavior, and MCP connection
remain unverified until observed in the chosen host. Linux and Windows Trae
Work locations are not asserted by this release.

## macOS verification scope

This release is verified on macOS only. Normal CI does not require a sibling
repository; release-only paired parity uses explicitly supplied sibling roots
as evidence and never becomes a runtime or install dependency.

## Attribution and limits

LazyTrae's attribution and license are recorded exclusively in the repository [NOTICE](NOTICE) and [LICENSE](LICENSE). This document intentionally replaces historical percentage claims with observable v0.16.0-alpha.1 package evidence. It makes no claim of Linux or Windows verification and no claim that a live Trae host session has been exercised.
