# lazytrae-ai

LazyTrae CLI — Trae-native recreation of LazyCodex/OmO workflows.

A developer installs LazyTrae from this repository, then uses the local `lazytrae` command in any project.

## Commands

```bash
# Install LazyTrae into current repo
lazytrae init

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

## Install

```bash
# From the cloned LazyTrae repository
cd lazytrae-plugin/packages/cli
npm install
npm install -g .

# Then, in the project that should use LazyTrae
lazytrae init
```

This will:
- Detect repo root (finds `.git`)
- Create directory structure: `.trae/`, `.lazytrae/`, `.omo/`
- Copy all templates (rules, skills, commands, agents)
- Merge managed blocks into `AGENTS.md` without overwriting user content
- Add `.gitignore` entries for runtime state

For Trae Work, run `lazytrae work install` after installing the CLI. It copies the bundled `lazy-*` skills to `~/.trae-cn/skills/` on macOS. Trae Work has no global command registry, and MCP still must be registered manually in **Settings → MCP** using command `lazytrae` and argument `mcp`.

## What Gets Installed

| Path | Purpose |
|------|---------|
| `.trae/rules/lazytrae.md` | Project-level LazyTrae behavioral rules |
| `.trae/skills/*.md` | 9 workflow skills (init-deep, ulw-plan, start-work, etc.) |
| `.trae/commands/*.md` | 9 slash command definitions |
| `.trae/agents/*.md` | 11 custom agent role definitions |
| `.trae/hooks.json` | Hooks configuration (for v0.7) |
| `.trae/mcp.json` | MCP configuration (for v0.8) |
| `.lazytrae/config.json` | LazyTrae configuration |
| `.lazytrae/state/` | Durable runtime state (boulder, active-loop, sessions) |
| `.lazytrae/schemas/` | JSON schemas for state validation |
| `.lazytrae/evidence/` | Evidence templates for verification gates |
| `.omo/plans/` | Compatibility mirror for plans |
| `.omo/ulw-loop/` | Compatibility mirror for loop state |

## License

MIT
