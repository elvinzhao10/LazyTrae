# Install and host verification

Install for one host at a time: Trae IDE, Trae Work, or Trae CLI. LazyTrae is
verified on macOS only; do not assume a non-macOS host path or host behavior.

## 1. Establish the companion command

The installed `lazytrae` companion provides the portable installer,
verification gate, and local MCP server. With it available, initialize only
your selected host:

```bash
lazytrae init --host ide|work|cli
lazytrae load-check --host ide|work|cli
lazytrae doctor
```

`load-check` reports **package readiness**: copied assets and declarations. It
does not prove a loaded plugin, host discovery, hook execution, an active
session, or an MCP connection.

If the companion command is unavailable, do not claim that copying this
repository installed it. The repository-only fallback is:

```bash
node /path/to/LazyTrae/lazytrae-plugin/packages/cli/src/index.js init --host ide
```

It can copy `.trae/` and `.lazytrae/` project assets but does not create the
global `lazytrae` executable, so its MCP declaration remains pending.

## 2. Prove the selected host separately

Follow the exact host procedure and observe its final condition in
[Host routes](reference/host-routes.md):

- **Trae IDE:** reopen the project and observe asset discovery and the MCP
  connection.
- **Trae Work:** after you explicitly approve installing skills in your global
  Work location, run `lazytrae init --host work` on macOS. Then run
  `lazytrae work status`, reload Work, and observe skill discovery. Separately,
  after you explicitly approve the host change, add `lazytrae mcp` manually in
  **Settings → MCP** and observe the connection.
- **Trae CLI:** after you explicitly approve the host registration, run the
  documented `trae-cli mcp add-json` command, start a new session, and observe
  the connection.

The Work skill location `~/.trae-cn/skills/` is verified only on macOS. Linux
and Windows locations need a directory reported by the host and local
observation. The companion package's source, install, and removal details are
in [the setup guide](../AGENTS.md); the proof boundary is documented in
[verification evidence](../lazytrae-evaluation.md).

Once the host is proven, continue to [your first task](02-first-task.md).
