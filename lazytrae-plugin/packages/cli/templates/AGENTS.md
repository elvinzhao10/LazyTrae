<!-- lazytrae:managed:start:onboarding -->
# AGENTS.md — LazyTrae setup guide

> **Agent:** use this guide to install, verify, and safely remove LazyTrae.
> For everyday workflow use, see the [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme).

LazyTrae supports **Trae IDE**, **Trae Work**, and **Trae CLI**. The
release-owned local launcher supplies the portable installer, verification
gate, and local MCP server. This setup is verified on macOS only. The current
package version is `1.0.2`.

## Local-first onboarding (start here)

Keep the pinned `v1.0.2` release in a permanent folder before opening or
linking it in a host. In the selected Trae host, give the agent the GitHub
repository link, `https://github.com/elvinzhao10/LazyTrae`, and type `onboard`.
Do not use a temporary folder or a PATH/global `lazytrae` command.

The release-owned local command is:

```text
__LAZYTRAE_LOCAL_COMMAND__ <command>
```

## `onboard` protocol

When the user types `onboard`:

1. Scan the complete current message and detect the host from the open app. If
   it is not unambiguous, ask one focused question: **Trae IDE**, **Trae Work**,
   or **Trae CLI**. Do not run setup while the host is ambiguous.
2. Confirm that this project is linked to a pinned `v1.0.2` release in a
   permanent location and that `__LAZYTRAE_LOCAL_COMMAND__` still exists. Never
   fall back to `PATH`, `npx`, or a global `lazytrae`.
3. Run only safe package checks and project-local setup through the local
   command: `init --host ide|cli`, `sync`, `load-check --host <host>`, and
   `doctor`. These inspect or write the selected project only. Do not enable
   optional providers or change credentials, dependencies, lockfiles, or host
   settings.
4. For Trae Work, copying Skills to the host directory is a host-managed
   mutation. Run `__LAZYTRAE_LOCAL_COMMAND__ init --host work` only after the
   approval gate below; the package check before approval must remain read-only.
5. Report **package readiness** separately. It covers local files, the
   generated declaration, and local contracts; it never proves host discovery,
   hook execution, a running session, or an MCP connection.
6. Before any host-managed mutation (Work Skills copy, a Settings → MCP entry,
   or Trae CLI registration), ask for explicit approval naming the exact host
   action. Never automate marketplace, account, model, credential, or app
   setting changes.
7. After approval, give exactly **one** concrete GUI/host action and then wait.
   Do not bundle reload, connector setup, and a test into one handoff.
8. After the user responds, inspect the corresponding app with Computer Use.
   Record only what is visibly observed. If the host needs a reload or a new
   session, give that as the next single action, wait again, and inspect again.
9. In the observed session, verify one real LazyTrae Skill or command and every
   expected MCP connection for the selected route. The base package expects one
   `lazytrae` core MCP connection (15 tools after connection); seven optional
   placeholders remain disabled unless separately selected.
10. Report `package readiness` and `host readiness` as separate fields. Without
    the Computer Use observation, host readiness remains **pending** even when
    every local check passes.

## Select the host route

| Host | Skills and project assets | MCP step and expected observation |
| --- | --- | --- |
| **Trae IDE** | Project `.trae/` skills, commands, rules, agents, hooks, and `.lazytrae/` state. | `.trae/mcp.json` is generated with `command: node`, an absolute release-owned launcher, and the project root. Reopen once after approval, then observe one Skill/command and the `lazytrae` core MCP connection. |
| **Trae Work** | `__LAZYTRAE_LOCAL_COMMAND__ init --host work` copies 17 supported Skills to macOS `~/.trae-cn/skills/` (or a host-reported `--skills-dir`). | Add the local `lazytrae` connector manually in **Settings → MCP** using the exact command and args from `.trae/mcp.json`. Reload is a later one-action handoff; observe one imported Skill and the core MCP. |
| **Trae CLI** | Local project configuration plus verification gates. | After approval, register the exact local `node` command with `trae-cli mcp add-json`, start one new session as a later action, and observe one command plus the core MCP. |

Trae Work does not auto-load the project MCP file. Linux and Windows Work
locations and behavior are unverified; ask the host for its directory before
using `--skills-dir`. A declaration or load-check is package evidence until the
selected host visibly connects it.

## Install from a permanent release

The primary route uses the checked-out release-owned launcher and does not require a source checkout after installation:

```bash
__LAZYTRAE_LOCAL_COMMAND__ init --host ide
__LAZYTRAE_LOCAL_COMMAND__ load-check --host ide
```

An optional global install may provide secondary `lazytrae` shorthand, but
generated declarations, hooks, and guidance never depend on that PATH entry.

If the companion command is unavailable, this repo-only fallback is still
local and explicit:

```bash
node /path/to/LazyTrae/lazytrae-plugin/packages/cli/src/index.js init --host ide
```

It copies `.trae/` and `.lazytrae/` but does not create a global executable;
the generated MCP declaration remains tied to the permanent source checkout.

## Verify and remove

```bash
__LAZYTRAE_LOCAL_COMMAND__ doctor
__LAZYTRAE_LOCAL_COMMAND__ load-check --host ide
__LAZYTRAE_LOCAL_COMMAND__ verify --must-pass
```

These read-only reports cover copied assets and declarations. The installed
package carries the CLI, local MCP implementation, templates, package-local
`LICENSE` and `NOTICE`, and its production dependency closure. They do not
prove discovery, hooks, a running session, or an MCP connection.

## `offboard` protocol

When the user types `offboard`, ask which host and package scope is being
removed, run only an approved local uninstall command, preserve modified or
unknown assets, and report package removal separately from observed host
removal. Remove host MCP registrations manually: Trae Work through **Settings
→ MCP**, Trae CLI with `trae-cli mcp remove lazytrae`, and Trae IDE through its
project MCP UI.

## Optional local tooling boundary

Automatic local capability selection is temporary and receipt-owned. It may
use `rg`, `sg`, or a read-only LSP bridge for a selected task, but onboarding,
offboarding, InitDeep, and doctor never enable optional providers. CodeGraph,
Context7, `grep_app`, filesystem, and Playwright require an explicit lifecycle
and approval; they never become proof of host readiness.

<!-- lazytrae:managed:end:onboarding -->
