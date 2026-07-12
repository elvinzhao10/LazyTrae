# LazyTrae v0.16.0-alpha.1 Implementation Evidence

> Current release evidence, not a historical parity score or a certification of a Trae host session.

## What is implemented and checked

The v0.16.0-alpha.1 package contains 17 skills, 9 commands, 11 agent definitions, 8 hook scripts across 5 configured events, and 8 MCP declarations: one executable `lazytrae` core server plus seven disabled placeholders. The local core server exposes 15 tools after connection. Context7, `grep_app`, filesystem, and Playwright are not provisioned by default; each requires an explicit `lazytrae tooling enable <capability>` request and is added under a namespaced `lazytrae_*` server name. The installer keeps its canonical project data under `.trae/` and `.lazytrae/`; it does not require a legacy runtime directory to operate.

The release adds a package-owned, explicit-root tooling foundation. It detects
existing compatible `rg` and `sg` providers before provisioning pinned local
fallbacks, supports separate read-only TypeScript/JavaScript and Python LSP
providers, and discovers repository-native lint/typecheck/test/build commands
without running them unless selected. CodeGraph is a conditional separate MCP
that is enabled only after a caller-created project index exists. Context7,
`grep_app`, filesystem, and Playwright are disabled-by-default external
selections; normal install, doctor, and status paths remain offline.

The release checks exercise the source-local CLI and package artifacts:

- `npm ci --ignore-scripts` and `npm test` in the CLI and MCP packages. The CLI suite covers template parity, source/packaged MCP equivalence, a fresh `init`/`load-check`/`doctor` fixture, tooling lifecycle paths, namespace migration, path-boundary cases, and safe uninstall lifecycle cases.
- `lazytrae load-check --host ide|work|cli` for copied-file and declaration readiness.
- `lazytrae uninstall --yes`, `--soft`, and `--purge-state` lifecycle coverage. Removal is content-checked: modified or unknown files and normal runtime records are preserved.
- `lazytrae work install`, `status`, and `uninstall` coverage with an explicit skills directory. Work uninstall removes only exact, unmodified LazyTrae skills and rejects symlink or hard-link traversal.

These are implementation and package-readiness checks. They do not show that an IDE or CLI host discovered configuration, invoked a hook, loaded a plugin, or connected the MCP process.

## Host-compatibility boundary

| Surface | Current evidence | Required manual observation |
| --- | --- | --- |
| Trae IDE | Project files and declarations are generated and checked. | Reopen the project; verify discovery and the MCP connection in the IDE. |
| Trae Work on macOS | The CLI's default global-skills target is `~/.trae-cn/skills/`; file-copy, status, and bounded removal behavior are checked. | Restart/reload Trae Work, confirm skill discovery, and add/confirm `lazytrae mcp` in **Settings → MCP**. |
| Trae Work on Linux or Windows | No default location or live-host behavior is verified. | Obtain the host-reported directory, pass it with `--skills-dir`, and verify the session manually. |
| Trae CLI | Project configuration and the registration command are documented. | Run `trae-cli mcp add-json ...`, start a new session, and observe the connection. |

The 15-tool count applies only after the local MCP server connects. Package readiness alone is not an MCP connection test.

## Safe removal contract

`lazytrae uninstall --yes` removes only exact bundled project assets. `--soft` limits removal to verified `.trae/` assets; `--purge-state` also removes only exact runtime templates, and the two options cannot be combined. The command does not change host MCP registration. On macOS, `lazytrae work uninstall` removes only exact, unmodified installed skills. Remove host MCP registrations separately; for non-macOS paths, use an explicitly confirmed `--skills-dir` value.

## Attribution and limits

LazyTrae's attribution and license are recorded exclusively in the repository [NOTICE](NOTICE) and [LICENSE](LICENSE). This document intentionally replaces historical percentage claims with observable v0.16.0-alpha.1 package evidence. It makes no claim of Linux or Windows verification and no claim that a live Trae host session has been exercised.
