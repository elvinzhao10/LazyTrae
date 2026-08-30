# Security and authority

**Current documentation release: v1.2.1.** A host generator, profile, or probe
is local evidence, not authority over a native host.

LazyTrae can inspect local project information, but a package check does not
grant authority to change a host, contact a provider, spend money, or read a
secret. Treat every capability as a separate decision with an observable
result.

## Authority boundaries

Automatic task routing is local-first and temporary: it may use `rg`, `sg`, or
a read-only LSP bridge. It does not edit dependencies, lockfiles,
`.trae/mcp.json`, or host settings. `lazytrae tooling enable <capability>` is a
different, explicit compatibility choice: it writes a managed namespaced MCP
selection. Onboarding, InitDeep, doctor, and automatic routing do not enable
it.

CodeGraph and Playwright require approval. Authenticated browser work, forms,
external writes, purchases, destructive actions, and secret reads require an
operator decision. Metered services also require an explicit bounded budget.
`status`, `doctor`, and readiness commands report state; they do not grant an
approval or start a provider.

## Credentials and untrusted input

Provider configuration keeps credentials as opaque `env:NAME` references, not
raw values in project state, and status output is redacted. Treat provider
output as untrusted; queries are sanitized and bounded. The base MCP file has
one local core server and disabled placeholders, so a declaration is not a
permission to run an external server.

Continue with [Receipts and owned tooling](06b-receipts-and-owned-tooling.md)
for lifecycle ownership, or [MCP lifecycle](07b-mcp-lifecycle.md) for the
connection boundary.

## Enforcement points and deliberate limits

| Boundary | Enforced by | What it deliberately does not claim |
| --- | --- | --- |
| Project write path | `lib/path-boundary` plus `lib/safe-write` | Permission to write arbitrary host or parent paths. |
| Managed documentation/config block | `lib/managed-blocks` | Ownership of text outside the named marker block. |
| State write | MCP `runtime/path-boundary` plus atomic safe write | Permission to mutate files outside `.lazytrae/`. |
| Optional capability credentials | `runOptionalCapability` rejects raw credential arguments | Secure storage of raw secrets in project state. |
| Provider and browser activity | Explicit enable/approval/budget policy | Automatic consent based on package readiness. |

Security is therefore fail-closed at the boundaries the package can model, not a claim that the package can sandbox a host or make arbitrary external code safe. Tests attack the safe-write, managed-content, state, and optional-provider boundaries directly.

## v1.1 native-host restrictions

Work profiles require explicit, independent `--client` and `--execution`
choices. Only desktop/local can use a local worktree, executable, and bounded
host probe; other profiles are descriptor-only. The profile commands reject
upload, account, login, and credential flags. CLI candidate generation writes
only receipt-owned inert `.traecli/` configuration: it neither discovers a
host nor registers, installs, publishes, or executes against one. A bounded
probe runs credential-free introspection and cannot make host readiness ready.

Current writers use v2 readiness records. Historical v1 evidence is accepted
only as read-only compatibility input. Never infer a host capability, cloud
permission, marketplace action, or live session from package-ready files.
