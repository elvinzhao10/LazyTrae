# LazyTrae verification evidence

**Current documentation release: v1.2.1.** Historical v1.0.3 evidence below
is retained as historical release evidence; it is not a current writer or a
host-readiness claim.

This document records what the public package implements and what its tests
verify. It is evidence for the package and its local CLI/MCP behaviour, not a
claim that a chosen Trae host has already loaded or connected it.

## Project purpose and attribution

LazyTrae is a learning project for evidence-led agent workflows. It is
primarily inspired by LazyCodex
([upstream project](https://github.com/code-yeongyu/lazycodex)). OmO upstream
attribution is recorded in [NOTICE](NOTICE). The package is an independent
implementation and does not require LazyCodex or OmO at runtime.

## Implemented package behavior

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

State-schema validation uses `ajv-formats`, so required RFC3339 `date-time`
fields are enforced rather than silently ignored. Valid nullable lifecycle
timestamps remain valid; malformed or impossible timestamps fail local state
validation. This is state-schema evidence, not proof that a host read the
state.

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

The self-contained CLI tarball is checked by a cold offline installation and
an isolated stdio MCP probe that lists the core server's 15 tools. The artifact
contains the CLI, local MCP implementation, templates, package-local `LICENSE`
and `NOTICE`, and its production dependency closure; this remains package
evidence rather than host integration evidence. The local macOS CI readiness
workflow runs installation, the test suite, and package inspection; it does not publish, tag, or modify a remote.

`lazytrae uninstall --yes`, `--soft`, and `--purge-state` are content-checked:
modified or unknown files and normal runtime records remain preserved. Toolpacks
and policy artifacts are removed only through their exact receipt lifecycle.
Project uninstall does not guess host paths, delete caller-owned CodeGraph
indexes, or remove a host MCP registration.

## Host observation required

| Surface | Package evidence | User observation still required |
| --- | --- | --- |
| TraeCode | Project files and MCP declaration are generated and checked; an optional probe is bounded. | Reopen the project and observe discovery and MCP connection. |
| TraeWork | The `--client` and `--execution` profile is explicit; only desktop/local can use local skills, a worktree, executable, and bounded probe. | Reload Work, confirm skill discovery, then use its manual MCP setting after approval. Web/mobile/cloud profiles are descriptors only. |
| TraeCode CLI | `.traecli/` candidates are generated receipt-owned configuration. | A candidate remains inert until an exact probe proves a structured runner for the current session/worktree; use the selected build's documented/manual settings flow separately. |

The active readiness and host-adapter writers emit v2 records. v1 receipts are
read-only compatibility inputs. The generator, profile, and probe are separate
evidence modes: none discovers a host, registers a connector, uploads data,
installs or publishes a marketplace package, or turns package readiness into
host readiness.

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

Timeout handling for trusted package-owned tooling requests best-effort
termination of an owned process group. It is cleanup rather than a security
sandbox, and does not guarantee termination of every descendant process.

## Package readiness versus host verification

Package readiness checks copied files, declarations, and local contracts. It
does not prove discovery, hook execution, a running session, or MCP connection;
those require observation in the selected Trae host.

## JSON-RPC resilience

The packaged stdio server is tested for structured JSON-RPC request handling
and stdout protocol discipline. That does not prove a host started, connected,
or exercised the server.

## Host-specific exclusions

- **Host integration:** TraeCode, Work, and CLI need their documented reopen,
  reload, registration, or new-session observation.
- **State/path:** project assets use `.trae/` and `.lazytrae/`; the verified
  TraeWork skills location is macOS `~/.trae-cn/skills/`.
- **Inventory:** eight MCP declarations contain one executable core server and
  seven disabled placeholders; filesystem and Playwright are not base-enabled.

## Known unverified host behavior

Live host discovery, hook execution, marketplace behaviour, and MCP connection
remain unverified until observed in the selected host. Linux and Windows TraeWork locations are not asserted.

## macOS verification scope

LazyTrae is verified on macOS only. Normal CI does not require a sibling
repository; release-only paired parity uses explicitly supplied sibling roots
as evidence and never becomes a runtime or installation dependency.

## Attribution

See [NOTICE](NOTICE) and [LICENSE](LICENSE) for attribution, provenance, and
license terms.

## Learner references

The complete 21-page learning route is [docs/README.md](docs/README.md): follow
[Host routes](docs/reference/host-routes.md), [MCP lifecycle](docs/07b-mcp-lifecycle.md),
and [Test and release verification](docs/09-test-and-release-verification.md)
without treating package evidence as host proof.

## Comparison with the upstream reference harness

The reference named in the attribution above publicly describes project memory,
planning, execution, verified completion, specialized skills, hooks,
diagnostics, and multi-agent roles. This is a capability comparison, not a
claim of API, installer, or runtime compatibility.

| Reference capability family | LazyTrae realization | Deliberate difference or limitation |
| --- | --- | --- |
| Project memory | InitDeep templates, managed project instructions, durable plans, loop state, and schemas. | Project assets are copied into `.trae` and `.lazytrae`; host discovery is observed separately. |
| Planning and durable execution | Plan, start-work, loop, evidence, completion gates, and package-local state validation. | Workflows are adapted to TraeCode, Work, and CLI surfaces rather than Codex command semantics. |
| Specialized roles and review | Packaged skills, commands, agents, hooks, and independent verification guidance. | A role definition is not proof that a selected Trae host loaded or invoked it. |
| Hooks and lifecycle | Canonical hook templates, managed project copies, and protected-write reporting. | Hooks are advisory until a host session loads them; protected host files are preserved and may require manual registration. |
| Local development tooling | Local-first ripgrep, ast-grep, LSP, repository-native verification, and explicit CodeGraph lifecycle. | Context7, grep_app, filesystem, and Playwright remain optional capability paths with explicit approval boundaries. |
| Diagnostics and removal | CLI doctor/load-check, state schemas, receipts, content-checked uninstall, and packaged MCP tests. | Results prove package and local protocol behavior, not a live Trae connection, marketplace behavior, or host hook execution. |
| Installation model | A self-contained CLI and MCP package with project templates and host-specific manual steps. | It intentionally does not reproduce the reference harness's installer, global configuration, model routing, or automatic host mutation. |

The upstream project is an architectural reference. LazyTrae deliberately keeps
the package boundary narrow: it can verify templates, state, and local MCP
behavior, while host-owned settings and live integration remain user-observed.
