# Host routes

Use exactly one route at a time. Start with the pinned `v1.0.2` release in a
permanent folder, open or link it in the host, give the agent
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

| Host | Package artifact (safe local work) | One-action handoff and expected observation |
| --- | --- | --- |
| **Trae IDE** | Documented package route: `init --host ide` copies project assets. `.trae/mcp.json` is generated with `command: node`, the absolute release launcher, and the project root. | Auto-discovery is an observed prerelease route. After approval, reopen the project and verify one Skill/command plus the core MCP. |
| **Trae Work** | Approval-gated Skills copy/import uses the observed macOS directory or a host-reported `--skills-dir`. | The observed prerelease route accepts the JSON printed by `load-check --host work` in **Settings → MCP**. Paste only after approval, reload later, then observe one Skill plus the core MCP. |
| **Trae CLI** | Documented package route: `init --host cli` writes local project and verification assets. | No public universal MCP registration command is assumed. Use the JSON from `load-check --host cli` with the selected build's documented/manual settings flow, start a new session later, then observe one command plus the core MCP. |

## Local command and package checks

Use the release-owned launcher, never a PATH/global lookup:

```text
node <permanent-release-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js --root <project-root> <command>
```

Run only `init --host ide|cli`, `sync`, `load-check --host <host>`, and
`doctor` before approval. These inspect or write the selected project and do
not enable optional providers, alter credentials, or mutate host settings. For
Trae Work, `init --host work` is itself host-managed because it copies Skills;
ask first. The generated project declaration is the Trae IDE artifact; Trae
Work still requires a manual connector.

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
