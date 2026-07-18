# LazyTrae plugin

This is the self-contained distributable package for LazyTrae on Trae IDE,
Trae Work, and Trae CLI. It includes the project configuration, companion CLI,
and local MCP server needed for its package lifecycle.

The package contains Trae configuration, the `lazytrae` CLI, and the local
stdio MCP server. It is verified on macOS only. Package readiness verifies
copied assets and declarations; it does not prove host discovery or an MCP
connection.

The self-contained CLI tarball carries the CLI, local MCP implementation,
templates, package-local `LICENSE` and `NOTICE`, and its production dependency
closure. A cold offline install checks that artifact; it does not prove host
discovery or an MCP connection.

This package is part of the LazyTrae learning project. It is
primarily inspired by LazyCodex; [NOTICE](../NOTICE) records the LazyCodex and
OmO upstream attribution. It is an independent implementation and does not
require LazyCodex or OmO at runtime. For Trae Work, the release-owned
launcher's `init --host work` invokes the bounded Work skill installation; use
the same launcher with `work status` to inspect the copied package assets.

## Layout

| Path | Purpose |
| --- | --- |
| `.trae/` | Trae project configuration: skills, commands, agents, rules, hooks, and MCP declaration. |
| `.lazytrae/` | Versioned schemas and default configuration assets. |
| `packages/cli/` | Installable CLI: installer, doctor, verification gate, lifecycle, tooling, and MCP launcher. |
| `packages/mcp/` | Node stdio implementation for the local core MCP server. |
| `packages/cli/tooling/lsp/` | Locked LSP provider manifests used by the managed LSP lifecycle. |

`packages/cli/templates/` is the source of truth for files copied into consumer
projects. Keep it self-contained and run the CLI test suite after changes.

## Install, verify, and remove

Keep the pinned `v1.0.2` release in a permanent folder, open or link it in the
selected Trae host, give the agent
`https://github.com/elvinzhao10/LazyTrae`, and type `onboard`. The release-owned
launcher is the primary command; it does not depend on PATH or a global npm
install:

```bash
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project init --host ide
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project load-check --host ide
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project doctor
```

The onboarding protocol detects or asks for the host, runs safe package checks,
and reports **package readiness** separately from **host readiness**. Before
copying Trae Work Skills, adding a Settings → MCP connector, or registering
Trae CLI, it asks for approval. It then gives one exact host action and waits;
after the user responds it inspects the app with Computer Use. Reload/new
session is a separate action. Host readiness requires one real Skill/command
and the expected `lazytrae` core MCP connection; local checks alone leave it
pending. Work's default Skills location is verified only on macOS
(`~/.trae-cn/skills/`), and its connector remains manual.

Availability labels are evidence boundaries: the release launcher and
generated configuration are the **documented package route**; supplied macOS
IDE/Work observations are an **observed prerelease route**; and the current
surface remains **HOST READINESS: PENDING** until observed. For Work, run the
absolute local launcher with `load-check --host work`; for CLI, use
`load-check --host cli`. Copy only the JSON between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. Paste it into Work's
**Settings → MCP** or the selected CLI build's documented/manual MCP settings
flow after approval. No public universal MCP registration command is assumed.
The supplied QA could not access Trae CLI, so its live-host route remains
explicitly unverified.

Automatic local tooling is temporary and receipt-owned: `rg`, `sg`, and the
read-only LSP bridge may be selected for a task without changing host or
project configuration. CodeGraph and remote providers remain explicit optional
lifecycles; onboarding, doctor, and InitDeep do not enable them.

Remove only receipt-owned package assets:

```bash
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project uninstall --yes
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project uninstall --yes --soft
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project uninstall --yes --purge-state
node /permanent/path/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root /absolute/path/to/project work uninstall
```

These commands preserve modified, unknown, caller-owned, linked, and
host-managed paths. Remove MCP registrations manually: Work through **Settings
→ MCP**, CLI through the selected build's documented MCP settings flow, and IDE
through its project MCP UI. Never assume a universal CLI command or guess a
host-managed location.

## For package contributors

```bash
cd packages/cli
npm test
node src/index.js --help
```

For contributors, keep source/template mirrors aligned, preserve receipt
ownership boundaries, and run the CLI suite before changing package behavior.
