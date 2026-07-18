<!-- lazytrae:managed:start:onboarding -->
# AGENTS.md — LazyTrae setup guide

> **Agent:** use this guide to install, verify, and safely remove LazyTrae.
> For everyday workflow use, see the [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme).

LazyTrae supports **Trae IDE**, **Trae Work**, and **Trae CLI**. The
release-owned local launcher supplies the portable installer, verification
gate, and local MCP server. This setup is verified on macOS only.

The current package version is `1.0.2`.

Automatic local capability selection is temporary and receipt-owned. It may
use `rg`, `sg`, or the read-only LSP bridge for a task, but it never changes a
project MCP file, host configuration, dependencies, or lockfile. CodeGraph is
for explicit architecture/dependency work and requires
`__LAZYTRAE_LOCAL_COMMAND__ tooling codegraph-init`; Context7, `grep_app`, filesystem, and
Playwright remain optional. Do not use `tooling enable` during onboarding,
offboarding, InitDeep, or doctor.

## `onboard` protocol

When the user types `onboard`:

1. Ask which installed host they use: **Trae IDE**, **Trae Work**, or **Trae CLI**.
2. Follow only that host route. Run `__LAZYTRAE_LOCAL_COMMAND__ init --host ide|work|cli`; for Trae Work, the `--host work` route invokes the bounded Work skill installation, then run `__LAZYTRAE_LOCAL_COMMAND__ work status`.
3. If the release-owned launcher is absent, do not fall back to a PATH lookup. Restore the permanent release or use the repo-only source checkout route below.
4. Report each action and the final **package readiness** result: it is not host discovery, MCP connection, or a running session.
5. Stop before marketplace, account, model, or app-setting changes. Give exact manual directions for host registration. Never enable optional tooling or providers during onboarding.

## `offboard` protocol

When the user types `offboard`:

1. Ask which selected host is being removed: **Trae IDE**, **Trae Work**, or **Trae CLI**. Inspect the project receipt and requested uninstall scope first.
2. Run only the safe local package action selected by the user: `__LAZYTRAE_LOCAL_COMMAND__ uninstall --yes`, `--soft`, or `--purge-state`. Do not combine `--soft` and `--purge-state`, use `tooling enable`, or guess a tooling, host, or global path.
3. Preserve modified, unknown, user-owned, linked, caller-owned, and host-managed assets. Report retained assets instead of deleting around them.
4. For **Trae Work on macOS**, use `__LAZYTRAE_LOCAL_COMMAND__ work uninstall`; it removes only unmodified LazyTrae skills. For a non-macOS location, require an explicitly host-reported `--skills-dir` value.
5. Give the remaining manual host step: remove the release-owned LazyTrae server in **Trae Work Settings → MCP**; remove the Trae CLI registration with `trae-cli mcp remove lazytrae`; for Trae IDE, remove or confirm the project MCP declaration through the IDE after package uninstall.
6. Report package removal separately from the user's observed host/plugin/MCP result. Never claim host removal without that observation.

## Select the host route

| Host | Skills and project assets | MCP step |
| --- | --- | --- |
| **Trae IDE** | Project `.trae/` skills, commands, rules, agents, hooks, and `.lazytrae/` state. | `.trae/mcp.json` declares the server; reopen and observe connection. |
| **Trae Work** | The local launcher's `work install` copies 17 skills to `~/.trae-cn/skills/` on macOS. | Use the exact local command and args from `.trae/mcp.json` in **Settings → MCP**. |
| **Trae CLI** | Local project configuration plus CLI verification gates. | Register before a new session with `trae-cli mcp add-json`. |

## Install

**AI onboarding:** open a copied repository in the selected Trae host and type
`onboard`.

**Permanent local release (primary):**

```bash
git clone https://github.com/elvinzhao10/LazyTrae.git
cd /path/to/your/project
__LAZYTRAE_LOCAL_COMMAND__ init --host ide
__LAZYTRAE_LOCAL_COMMAND__ load-check --host ide
```

Do not run `npm` or `npx` merely to inspect workflow files. The separate
release-owned launcher is needed for its installer, verification gate, and
local MCP server. Its self-contained installed package does not require a source
checkout after installation.

An optional global install may provide the secondary shorthands `lazytrae init --host ide|work|cli`, `lazytrae work install`, and `lazytrae work status`, but generated declarations, hooks, and guidance never depend on that PATH entry.

**Repo-only project configuration (no companion command):**

```bash
node /path/to/LazyTrae/lazytrae-plugin/packages/cli/src/index.js init --host ide
```

This fallback copies `.trae/` and `.lazytrae/` without creating a global
`lazytrae` executable. The generated MCP declaration points back to that
permanent source checkout and remains valid while the checkout stays put.

## Trae Work

On macOS, `__LAZYTRAE_LOCAL_COMMAND__ init --host work` installs the 17 global
skills; confirm them with `__LAZYTRAE_LOCAL_COMMAND__ work status`. Restart or
reload Trae Work, then add the server manually in **Settings → MCP** using the
exact `command` and `args` under `mcpServers.lazytrae` in `.trae/mcp.json`.
Work does not auto-load that project file and has no global command registry.
Linux and Windows locations and host behaviour are unverified; use
`--skills-dir` only with a directory reported by the host.

## Trae CLI

```bash
__LAZYTRAE_LOCAL_COMMAND__ init --host cli
# Register the exact local command and args reported by load-check:
__LAZYTRAE_LOCAL_COMMAND__ load-check --host cli
trae-cli
```

Start the session only after registration. Run `__LAZYTRAE_LOCAL_COMMAND__
verify --must-pass` before reporting a task complete.

## Verify and understand the MCP boundary

```bash
__LAZYTRAE_LOCAL_COMMAND__ doctor
__LAZYTRAE_LOCAL_COMMAND__ load-check --host ide
__LAZYTRAE_LOCAL_COMMAND__ tooling capability-status --json
```

These read-only reports cover copied assets and declarations. The installed
layout contains 17 skills, 9 commands, 11 agents, eight hook scripts across
five events, and eight MCP declarations: one executable core server plus seven
disabled placeholders. The core server exposes 15 tools only after a host
connection.

## Removal reference

```bash
__LAZYTRAE_LOCAL_COMMAND__ uninstall --yes
__LAZYTRAE_LOCAL_COMMAND__ uninstall --yes --soft
__LAZYTRAE_LOCAL_COMMAND__ uninstall --yes --purge-state
__LAZYTRAE_LOCAL_COMMAND__ work uninstall
```

These commands remove exact owned assets only and never remove host MCP
registration. Use the `offboard` protocol above for the manual host step.

## Reference

- Everyday workflows: [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme)
- Package overview: [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme)
- Public verification evidence: [LazyTrae evaluation](https://github.com/elvinzhao10/LazyTrae/blob/main/lazytrae-evaluation.md)
<!-- lazytrae:managed:end:onboarding -->
