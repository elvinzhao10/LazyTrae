# lazytrae-ai

LazyTrae CLI — Trae-native workflow installer and runtime.

Release **v0.16.0-alpha.1** is verified on macOS only.

A developer installs LazyTrae from this repository, then uses the local `lazytrae` command in any project.

## Commands

```bash
# Install LazyTrae into current repo
lazytrae init

# Verify copied package files and declarations after a fresh init
lazytrae load-check --host ide

# Check installation health
lazytrae doctor

# Update managed templates and managed blocks
lazytrae sync

# Install or check global Trae Work skills on macOS
lazytrae work install
lazytrae work status
lazytrae work uninstall

# Remove LazyTrae from current repo
lazytrae uninstall

# Same as doctor --strict (treats WARNs as FAILs)
lazytrae verify

# Print handoff summary from current state
lazytrae handoff

# Inspect, provision, validate, or remove an explicitly-owned LSP provider
lazytrae tooling lsp-status --target /absolute/project --tooling-root /absolute/lazytrae-lsp
lazytrae tooling lsp-install --target /absolute/project --tooling-root /absolute/lazytrae-lsp
lazytrae tooling lsp-doctor --target /absolute/project --tooling-root /absolute/lazytrae-lsp
lazytrae tooling lsp-uninstall --target /absolute/project --tooling-root /absolute/lazytrae-lsp

# Start the separate read-only LSP MCP bridge after provider readiness is reported
lazytrae lsp --target /absolute/project --tooling-root /absolute/lazytrae-lsp

# Inspect and explicitly manage the optional package-owned CodeGraph bridge
lazytrae tooling codegraph-doctor --target /absolute/project --tooling-root /absolute/lazytrae-codegraph
lazytrae tooling codegraph-install --target /absolute/project --tooling-root /absolute/lazytrae-codegraph
lazytrae tooling codegraph-init --target /absolute/project --tooling-root /absolute/lazytrae-codegraph
lazytrae tooling codegraph-enable --target /absolute/project --tooling-root /absolute/lazytrae-codegraph
lazytrae tooling codegraph-uninstall --target /absolute/project --tooling-root /absolute/lazytrae-codegraph

# Keep optional remote MCP services disabled until a project explicitly selects them.
lazytrae tooling remote-status
lazytrae tooling enable context7
lazytrae tooling enable grep_app
lazytrae tooling disable context7
lazytrae tooling disable grep_app
```

## Managed LSP bridge

The optional LSP bridge is separate from `lazytrae mcp`; the latter retains its 15-tool contract. It detects an existing project or host provider before provisioning a package-owned fallback. Only JavaScript/TypeScript (`typescript-language-server@5.3.0` with `typescript@5.9.3`) and Python (`basedpyright@1.39.9`) are supported. TypeScript requires Node 20 or later. The bridge exposes only advertised read-only definitions, references, symbols, hover, and diagnostics operations. It rejects rename requests and uses an explicit receipt-owned tooling root, so it never changes the target project's source, manifest, lockfile, or global tools.

## Tool-selection ladder

Use `rg` for exact local text/file search and `sg` for syntax-aware structural
search. Use the separate LSP bridge for semantic navigation, CodeGraph for an
explicit architecture/dependency question on a prepared large repository,
Context7 for current library documentation, and `grep_app` for explicit public
code examples when local evidence is insufficient. Use `lazytrae tooling verify`
to discover project-native lint/typecheck/test/build commands; it runs none
until the caller gives `--run <selection>`.

## Optional CodeGraph bridge

CodeGraph is a separate optional MCP process, never an extra LazyTrae internal tool. `lazytrae tooling codegraph-doctor` recommends it only when the target has at least 500 supported source files or 100,000 supported source lines. It never starts CodeGraph, downloads anything, or creates `.codegraph/`. `codegraph-install` pins `@colbymchenry/codegraph@1.4.1` in an explicit empty LazyTrae-owned tooling root with package scripts disabled. `codegraph-init` is an explicit caller action that creates or refreshes the project index with telemetry disabled and all runtime state contained in that tooling root; it never claims ownership of or removes the project `.codegraph/` directory. `codegraph-enable` proves that index before adding the managed `lazytrae codegraph ...` MCP entry. `sync` preserves that managed entry and caller MCP entries. The bridge invokes only `codegraph init` and `codegraph serve --mcp`; it never calls CodeGraph's agent-install, uninstall, upgrade, or provisioning commands. `codegraph-uninstall` removes only an unmodified receipt-owned tooling root and never removes a project `.codegraph/` directory.

## Optional remote MCP capabilities

Context7 and `grep_app` are disabled by default. `lazytrae tooling enable context7` adds a managed, endpoint-only `lazytrae_context7` entry for `https://mcp.context7.com/mcp`; `lazytrae tooling enable grep_app` adds the experimental, unpinned `lazytrae_grep_app` entry for `https://mcp.grep.app`. `sync` preserves both selections and unrelated caller MCP entries. Neither normal install, doctor, nor status contacts either service. Credentials are never accepted by LazyTrae commands or written to project state; configure any required credential only in the MCP host environment. Use `tooling disable` to remove only the corresponding LazyTrae-managed entry.

## Onboard

Copy or clone [LazyTrae](https://github.com/elvinzhao10/LazyTrae), open that folder in the selected Trae host, and type `onboard`. The setup guide asks for Trae IDE, Trae Work, or Trae CLI, then uses the already-installed `lazytrae` command for the matching safe setup path. It reports package readiness separately from host registration and a live MCP connection.

For Trae CLI, run `lazytrae init --host cli`, then `trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'`, then launch `trae-cli`. For Trae Work, run `lazytrae init --host work`, restart/reload the host, and manually add `lazytrae mcp` in **Settings → MCP**.

This will:
- Detect repo root (finds `.git`)
- Create directory structure: `.trae/`, `.lazytrae/`
- Copy all templates (rules, skills, commands, agents)
- Merge managed blocks into `AGENTS.md` without overwriting user content
- Add `.gitignore` entries for runtime state

For Trae Work, run `lazytrae work install` after installing the CLI. It copies the bundled `lazy-*` skills to `~/.trae-cn/skills/` on macOS. That built-in location is the only documented and tested host default; reload/discovery must still be confirmed manually. Trae Work has no global command registry, and MCP still must be registered manually in **Settings → MCP** using command `lazytrae` and argument `mcp`. Linux and Windows locations are unverified; pass `--skills-dir` only after the host reports the directory.

## Uninstall safely

`lazytrae uninstall --yes` removes only project files that still exactly match the bundled templates. It preserves modified or unknown files in `.trae/` and `.lazytrae/`, all normal runtime data under `.lazytrae/state/`, `.lazytrae/evidence/`, `.lazytrae/plans/`, `.lazytrae/loop/`, and files in foreign or legacy namespaces. `--soft` removes verified `.trae/` assets only. `--purge-state` additionally removes only exact bundled runtime template files; it never recursively deletes a runtime directory. `--soft` and `--purge-state` cannot be combined.

For Trae Work on macOS, `lazytrae work uninstall` removes only manifest-listed `lazy-*` skills whose sole `SKILL.md` still exactly matches the bundled contents. It refuses symlinks and hard links, and preserves edited or nonempty skill directories. Linux and Windows locations and host behavior are unverified; pass a directory reported by Trae Work with `--skills-dir` only after manually confirming it. Remove the `lazytrae` MCP entry yourself in **Settings → MCP**.

For Trae IDE, remove the project configuration with `lazytrae uninstall --yes`, then remove or disable the `lazytrae` server in the IDE's MCP settings if you added one separately. For Trae CLI, remove the registered server with `trae-cli mcp remove lazytrae`; uninstalling project files never changes CLI registration. Remove the global command only when you no longer need it: `npm uninstall -g lazytrae-ai`.

## What Gets Installed

| Path | Purpose |
|------|---------|
| `.trae/rules/lazytrae.md` | Project-level LazyTrae behavioral rules |
| `.trae/skills/*/SKILL.md` | 17 workflow skills (init-deep, ulw-plan, start-work, etc.) |
| `.trae/commands/*.md` | 9 slash command definitions |
| `.trae/agents/*.md` | 11 custom agent role definitions |
| `.trae/hooks.json` | Five configured events referencing eight hook scripts (v0.16.0-alpha.1) |
| `.trae/mcp.json` | 8 MCP declarations; one executable core server and seven disabled placeholders. The `lazytrae` declaration exposes 15 tools when connected. |
| `.lazytrae/config.json` | LazyTrae configuration |
| `.lazytrae/state/` | Durable runtime state (boulder, active-loop, sessions) |
| `.lazytrae/schemas/` | JSON schemas for state validation |
| `.lazytrae/evidence/` | Evidence templates for verification gates |
| `.lazytrae/plans/` | Plan files |
| `.lazytrae/loop/` | Per-run loop artifacts |

## License

MIT
