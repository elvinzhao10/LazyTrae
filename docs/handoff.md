# LazyTrae documentation handoff

## Purpose

The root `docs/` directory intentionally contains only this handoff. Put
private historical and working material in ignored `dev/docs/root/`; it may
describe superseded workflows, assumptions, or release states and must not be
presented as current behavior without verification against source and tests.
Do not add another tracked root documentation guide without replacing this
handoff arrangement deliberately.

## Current release state

This repository carries a **v0.17 alignment candidate**. Published package
manifests remain **v0.16.0-alpha.1** until a separate release-version bump is
made. Package validation is verified on macOS only. The local foundation selects `rg` for
text/file search, `sg` for structural search, the separate read-only LSP MCP
for supported JavaScript/TypeScript and Python semantic navigation, and
repository-native verification only when the caller explicitly runs a declared
check. CodeGraph is a separate, explicit architecture/dependency MCP: it
requires a receipt-owned tooling root and the caller-selected
`lazytrae tooling codegraph-init` project-index step. The automatic capability
broker is temporary and never writes host MCP configuration, project tooling
state, dependencies, or lockfiles. `lazytrae tooling enable <capability>` is
the separate explicit persistent compatibility command; onboarding and InitDeep
do not invoke it. `setup` and `providers` show redacted metadata and opaque
credential references only. Document approval, budget, egress, CodeGraph, and
Playwright boundaries accurately: CodeGraph/Playwright require approval, and
authenticated browser work, forms, external writes, purchases, destructive
actions, and secret reads always require approval. Do not document any optional
capability as a required install dependency or as verified on a non-macOS host.

## Repository map

| Area | Responsibility |
| --- | --- |
| `lazytrae-plugin/packages/cli/` | The distributable `lazytrae` CLI, templates, install/sync/doctor/verify/uninstall commands, and CLI tests. |
| `lazytrae-plugin/packages/mcp/` | The standalone MCP server source and its tests. |
| `lazytrae-plugin/packages/cli/src/mcp/` | The packaged CLI mirror of the MCP implementation; keep it aligned with `packages/mcp/`. |
| `lazytrae-plugin/.trae/` | Repository development configuration used to exercise the harness. |
| `lazytrae-plugin/packages/cli/templates/` | Files copied into user projects by `lazytrae init`; they must be self-contained. |
| `docs/` | This tracked handoff only. |
| `dev/` | Ignored personal working material, including legacy root docs. It is never a package, runtime, test, or installation input. |

## Documentation rules

1. Verify a claim against the CLI/MCP source and its tests before documenting it.
2. Keep package instructions self-contained: do not direct installed users or
   package code to repository-root `docs/` or `dev/`.
3. Document only macOS as verified. Describe other host operating systems as
   unverified unless new evidence is added.
4. Preserve the distinction between package readiness checks and live host MCP
   registration or connection checks.
5. When source and template behavior differ, treat that as a defect to resolve
   before publishing guidance.

## Useful validation entry points

Run commands from `lazytrae-plugin/packages/cli/` unless a command says
otherwise:

```bash
npm test
node src/index.js --help
node src/index.js doctor
node src/index.js verify
node src/index.js tooling --help
node src/index.js setup --non-interactive --json
node src/index.js providers --json
```

The package README and `AGENTS.md` remain the concise current starting points.
Do not restore the ignored legacy tree as a dependency of these commands.

## Public capability status contract

Document `tooling capability-status --json`, `load-check`, and `doctor` as
read-only reports of canonical package capability status. They report package
and local evidence only; they do not install, enable, register, or prove a
host capability.

## Optional capability policy

Keep Context7, `grep_app`, filesystem, Playwright, LSP, and CodeGraph language
explicit: optional paths stay inactive until the operator requests their
documented lifecycle. Never turn a readiness report into an activation,
approval, credential, budget, egress, or host-merge claim.

## Receipt and safe removal

Describe tooling removal as receipt-bound. Exact owned roots may be removed;
modified, foreign, linked, project, caller-owned, and host-managed paths stay
preserved, and host MCP entries are removed manually through the host.

## Package readiness versus host verification

Use **package readiness** only for copied files, declarations, and local
contracts. It does not prove host discovery, hook execution, a live session,
or MCP connection; the user observes those separately in Trae.

## JSON-RPC resilience

The packaged stdio server has package-level JSON-RPC resilience coverage.
Document that as protocol evidence, never as proof that a Trae host started or
connected the server.

## Host-specific exclusions

- **Host integration:** IDE reopen, Work reload and Settings registration, and
  CLI new-session observation are host actions.
- **State/path:** project configuration is `.trae/` and `.lazytrae/`; the
  verified Work skills destination is macOS `~/.trae-cn/skills/`.
- **Inventory:** eight MCP declarations contain one executable core server and
  seven disabled placeholders; filesystem and Playwright remain excluded from
  the base activation set.

## Known unverified host behavior

Do not claim live host discovery, hook execution, marketplace behavior, or MCP
connection. Trae Work locations and behavior outside macOS are unverified.

## macOS verification scope

The documentation describes macOS only as verified. Normal CI does not require a sibling repository; release-only paired parity takes explicit sibling roots for release evidence and never creates a runtime or installation dependency.
