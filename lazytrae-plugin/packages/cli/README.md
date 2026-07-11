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

For Trae Work, run `lazytrae work install` after installing the CLI. It copies the bundled `lazy-*` skills to `~/.trae-cn/skills/` on macOS. Trae Work has no global command registry, and MCP still must be registered manually in **Settings → MCP** using command `lazytrae` and argument `mcp`.

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
