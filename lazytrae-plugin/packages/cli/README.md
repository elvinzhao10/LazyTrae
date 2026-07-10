# lazytrae-ai

LazyTrae CLI — Trae-native recreation of LazyCodex/OmO workflows.

A developer can install LazyTrae into any repo via `npx lazytrae-ai init` to get the full LazyTrae experience.

## Commands

```bash
# Install LazyTrae into current repo
npx lazytrae-ai init

# Check installation health
npx lazytrae-ai doctor

# Update managed templates and managed blocks
npx lazytrae-ai sync

# Remove LazyTrae from current repo
npx lazytrae-ai uninstall

# Same as doctor --strict (treats WARNs as FAILs)
npx lazytrae-ai verify

# Print handoff summary from current state
npx lazytrae-ai handoff
```

## Install

```bash
# One-step install into current repo
npx lazytrae-ai init
```

This will:
- Detect repo root (finds `.git`)
- Create directory structure: `.trae/`, `.lazytraework/`, `.omo/`
- Copy all templates (rules, skills, commands, agents)
- Merge managed blocks into `AGENTS.md` without overwriting user content
- Add `.gitignore` entries for runtime state

## What Gets Installed

| Path | Purpose |
|------|---------|
| `.trae/rules/lazytrae.md` | Project-level LazyTrae behavioral rules |
| `.trae/skills/*.md` | 9 workflow skills (init-deep, ulw-plan, start-work, etc.) |
| `.trae/commands/*.md` | 9 slash command definitions |
| `.trae/agents/*.md` | 11 custom agent role definitions |
| `.trae/hooks.json` | Hooks configuration (for v0.7) |
| `.trae/mcp.json` | MCP configuration (for v0.8) |
| `.lazytraework/config.json` | LazyTrae configuration |
| `.lazytraework/state/` | Durable runtime state (boulder, active-loop, sessions) |
| `.lazytraework/schemas/` | JSON schemas for state validation |
| `.lazytraework/evidence/` | Evidence templates for verification gates |
| `.omo/plans/` | Compatibility mirror for plans |
| `.omo/ulw-loop/` | Compatibility mirror for loop state |

## License

MIT