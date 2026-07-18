# Host routes

Use exactly one route at a time. Start with the pinned `v1.0.2` release in a
permanent folder, open or link it in the host, give the agent
`https://github.com/elvinzhao10/LazyTrae`, and type `onboard`. The agent detects
or asks for the host, runs safe package checks, and reports package readiness
before any host-managed mutation.

Every host handoff is one action: after explicit approval, give one exact GUI
or host action and wait. After the user responds, inspect the app with
Computer Use. If a reload or new session is needed, issue it as the next
single action and wait again. Verify one real Skill/command and every expected
MCP connection, then report **package readiness** and **host readiness** as
separate fields. Without observation, host readiness is **pending**.

| Host | Package artifact (safe local work) | One-action handoff and expected observation |
| --- | --- | --- |
| **Trae IDE** | `init --host ide` copies project assets. `.trae/mcp.json` contains a generated `lazytrae` declaration using `command: node`, an absolute release-owned `bin/lazytrae.js`, `--root <project>`, and `mcp`. | After approval, reopen the project. In the inspected session verify one Skill/command and the `lazytrae` core MCP connection. The seven optional base entries remain disabled and are not expected connections. |
| **Trae Work** | Supported Skills copy/import: the verified macOS route copies 17 Skills to `~/.trae-cn/skills/` or a host-reported `--skills-dir`. | After approval, perform the Skills copy/import. In a later separate action, manually add the local `lazytrae` connector in **Settings → MCP** from the exact command and args in `.trae/mcp.json`; then reload and observe one imported Skill plus the core MCP. |
| **Trae CLI** | `init --host cli` writes project configuration and local verification assets. | After approval, register the exact local `node` command with `trae-cli mcp add-json`. In a later separate action start one new session and observe one command plus the `lazytrae` core MCP. |

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
**Settings → MCP**, the CLI registration with `trae-cli mcp remove lazytrae`,
and the IDE declaration through the host UI after package removal; record the
package result separately from the observed host result.
