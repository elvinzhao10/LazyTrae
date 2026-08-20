# LazyTrae plugin

## Durable v1.0.3 installation

**Node.js LTS 20 or newer** and **Git** are required. Run `lifecycle onboard`
only from `https://github.com/elvinzhao10/LazyTrae.git`, then use
`node "<install-root>/LazyTrae/launcher.js"` for `lifecycle update`,
`lifecycle status`, plan-first `lifecycle offboard`, and project commands.
The exact durable tree is
`LazyTrae/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`;
the bootstrap checkout may be deleted. A moved same-version tag requires
`--confirm-revision <full-sha>`, and a stale Node runtime requires scoped
offboard/re-onboard rather than receipt edits. Package readiness never implies
a live host: **HOST READINESS: PENDING** without current observation.

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

Bootstrap v1.0.3 once from a verified official source checkout, then use the
durable launcher rather than treating that checkout as the installed runtime:

```bash
node "<verified-source-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js" \
  lifecycle onboard --source https://github.com/elvinzhao10/LazyTrae \
  --install-root "<absolute-install-root>" --project "<absolute-project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle status \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" init --host ide
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" load-check --host ide
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" doctor
```

The source checkout is transport only and may be removed after promotion. The
durable install root must be absolute, non-root, and outside disposable
downloads or caches; the launcher does not depend on PATH or a global npm
install.

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

Remove only receipt-owned package assets through the durable launcher. Start
with the non-mutating lifecycle plan, then confirm only the exact product root:

```bash
node "<install-root>/LazyTrae/launcher.js" lifecycle offboard \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle offboard \
  --install-root "<install-root>" --project "<project-root>" --yes --json
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" uninstall --yes
```

These commands preserve modified, unknown, caller-owned, linked, and
host-managed paths. Remove MCP registrations manually: Work through **Settings
→ MCP**, CLI through the selected build's documented MCP settings flow, and IDE
through its project MCP UI. Never assume a universal CLI command or guess a
host-managed location. If recovery is needed, only an explicitly verified
lifecycle-owned sibling bootstrap lock or product `staging/`/`locks/` artifact
may be recovered; the caller workspace is preserved.

## For package contributors

```bash
cd packages/cli
npm run test:all
node src/index.js --help
```

`npm test` runs the archive-contained package verification suite. `npm run
test:source` runs the complete source-tree suite, and `npm run test:all` runs
both so package contributors do not lose either coverage layer.

For contributors, keep source/template mirrors aligned, preserve receipt
ownership boundaries, and run the CLI suite before changing package behavior.
