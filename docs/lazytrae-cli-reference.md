# LazyTrae CLI Reference

Full reference for the `lazytrae` CLI.

## Overview

The `lazytrae` CLI provides installation, health checking, synchronization, uninstallation, and handoff summary for LazyTrae.

All commands are idempotent — running them multiple times is safe.

## Commands

### `lazytrae init`

Install LazyTrae into the current repository.

**Usage:**
```bash
lazytrae init [options]
```

**Options:**
- `--help`, `-h` — Show help
- `--force` — Force re-copy all files even if unchanged

**Behavior:**
1. Detects repo root by walking up until `.git` is found
2. Creates all required directories if they don't exist
3. Copies templates from the package to the target repo
4. Merges managed blocks in `AGENTS.md` (only updates managed content, never touches user content)
5. Adds `.gitignore` entries if not already present
6. Prints a summary of what was created/updated/skipped

**Example:**
```bash
cd my-project
npx lazytrae-ai init
```

---

### `lazytrae doctor`

Check LazyTrae installation health.

**Usage:**
```bash
lazytrae doctor [options]
```

**Options:**
- `--help`, `-h` — Show help
- `--strict` — Treat WARNs as FAILs (exit with non-zero if any WARNs)

**Checks performed:**
- Required files exist (`.trae/rules/lazytrae.md`)
- At least 9 skills found (`.trae/skills/`)
- At least 9 commands found (`.trae/commands/`)
- At least 11 agents found (`.trae/agents/`)
- `.lazytrae/config.json` is valid JSON
- All state files (`.lazytrae/state/`) are valid JSON
- All schema files (`.lazytrae/schemas/`) are valid JSON
- Validate state against schemas (if `ajv` is installed)
- `AGENTS.md` has all required managed blocks
- `.omo/` compatibility directories exist
- Parity ledger is present and has all expected sections

**Exit codes:**
- `0` — All checks PASS
- `1` — One or more FAILs

---

### `lazytrae sync`

Update managed templates and managed blocks to the latest version.

**Usage:**
```bash
lazytrae sync [options]
```

**Options:**
- `--help`, `-h` — Show help

**Behavior:**
- Overwrites managed templates if they changed
- Preserves user edits outside managed blocks
- Updates managed blocks in `AGENTS.md`
- Migrates schema version in `.lazytrae/config.json` if needed
- Prints summary of what was updated/skipped

---

### `lazytrae uninstall`

Remove LazyTrae from the current repository.

**Usage:**
```bash
lazytrae uninstall [options]
```

**Options:**
- `--help`, `-h` — Show help
- `--yes`, `-y` — Skip confirmation prompt
- `--soft` — Only remove managed files (preserve `.lazytrae/` and `.omo/`)
- `--purge-state` — Remove everything including plans and evidence

**Behavior:**
- Removes `.trae/` directory
- By default, preserves `.lazytrae/evidence/` and `.lazytrae/state/` and `.omo/plans/`
- With `--purge-state`, removes everything
- Removes all managed blocks from `AGENTS.md` (leaves user content intact)
- Removes `.gitignore` entries added by `init`
- Prints summary of what was removed/preserved

---

### `lazytrae verify`

Alias for `lazytrae doctor --strict` — treats warnings as failures.

**Usage:**
```bash
lazytrae verify
```

**Exit codes:**
- `0` — All checks PASS
- `1` — One or more PASS/WARN (warns treated as fails)

---

### `lazytrae handoff`

Generate a handoff summary from current state.

**Usage:**
```bash
lazytrae handoff [options]
```

**Options:**
- `--help`, `-h` — Show help
- `--json` — Output as JSON instead of markdown

**Output:**
- Session ID, date
- What was accomplished (from active work in boulder state)
- Current state (plan file, tasks completed, current task, loop iteration)
- List of evidence files
- Remaining gaps
- Blockers
- Next prompt placeholder

---

## Directory Structure

```
packages/cli/
├── package.json                 # npm package metadata
├── src/
│   ├── index.js                 # CLI entry point, command router
│   ├── commands/
│   │   ├── init.js              # init command
│   │   ├── doctor.js           # doctor command
│   │   ├── sync.js             # sync command
│   │   ├── uninstall.js        # uninstall command
│   │   ├── verify.js           # verify command (alias)
│   │   └── handoff.js          # handoff command
│   └── lib/
│       ├── templates.js        # template loading and copying
│       ├── managed-blocks.js   # managed block parsing/merging
│       ├── validator.js        # JSON schema validation
│       └── parity-check.js     # parity ledger checking
└── templates/
    ├── AGENTS.md               # AGENTS.md template with managed blocks
    ├── agents/                 # 11 agent markdown templates
    ├── commands/               # 9 command markdown templates
    ├── skills/                 # 9 skill SKILL.md templates
    ├── rules/
    │   └── lazytrae.md         # rules template
    ├── config.json             # .lazytrae/config.json template
    ├── mcp.json                # .trae/mcp.json template
    ├── hooks.json              # .trae/hooks.json template
    ├── schemas/                # 3 JSON schema files
    ├── evidence/               # 6 evidence markdown templates
    └── state/                  # 3 empty state JSON files
```

## Exit Codes

| Command | Success (all PASS) | Failure (one or more FAIL) |
|---------|---------------------|----------------------------|
| init    | 0                   | never exits with error (just skips) |
| doctor  | 0                   | 1                          |
| sync    | 0                   | 1                          |
| uninstall | 0                 | 1                          |
| verify  | 0 (no FAIL+WARN)    | 1 (any FAIL or WARN)        |
| handoff | 0                   | 1                          |

## Idempotency

All commands are designed to be idempotent:
- `init` can be run multiple times without changing anything on the second run
- `sync` only updates what actually changed
- `uninstall` only removes what was added by `init`

## Managed Blocks

LazyTrae uses "managed blocks" in `AGENTS.md` to preserve user content while updating managed sections:

```markdown
<!-- lazytrae:managed:start:version-numbering -->
... managed content here ...
<!-- lazytrae:managed:end:version-numbering -->
```

- `init` and `sync` only update content inside these blocks
- Content outside managed blocks is never touched
- `uninstall` removes all managed blocks but leaves user content intact

## Author

LazyTrae Contributors

## License

MIT