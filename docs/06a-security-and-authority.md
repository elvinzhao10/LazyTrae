# Security and authority

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
