# LazyTrae verification evidence

This document records what the public package implements and what its tests
verify. It is evidence for the package and its local CLI/MCP behaviour, not a
claim that a chosen Trae host has already loaded or connected it.

The current package version is `0.16.0-alpha.1`.

## Features and verified package behaviour

LazyTrae supplies 17 skills, 9 commands, 11 agent definitions, eight hook
scripts across five events, and eight MCP declarations. One declaration starts
the executable `lazytrae` core server; the other seven are disabled
placeholders. Once a host connects, the core server exposes 15 tools.

The CLI installs and checks canonical project assets in `.trae/` and
`.lazytrae/`, runs doctor and completion-gate checks, launches the local MCP
server, and provides safe lifecycle commands. InitDeep installs or verifies
package-owned skills, commands, agents, hooks, schemas, and the core MCP
declaration. It does not enable remote services or persistent optional MCP
entries.

The tooling broker is local-first. It detects compatible `rg` and `sg` tools
before using pinned receipt-owned fallbacks, provides read-only LSP support for
supported JavaScript/TypeScript and Python projects, and detects
repository-native lint, typecheck, test, and build commands. It does not run a
native check until the task selects it. Automatic selection is temporary and
does not modify project MCP configuration, project tooling state, dependencies,
lockfiles, or host settings.

CodeGraph supports explicit architecture and dependency work after
`lazytrae tooling codegraph-init` and a receipt-owned tooling root. Its project
index remains caller-owned. Context7, `grep_app`, filesystem, and Playwright
are optional capability paths. Provider commands handle redacted metadata and
opaque credential references rather than raw secret values. Metered use needs
an explicit bounded budget; CodeGraph and Playwright need approval; browser
authentication, forms, external writes, purchases, destructive actions, and
secret reads always need approval.

## Verification performed

The CLI and MCP suites cover template parity, source/packaged MCP equivalence,
fresh `init`/`load-check`/`doctor` flows, tooling lifecycle paths, namespace
migration, path boundaries, receipt-safe uninstall, Work skill installation and
removal, and JSON-RPC handling. The Work lifecycle tests use an explicit skills
directory and reject symlink or hard-link traversal.

`lazytrae uninstall --yes`, `--soft`, and `--purge-state` are content-checked:
modified or unknown files and normal runtime records remain preserved. Toolpacks
and policy artifacts are removed only through their exact receipt lifecycle.
Project uninstall does not guess host paths, delete caller-owned CodeGraph
indexes, or remove a host MCP registration.

## Host observation required

| Surface | Package evidence | User observation still required |
| --- | --- | --- |
| Trae IDE | Project files and MCP declaration are generated and checked. | Reopen the project and observe discovery and MCP connection. |
| Trae Work on macOS | The default `~/.trae-cn/skills/` copy, status, and bounded removal paths are checked. | Reload Work, confirm skill discovery, and add or confirm `lazytrae mcp` in **Settings → MCP**. |
| Trae Work on Linux or Windows | No default location or host behaviour is asserted. | Obtain the host-reported directory, pass it with `--skills-dir`, and observe the session. |
| Trae CLI | Project configuration and registration command are covered. | Add the MCP registration, start a new session, and observe the connection. |

## Public capability status contract

`tooling capability-status --json`, `load-check`, and `doctor` report canonical
package readiness and local evidence without enabling, installing, or
registering a capability. They distinguish package state from a host session.

## Optional capability policy

Context7, `grep_app`, filesystem, Playwright, LSP, and CodeGraph remain
disabled or inactive until an operator selects the documented lifecycle. Status
and readiness commands are read-only. Approval, budget, egress, credentials,
and host-UI changes remain separate from package verification.

## Receipt and safe removal

Receipt ownership is the removal boundary. Modified, foreign, linked,
caller-owned, project, and host-managed paths are preserved. The host MCP
registration is removed manually through the host.

## Package readiness versus host verification

Package readiness checks copied files, declarations, and local contracts. It
does not prove discovery, hook execution, a running session, or MCP connection;
those require observation in the selected Trae host.

## JSON-RPC resilience

The packaged stdio server is tested for structured JSON-RPC request handling
and stdout protocol discipline. That does not prove a host started, connected,
or exercised the server.

## Host-specific exclusions

- **Host integration:** Trae IDE, Work, and CLI need their documented reopen,
  reload, registration, or new-session observation.
- **State/path:** project assets use `.trae/` and `.lazytrae/`; the verified
  Trae Work skills location is macOS `~/.trae-cn/skills/`.
- **Inventory:** eight MCP declarations contain one executable core server and
  seven disabled placeholders; filesystem and Playwright are not base-enabled.

## Known unverified host behavior

Live host discovery, hook execution, marketplace behaviour, and MCP connection
remain unverified until observed in the selected host. Linux and Windows Trae
Work locations are not asserted.

## macOS verification scope

LazyTrae is verified on macOS only. Normal CI does not require a sibling
repository; release-only paired parity uses explicitly supplied sibling roots
as evidence and never becomes a runtime or installation dependency.

## Attribution

See [NOTICE](NOTICE) and [LICENSE](LICENSE) for attribution, provenance, and
license terms.
