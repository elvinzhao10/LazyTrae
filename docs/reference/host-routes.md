# Host routes

Use exactly one route. All package checks establish local package readiness,
not host discovery, hook execution, a running session, or MCP connection.
LazyTrae is verified on macOS only.

| Host | Safe package steps | Observation still required |
| --- | --- | --- |
| Trae IDE | `lazytrae init --host ide`, `lazytrae load-check --host ide`, `lazytrae doctor` | Reopen the project; observe discovery and MCP connection. |
| Trae Work (macOS) | After explicit operator approval to install global Work skills, run `lazytrae init --host work`, then `lazytrae work status`. | Reload Work and confirm skill discovery. After separate explicit approval for the host change, add or confirm `lazytrae mcp` in **Settings → MCP** and observe the connection. |
| Trae CLI | `lazytrae init --host cli`; register below | Start a new session and observe the connection. |

For Trae CLI, register before the new session only after the operator explicitly
approves this host-managed change. Then start a new session and observe the
connection:

```bash
trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'
trae-cli
```

Trae Work’s verified macOS default skill location is `~/.trae-cn/skills/`.
Linux and Windows locations and behaviour are not asserted: obtain a directory
reported by the host, pass it with `--skills-dir`, and observe the result. Work
has no global command registry; invoke skills or describe the workflow in
ordinary language.

If the installed `lazytrae` companion is absent, this repo-only fallback can
copy project configuration but cannot create the global executable or a live
MCP server:

```bash
node /path/to/LazyTrae/lazytrae-plugin/packages/cli/src/index.js init --host ide
```

After any route, apply [Verification contract](verification-contract.md). For
safe cleanup, use [Safe removal](../08-safe-removal.md).
