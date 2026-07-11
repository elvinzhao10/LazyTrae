# lazytrae-ai

LazyTrae CLI — Trae-native recreation of LazyCodex/OmO workflows.

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
```

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
| `.trae/hooks.json` | Five configured events referencing eight hook scripts (v0.15 alpha) |
| `.trae/mcp.json` | Ten MCP declarations; the `lazytrae` declaration exposes 15 tools when connected |
| `.lazytrae/config.json` | LazyTrae configuration |
| `.lazytrae/state/` | Durable runtime state (boulder, active-loop, sessions) |
| `.lazytrae/schemas/` | JSON schemas for state validation |
| `.lazytrae/evidence/` | Evidence templates for verification gates |
| `.lazytrae/plans/` | Plan files |
| `.lazytrae/loop/` | Per-run loop artifacts |

## License

MIT
