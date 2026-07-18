<!-- lazytrae:managed:start:onboarding -->
# AGENTS.md — LazyTrae

LazyTrae is a self-contained workflow harness for Trae IDE, Trae Work, and
Trae CLI. It is verified on macOS only. Keep the package, host settings,
credentials, and live sessions as separate authorities.

## Local-first onboarding (start here)

Keep the pinned `v1.0.2` release in a permanent folder before opening it in a
host. Open or link that folder in the selected Trae host, then give the agent
the GitHub repository link, `https://github.com/elvinzhao10/LazyTrae`, and type
`onboard`. Do not use a temporary download directory or rely on a globally
installed `lazytrae` command.

The release-owned launcher is the only primary package command:

```text
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> <command>
```

## `onboard` protocol

When the user types `onboard`:

1. Scan the complete current message and detect the host from the open app. If
   it is not unambiguous, ask one focused question: **Trae IDE**, **Trae Work**,
   or **Trae CLI**. Do not run setup while the host is ambiguous.
2. Resolve the opened release root and project root. Confirm that the release
   is the pinned `v1.0.2` copy in a permanent location and that the local
   launcher exists. Never fall back to `PATH`, `npx`, or a global `lazytrae`.
3. Run only safe package checks and project-local setup through that launcher:
   `init --host ide|cli`, `sync`, `load-check --host <host>`, and `doctor`.
   These inspect or write the selected project only. Do not enable optional
   providers or change credentials, dependencies, lockfiles, or host settings.
4. For Trae Work, treat copying Skills to the host directory as a host-managed
   mutation. Run `init --host work` only after the approval gate below; the
   package check before approval must remain read-only.
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

## Host routes and artifact boundary

| Host | Safe package artifact | Host action and expected observation |
| --- | --- | --- |
| **Trae IDE** | Project `.trae/` and `.lazytrae/`; `.trae/mcp.json` is generated with `command: node`, an absolute release-owned launcher, and the project root. | After approval, reopen the project as the one action. In the inspected session verify one Skill/command and the `lazytrae` core MCP connection. |
| **Trae Work** | Supported Skills copy/import (17 Skills on the verified macOS default `~/.trae-cn/skills/`). | After approval, copy/import Skills, then separately add the local `lazytrae` connector manually in **Settings → MCP** using the exact command and args from `.trae/mcp.json`. Reload only as a later one-action handoff; verify one imported Skill and the core MCP. |
| **Trae CLI** | Project configuration and verification gates through the local launcher. | After approval, register the exact local `node` command with `trae-cli mcp add-json`, then start one new session as a later action. Verify one command and the `lazytrae` core MCP. |

Trae Work does not auto-load the project MCP file, and Linux/Windows Work
locations are not asserted. Ask the host for its Skills directory before using
`--skills-dir`. A declaration or load-check is package evidence until the
selected host visibly connects it.

## Safe commands

```bash
# Replace both placeholders; keep the release root permanent and absolute.
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root <project-root> init --host ide
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root <project-root> load-check --host ide
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js \
  --root <project-root> doctor
```

Project uninstall removes only exact receipt-owned assets and never removes a
Trae Work or Trae CLI registration. Use the `offboard` protocol for manual
host removal and report package removal separately from observed host removal.

## Optional local tooling boundary

Automatic local capability selection is temporary and receipt-owned. It may
use `rg`, `sg`, or a read-only LSP bridge for a selected task, but onboarding,
offboarding, InitDeep, and doctor never enable optional providers. CodeGraph,
Context7, `grep_app`, filesystem, and Playwright require an explicit lifecycle
and approval; they never become proof of host readiness.

<!-- lazytrae:managed:end:onboarding -->
