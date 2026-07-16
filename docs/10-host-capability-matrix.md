# Host capability matrix

LazyTrae supports routes for Trae IDE, Trae Work, and Trae CLI. The package can
prepare each route, but each host requires a distinct observation before it is
claimed as working.

## What each host needs

| Host | Package route | Observation required |
| --- | --- | --- |
| Trae IDE | `lazytrae init --host ide` | Reopen the project and observe discovery and MCP connection. |
| Trae Work | `lazytrae init --host work`, then `lazytrae work status` | Reload Work, observe skill discovery, add `lazytrae mcp` in **Settings → MCP**, and observe connection. |
| Trae CLI | `lazytrae init --host cli`, then `trae-cli mcp add-json` | Start a new registered session and observe connection. |

Work has no global command registry; use its installed skills or ordinary
language. The project configuration contains `.trae/` host assets and
`.lazytrae/` durable state for each route. The detailed procedure is in
[Host routes](reference/host-routes.md).

## macOS-only scope

LazyTrae host verification is macOS-only. On macOS, the verified Trae Work
skill location is `~/.trae-cn/skills/`. Linux and Windows locations and host
behavior are not asserted: obtain a host-reported directory, pass it with
`--skills-dir`, and observe the result locally. Package readiness never turns
this limitation into host proof.

See [MCP lifecycle](07b-mcp-lifecycle.md) for the shared connection boundary.
