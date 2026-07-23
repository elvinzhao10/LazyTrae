<!-- lazytrae:managed:start:onboarding -->
# AGENTS.md — LazyTrae setup guide

> **Agent:** use this guide to install, verify, and safely remove LazyTrae.
> For everyday workflow use, see the [LazyTrae README](https://github.com/elvinzhao10/LazyTrae#readme).

LazyTrae packages local routes for **Trae IDE**, **Trae Work**, and **Trae
CLI**. The release-owned local launcher supplies the portable installer,
verification gate, and local MCP server. Package behavior is verified on
macOS only; host behavior keeps the evidence labels below. The current package
version is `1.0.3`.

## Local-first onboarding (start here)

Keep the pinned `v1.0.3` release in a permanent folder before opening or
linking it in a host. In the selected Trae host, give the agent the GitHub
repository link, `https://github.com/elvinzhao10/LazyTrae`, and type `onboard`.
Do not use a temporary folder or a PATH/global `lazytrae` command.

The release-owned local command is:

```text
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> <command>
```

## `onboard` protocol

When the user types `onboard`:

1. Scan the complete current message and detect the host from the open app. If
   it is not unambiguous, ask one focused question: **Trae IDE**, **Trae Work**,
   or **Trae CLI**. Do not run setup while the host is ambiguous.
2. When upgrading from v1.0.2, inventory managed versus modified/unknown
   assets first. Keep v1.0.3 in a separate permanent folder, replace only
   managed assets, preserve user changes, and record any conflict.
3. Confirm that this project is linked to a pinned `v1.0.3` release in a
   permanent location and that `node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root>` still exists. Never
   fall back to `PATH`, `npx`, or a global `lazytrae`.
4. Run only safe package checks and project-local setup through the local
   command: `init --host ide|cli`, `sync`, `load-check --host <host>`, and
   `doctor`. These inspect or write the selected project only. Do not enable
   optional providers or change credentials, dependencies, lockfiles, or host
   settings.
5. For Trae Work, copying Skills to the host directory is a host-managed
   mutation. Run `node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> init --host work` only after the
   approval gate below; the package check before approval must remain read-only.
6. Report **package readiness** separately. It covers local files, the
   generated declaration, and local contracts; it never proves host discovery,
   hook execution, a running session, or an MCP connection.
7. Before any host-managed mutation (Work Skills copy, a Settings → MCP entry,
   or Trae CLI registration), ask for explicit approval naming the exact host
   action. Never automate marketplace, account, model, credential, or app
   setting changes.
8. After approval, give exactly **one** concrete GUI/host action and then wait.
   Do not bundle reload, connector setup, and a test into one handoff.
9. After the user responds, inspect the corresponding app with Computer Use.
   If Computer Use is unavailable, accept a user-pasted verbatim status or
   screenshot as observed evidence. Otherwise keep host readiness **PENDING**.
   If the host needs a reload or new session, give that as the next single
   action, wait again, and inspect again.
10. In the observed session, verify one real LazyTrae Skill or command and every
   expected MCP connection for the selected route. The base package expects one
   `lazytrae` core MCP connection (15 tools after connection); seven optional
   placeholders remain disabled unless separately selected.
11. Report `package readiness` and `host readiness` as separate fields. Without
    a current Computer Use or user-supplied observation, **HOST READINESS:
    PENDING** even when every local check passes.

Availability labels are evidence boundaries: the release-owned launcher and
generated configuration are the **documented package route**; IDE/Work behavior
seen in the supplied macOS reports is an **observed prerelease route**; and a
current host stays **HOST READINESS: PENDING** until it is actually observed.
The supplied QA could not access Trae CLI, so its live-host route is explicitly
unverified even though the package can generate its local configuration.

## Select the host route

| Host | Skills and project assets | MCP step and expected observation |
| --- | --- | --- |
| **Trae IDE** | Documented package route: project `.trae/` skills, commands, rules, agents, hooks, and `.lazytrae/` state. | Auto-discovery is an observed prerelease route. `.trae/mcp.json` uses the absolute release launcher. Reopen once after approval, then observe one Skill/command and the core MCP. |
| **Trae Work** | `node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> init --host work` is approval-gated and copies 17 Skills to the observed macOS directory or a host-reported `--skills-dir`. | The observed prerelease route accepts the paste-ready JSON printed by `load-check --host work` in **Settings → MCP**. It is not a documented universal host contract. |
| **Trae CLI** | Documented package route: local project configuration plus verification gates. | No public universal MCP registration command is assumed. Use the paste-ready JSON from `load-check --host cli` with the selected build's documented/manual MCP settings flow, then start a new session and observe the core MCP. |

For either manual MCP route, copy only the JSON between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. Do not translate it to
an undocumented CLI command. Pasting the JSON, reloading, and testing are three
separate approval-gated actions.

Trae Work does not auto-load the project MCP file. Linux and Windows Work
locations and behavior are unverified; ask the host for its directory before
using `--skills-dir`. A declaration or load-check is package evidence until the
selected host visibly connects it.

## Install from a permanent release

The primary route keeps the checked-out pinned release folder as the source of
truth. Its absolute launcher path must remain stable:

```bash
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> init --host ide
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> load-check --host ide
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
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> doctor
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> load-check --host ide
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> verify --must-pass
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
→ MCP**, Trae CLI through the selected build's documented MCP settings flow,
and Trae IDE through its project MCP UI. Do not assume a universal CLI command.
For an upgrade rollback, remove only v1.0.3 managed assets after approval; do
not restore v1.0.2 over user-modified files.

## Optional local tooling boundary

Automatic local capability selection is temporary and receipt-owned. It may
use `rg`, `sg`, or a read-only LSP bridge for a selected task, but onboarding,
offboarding, InitDeep, and doctor never enable optional providers. CodeGraph,
Context7, `grep_app`, filesystem, and Playwright require an explicit lifecycle
and approval; they never become proof of host readiness.

<!-- lazytrae:managed:end:onboarding -->
