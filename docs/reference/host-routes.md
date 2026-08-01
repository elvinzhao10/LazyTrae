# Host routes

Use exactly one route at a time. **Node.js LTS 20 or newer** and **Git** are
required. Bootstrap with `lifecycle onboard` only from the verified official
origin `https://github.com/elvinzhao10/LazyTrae.git`, then use
`node "<install-root>/LazyTrae/launcher.js"`. `lifecycle update`,
`lifecycle status`, and plan-first `lifecycle offboard` operate on
`LazyTrae/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
The bootstrap checkout may be deleted after promotion.

The default install root is `~/Library/Application Support/LazySeries` on
macOS, `${XDG_DATA_HOME:-~/.local/share}/lazyseries` on Linux, and
`%LOCALAPPDATA%\LazySeries` on Windows. A moved same-version tag requires
`--confirm-revision <full-sha>`. If Node changes, use a fresh verified checkout
for scoped offboard and re-onboard rather than editing receipts. These package
operations never prove a host: **HOST READINESS: PENDING** until observation.

Open or link the durable `v1.0.3` release in the host, give the agent
`https://github.com/elvinzhao10/LazyTrae`, and type `onboard`. The agent detects
or asks for the host, runs safe package checks, and reports package readiness
before any host-managed mutation.

Every host handoff is one action: after explicit approval, give one exact GUI
or host action and wait. After the user responds, inspect the app with
Computer Use. If Computer Use is unavailable, a user-pasted verbatim status or
screenshot is observed evidence. If a reload or new session is needed, issue
it as the next single action and wait again. Verify one real Skill/command and
every expected MCP connection, then report **package readiness** and **host
readiness** as separate fields. Without observation, **HOST READINESS:
PENDING**.

Use three availability labels. The release launcher and generated artifacts
are the **documented package route**. The supplied macOS IDE/Work findings are
an **observed prerelease route**, not a universal host contract. A selected
session remains **HOST READINESS: PENDING** until observed.
The supplied QA could not access Trae CLI, so its live-host route is explicitly
unverified; use only the selected build's documented/manual configuration.

| Host | Package artifact (safe local work) | One-action handoff and expected observation |
| --- | --- | --- |
| **Trae IDE** | Documented package route: `init --host ide` copies project assets. `.trae/mcp.json` is generated with `command: node`, the absolute release launcher, and the project root. | Auto-discovery is an observed prerelease route. After approval, reopen the project and verify one Skill/command plus the core MCP. |
| **Trae Work** | Approval-gated Skills copy/import uses the observed macOS directory or a host-reported `--skills-dir`. | The observed prerelease route accepts the JSON printed by `load-check --host work` in **Settings → MCP**. Paste only after approval, reload later, then observe one Skill plus the core MCP. |
| **Trae CLI** | Documented package route: `init --host cli` writes local project and verification assets. | No public universal MCP registration command is assumed. Use the JSON from `load-check --host cli` with the selected build's documented/manual settings flow, start a new session later, then observe one command plus the core MCP. |

## Local command and package checks

Use the stable durable launcher, never a source, PATH, or global lookup:

```text
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" <command>
```

Run only `init --host ide|cli`, `sync`, `load-check --host <host>`, and
`doctor` before approval. These inspect or write the selected project and do
not enable optional providers, alter credentials, or mutate host settings. For
Trae Work, `init --host work` is itself host-managed because it copies Skills;
ask first. The generated project declaration is the Trae IDE artifact; Trae
Work still requires a manual connector.

For Work and CLI, copy only the JSON printed between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. The relevant commands
are `load-check --host work` and `load-check --host cli`. Paste the Work JSON
in **Settings → MCP**; for CLI use the selected build's documented/manual MCP
settings flow because no public universal MCP registration command is assumed.
Do not translate the JSON to an undocumented command.

## Troubleshooting the handoff

- **Missing durable launcher:** stop. Use a fresh checkout from the verified
  origin to inspect or re-onboard only the scoped product; never substitute a
  source-relative, PATH, or global command.
- **Work Skills absent:** `sync` cannot install the host's Skills copy. Ask for
  approval, then use the absolute launcher with `init --host work` as the next
  single action.
- **MCP form rejects command fields:** use only the JSON between the printed
  markers. Do not hand-convert it or assume a CLI registration command.
- **Package green, host pending:** reload or start a new session as one action,
  then observe one real Skill/command and the core MCP. A prior initialize
  receipt remains historical evidence, not a live connection.

## Minimal live-test prompt

After the approved setup and required reload/new session, send:

> Use one loaded LazyTrae Skill or command for a harmless read-only project
> check, then call one `lazytrae` core MCP tool. Report the host/build, what was
> actually observed, the core MCP status and tool count, any exact error, and
> package readiness separately from host readiness. Do not infer from files.

The core server exposes 15 tools after a host connects it. The seven disabled
placeholders (`grep_app`, `context7`, `filesystem`, `git`, `playwright`,
`ast_grep`, and `lsp`) are declarations only and must not be counted as live
MCP connections unless the user separately selects and observes them.

## Boundary and safe removal

Package checks validate copied files, declarations, and local contracts. They
do not prove host discovery, hook execution, a running session, or an MCP
connection. Project uninstall removes only exact receipt-owned assets and
never guesses or removes host registrations. Remove the Work connector in
**Settings → MCP**, the CLI registration through the selected build's
documented MCP settings flow, and the IDE declaration through the host UI after
package removal; record the package result separately from the observed host
result.
