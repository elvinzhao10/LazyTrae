# LazyTrae documentation handoff

This is the public learning map for the next person who documents, maintains,
or evaluates LazyTrae. It describes the present repository and points claims
back to the source and tests that prove them.

The current package version is `0.16.0-alpha.1`.

## Learn the repository

Read [README.md](../README.md) for user workflows, then [AGENTS.md](../AGENTS.md)
for safe onboarding and offboarding. Read `lazytrae-plugin/README.md` for the
package boundary. The CLI source and tests live in
`lazytrae-plugin/packages/cli/`; the standalone stdio JSON-RPC server lives in
`lazytrae-plugin/packages/mcp/`; `packages/cli/src/mcp/` is the packaged mirror.

The root `docs/` directory intentionally contains this learning map only.
Public documentation belongs in the README, setup guide, package README, and
evaluation. Keep private notes outside the package and never make them an
installation or runtime dependency.

## Repository boundaries and source of truth

| Area | Responsibility |
| --- | --- |
| `lazytrae-plugin/packages/cli/templates/` | Installation source of truth for files copied into user projects. |
| `lazytrae-plugin/.trae/` | Repository Trae development configuration. |
| `lazytrae-plugin/.lazytrae/` | Repository LazyTrae schemas and configuration. |
| `lazytrae-plugin/packages/cli/` | Distributable `lazytrae` CLI and its tests. |
| `lazytrae-plugin/packages/mcp/` | Standalone MCP server source and tests. |
| `lazytrae-plugin/packages/cli/src/mcp/` | Packaged MCP mirror; keep it aligned with `packages/mcp/`. |

When a template and an installed mirror differ, treat that as a product defect
before changing public guidance. Consumer projects receive `.trae/` and
`.lazytrae/` package assets; plans and loop records are runtime state.

## How the workflow fits together

Skills are playbooks selected from natural language or invoked with `lazy-`
commands. Commands choose planning, execution, review, or durable-loop paths.
The 11 agent roles perform focused work. Trae hooks provide advisory context;
the CLI/MCP completion gate supplies the binding evidence check. The core MCP
server is declared in project configuration and exposes 15 tools only after a
host connects.

InitDeep verifies package-owned skills, commands, agents, hooks, and MCP
declarations. Planning records an approval-ready path. Start-work executes
approved work and records evidence. Review checks significant completed work
independently. Do not document this as proof that a host executed a hook or
connected an MCP server.

## Capability and receipt lifecycle

LazyTrae routes ordinary local work to `rg` for text/file search, `sg` for
structural search, the read-only LSP bridge for supported semantic navigation,
and repository-native lint, typecheck, test, or build commands when a task
selects them. It detects a compatible tool before provisioning a fallback. A
fallback is private and receipt-owned, so automatic routing does not edit
project MCP configuration, dependencies, lockfiles, or host settings.

CodeGraph is for explicit architecture and dependency work. It requires
`lazytrae tooling codegraph-init` and a receipt-owned tooling root; its project
index stays caller-owned. Context7, `grep_app`, filesystem, and Playwright have
explicit capability and approval paths. CodeGraph and Playwright require
approval. Browser authentication, forms, publishing, external writes,
purchases, destructive actions, secret reads, and metered provider use require
their stated approval or budget boundary.

`lazytrae tooling enable <capability>` is the explicit persistent compatibility
path for a namespaced optional MCP selection. Onboarding, InitDeep, doctor, and
automatic routing never invoke it. Receipts are also the removal boundary:
exact package-owned roots can be removed, while modified, linked, foreign,
caller-owned, project, and host-managed paths stay preserved.

## Test map and claim verification

Run commands from `lazytrae-plugin/packages/cli/`:

```bash
node --test test/documentation-regression.test.js test/onboarding-contract.test.js
npm test
node src/index.js --help
```

Use `test/documentation-regression.test.js` for public-documentation claims,
`test/onboarding-contract.test.js` for installed setup guidance, template-parity
tests for copied assets, lifecycle tests for receipt-safe removal, and MCP
tests for protocol behaviour. Use `node src/index.js --help` as a real CLI
surface check. Use `npm test` before handing off a broad change. An installed project uses `load-check` as a package readiness tool; do not run it against this source checkout and treat its result as contributor verification. Host
discovery, Work reload, and MCP connection require actual observation in the
selected host; package tests do not substitute for it.

## Public capability status contract

Document `tooling capability-status --json`, `load-check`, and `doctor` as
read-only reports of package readiness and local evidence. They do not install,
enable, register, or prove a host capability.

## Optional capability policy

Context7, `grep_app`, filesystem, Playwright, LSP, and CodeGraph remain
inactive until their documented lifecycle is selected. Never describe a status
report as activation, approval, credential use, budget approval, egress
permission, or a host-configuration change.

## Receipt and safe removal

Removal is receipt-bound. Exact owned assets may be removed; modified, foreign,
linked, caller-owned, project, and host-managed paths remain. Host MCP entries
are removed manually through the selected host.

## Package readiness versus host verification

Use **package readiness** only for copied files, declarations, and local
contracts. It does not prove host discovery, hook execution, a live session,
or MCP connection; the user observes those separately in Trae.

## JSON-RPC resilience

The packaged stdio server has package-level JSON-RPC resilience coverage.
Document it as protocol evidence, never as proof that a Trae host started or
connected the server.

## Host-specific exclusions

- **Host integration:** Trae IDE reopen, Work reload and Settings registration,
  and CLI new-session observation are host actions.
- **State/path:** project configuration is `.trae/` and `.lazytrae/`; the
  verified Work skills destination is macOS `~/.trae-cn/skills/`.
- **Inventory:** eight MCP declarations contain one executable core server and
  seven disabled placeholders; filesystem and Playwright are excluded from the
  base activation set.

## Known unverified host behavior

Do not claim live host discovery, hook execution, marketplace behaviour, or
MCP connection without observing it. Trae Work locations and behaviour outside
macOS are unverified.

## macOS verification scope

LazyTrae is verified on macOS only. Normal CI does not require a sibling
repository; release-only paired parity takes explicit sibling roots as evidence
and never creates a runtime or installation dependency.
