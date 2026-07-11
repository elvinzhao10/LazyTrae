# LazyTrae CLI Reference

Full reference for the `lazytrae` CLI.

## Overview

The `lazytrae` CLI provides installation, health checking, synchronization, uninstallation, completion-gate status, and handoff summary for LazyTrae.

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
lazytrae init
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
- `.lazytrae/plans/` and `.lazytrae/loop/` directories exist
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
- `--soft` — Remove verified `.trae/` assets only; leave all `.lazytrae/` data intact
- `--purge-state` — Also remove exact bundled runtime templates in `.lazytrae/state/` and `evidence/`

`--soft` and `--purge-state` are mutually exclusive.

**Behavior:**
- Removes only project files whose content still exactly matches the bundled LazyTrae templates; modified and unknown `.trae/` and `.lazytrae/` files stay in place
- Normal uninstall removes verified configuration/schema assets and preserves all runtime directories
- `--soft` leaves `.lazytrae/` untouched
- `--purge-state` removes only exact bundled runtime templates; generated and unknown runtime files and directories remain
- Never reads, writes, or removes `.omo/`
- Removes all managed blocks from `AGENTS.md` (leaves user content intact)
- Removes only the exact `.gitignore` block added by `init`, preserving adjacent user rules
- Prints summary of what was removed/preserved

### `lazytrae work uninstall`

Remove globally copied Trae Work skills without assuming ownership of host files.

```bash
lazytrae work uninstall [--skills-dir <path>]
```

On macOS, the command uses Trae Work's known global skills location. Elsewhere, supply the directory shown by Trae Work with `--skills-dir`; LazyTrae never guesses a host path. It removes only skills listed in its bundled manifest when their only file is an unmodified `SKILL.md` matching the bundled content. It rejects symlinked and hard-linked paths and retains edited or nonempty skill directories. It never removes the Trae Work MCP setting: remove the `lazytrae` entry yourself in **Settings → MCP**.

Host-managed cleanup remains manual: remove or disable a separately configured LazyTrae server in Trae IDE settings, and remove a Trae CLI registration with `trae-cli mcp remove lazytrae`. To remove the global command after host cleanup, run `npm uninstall -g lazytrae-ai`.

---

### `lazytrae verify`

Run LazyTrae health checks. With `--must-pass`, also checks completion gates so advisory Trae hooks have a hard CLI enforcement surface.

**Usage:**
```bash
lazytrae verify [options]
```

**Options:**
- `--help`, `-h` — Show help
- `--strict` — Treat WARNs as FAILs
- `--must-pass` — Run doctor plus completion gates; exits non-zero when active work or loop evidence is incomplete

**Exit codes:**
- `0` — All checks PASS
- `1` — One or more FAILs, or incomplete gates with `--must-pass`

---

### `lazytrae completion-status`

Print whether active LazyTrae completion gates are `ready` or `blocked`.

**Usage:**
```bash
lazytrae completion-status
```

**Checks performed:**
- Active Boulder tasks must be complete before final completion
- Completed Boulder tasks must have non-empty evidence paths
- Active loop state must be complete before final completion
- Completed loop state must have recorded aggregate evidence

**Exit codes:**
- `0` — `ready`
- `1` — `blocked`

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
- Completion gate status and reasons when blocked
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
│   │   ├── verify.js           # verify command
│   │   ├── completion-status.js # completion gate status command
│   │   └── handoff.js          # handoff command
│   └── lib/
│       ├── completion-gates.js # completion gate checks
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
| verify  | 0 (no FAIL, and ready with `--must-pass`) | 1 (FAIL, strict WARN, or blocked gate) |
| completion-status | 0 (`ready`) | 1 (`blocked`)             |
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
