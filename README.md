# LazyTrae

![LazyTrae](lazytrae-banner.jpg)

LazyTrae helps you use structured, evidence-based workflows in **Trae IDE**,
**Trae Work**, and **Trae CLI**. It is a local project tool: it can prepare
package-owned files and checks, but it does not claim that a host is connected
until that host is observed in a fresh session.

The current stable release is [v1.1.0](https://github.com/elvinzhao10/LazyTrae/releases/tag/v1.1.0).

## Recommended: install with AI help

You do not need to work through the technical setup alone. Open your preferred
AI coding assistant in the project and paste this:

> Help me install LazyTrae from https://github.com/elvinzhao10/LazyTrae for
> this project. Use the stable v1.1.0 route. Run safe package checks first,
> explain each step plainly, and ask me before changing host settings, adding
> an MCP connector, or registering anything in Trae.

The assistant can guide the onboarding conversation, but you remain in control
of host changes. Accept a host action only when you understand it.

## Manual setup

Manual setup is available if you prefer it. You need **Node.js LTS 20 or
newer** and **Git**. Start from the verified origin
`https://github.com/elvinzhao10/LazyTrae` and follow the concise
[installation guide](docs/03-install-and-host-verification.md).

The guide uses `lifecycle onboard` once to create a durable installation. After
that, use the stable launcher rather than the downloaded source checkout:

```text
node "<install-root>/LazyTrae/launcher.js" lifecycle status
```

## What “ready” means

- **Package readiness** means LazyTrae's local files and checks are in place.
- **Host readiness** needs a fresh Trae session, one real Skill or command,
  and the expected core MCP connection.

Until that is observed, the honest result is **HOST READINESS: PENDING**.
LazyTrae never treats a copied file or a local check as proof that Trae has
loaded it.

## Host choices

Choose one host during onboarding:

- **Trae IDE** uses project assets and an optional bounded probe.
- **Trae Work** supports local desktop work; the other client/execution
  profiles are descriptive only.
- **Trae CLI** can generate a local candidate, but it stays inert until a
  current probe confirms the selected runner.

For manual Work or CLI setup, use `load-check --host work` or
`load-check --host cli`. Copy only the configuration bracketed by
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END` into the documented
manual settings flow, such as **Settings → MCP**. LazyTrae does not assume a public universal MCP registration command.

The generated files are the **documented package route**. Any host-specific
result is an **observed prerelease route**, not a universal host guarantee.
Approval is required before one exact host action, followed by a wait for the
result. If available, Computer Use or a user-provided screenshot/status can
verify a reload or new session.

## Learn more

- [Install and verify a host](docs/03-install-and-host-verification.md)
- [Supported v1.1.0 route](docs/v1.1.0-supported-route.md)
- [Migration and safe removal](docs/v1.1.0-migration-guide.md)
- [Release notes](RELEASE_NOTES-v1.1.0.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

For advanced workflow commands, host details, and the full technical model,
see the [documentation index](docs/README.md).
