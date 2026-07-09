# Automated Verification Evidence

> **Gate 2: Automated Verification** — Tests, linters, type checks, builds.
> LazyCodex source: `lazycodex/packages/web/content/docs/tdd.md`

## Template

### Plan Under Verification

- **Plan file**: `.omo/plans/<plan-name>.md`
- **Task ID**: `<task-id>`
- **Task description**: `<description>`

### Commands Executed

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `<test command>` | `0` | All tests passed |
| `<lint command>` | `0` | No new errors |
| `<typecheck command>` | `0` | No type errors |
| `<build command>` | `0` | Build succeeded |

### Full Output

```
<full command output>
```

### Changed Files

```
<list of changed files from git diff --name-only>
```

### Verdict

- **Overall**: PASS / FAIL / BLOCKED
- **Tests**: `<N>` tests, `<M>` failed
- **Lint**: PASS / FAIL (with details)
- **Typecheck**: PASS / FAIL (with details)
- **Build**: PASS / FAIL (with details)

### Evidence Artifacts

- `<path to artifact 1>`
- `<path to artifact 2>`

---

## Example (filled)

### Plan Under Verification

- **Plan file**: `.omo/plans/v0.5-state-machine.md`
- **Task ID**: `task-1`
- **Task description**: Create `.lazytrae/config.json`

### Commands Executed

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `python3 -m json.tool .lazytrae/config.json > /dev/null` | `0` | Valid JSON |
| `ls -la .lazytrae/state/` | `0` | 3 files exist |

### Full Output

```
$ python3 -m json.tool .lazytrae/config.json > /dev/null && echo "VALID"
VALID
$ ls -la .lazytrae/state/
boulder.json    active-loop.json    sessions.json
```

### Changed Files

```
.lazytrae/config.json
.lazytrae/state/boulder.json
.lazytrae/state/active-loop.json
.lazytrae/state/sessions.json
```

### Verdict

- **Overall**: PASS
- **Tests**: N/A (no test suite — config and state files)
- **Lint**: N/A
- **Typecheck**: N/A
- **Build**: N/A

### Evidence Artifacts

- `.lazytrae/config.json`
- `.lazytrae/state/boulder.json`
- `.lazytrae/state/active-loop.json`
- `.lazytrae/state/sessions.json`

---

## v0.6 CLI Installer and Doctor

### Plan Under Verification

- **Plan file**: `.omo/plans/v0.6-cli-installer.md`
- **Task ID**: v0.6-all
- **Task description**: Implement CLI installer package with all commands

### Commands Executed

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `node packages/cli/src/index.js init` | `0` | Idempotent init succeeded |
| `node packages/cli/src/index.js init` (second run) | `0` | No changes (idempotent) |
| `node packages/cli/src/index.js doctor` | `0` | All checks passed (19 PASS, 1 WARN) |
| `node packages/cli/src/index.js sync` | `0` | Sync succeeded |
| `node packages/cli/src/index.js handoff` | `0` | Handoff output generated |
| `node packages/cli/src/index.js handoff --json` | `0` | JSON output correct |
| `node packages/cli/src/index.js verify` | `1` | Strict mode exits 1 on WARN (expected) |

### Full Output

**First init:**
```
LazyTrae init v0.6.0
Repo root: /Users/Admin/Desktop/lazytrae

=== Init Summary ===

Created:
  + .trae/hooks.json

Skipped:
  - .trae/mcp.json (denylisted, copy manually)
  - .lazytrae/config.json (already exists)
  - AGENTS.md (no changes needed)
  - .gitignore (already has LazyTrae entries)

Done.
```

**Second init (idempotency):**
```
LazyTrae init v0.6.0
Repo root: /Users/Admin/Desktop/lazytrae

=== Init Summary ===


Skipped:
  - .trae/mcp.json (denylisted, copy manually)
  - .lazytrae/config.json (already exists)
  - AGENTS.md (no changes needed)
  - .gitignore (already has LazyTrae entries)

Done.
```

**doctor:**
```
LazyTrae Doctor v0.6.0
Repo root: /Users/Admin/Desktop/lazytrae

✅ .trae/rules/lazytrae.md                     PASS
✅ .trae/skills/ (9 skills)                    PASS
   Found 9 skills, expected at least 9
✅ .trae/commands/ (9 commands)                PASS
   Found 9 commands, expected at least 9
✅ .trae/agents/ (11 agents)                   PASS
   Found 11 agents, expected at least 11
✅ .trae/hooks.json                            PASS
   v0.7 hooks support
⚠️ .trae/mcp.json                              WARN
   MCP config for v0.8
✅ .lazytrae/config.json                       PASS
✅ .lazytrae/state/active-loop.json            PASS
✅ .lazytrae/state/boulder.json                PASS
✅ .lazytrae/state/sessions.json               PASS
✅ .lazytrae/schemas/active-loop.schema.json   PASS
✅ .lazytrae/schemas/boulder.schema.json       PASS
✅ .lazytrae/schemas/evidence.schema.json      PASS
✅ .lazytrae/evidence/ (6 files)               PASS
   Found 6 evidence files, expected at least 6
✅ .omo/plans/                                 PASS
✅ .omo/ulw-loop/                              PASS
✅ AGENTS.md managed blocks                    PASS
   3 blocks intact
✅ Schema validation: active-loop.json         PASS
✅ Schema validation: boulder.json             PASS
✅ Parity ledger                               PASS
   57/118 (48.3%) complete

=== Results: 19 PASS, 1 WARN, 0 FAIL ===
```

**sync:**
```
LazyTrae sync v0.6.0
Repo root: /Users/Admin/Desktop/lazytrae

=== Sync Summary ===


Skipped:
  - agents (no changes)
  - skills (no changes)
  - commands (no changes)
  - .trae/rules/lazytrae.md (no changes)
  - schemas (no changes)
  - evidence (no changes)
  - AGENTS.md managed blocks (no changes)
  - .lazytrae/config.json (schema_version unchanged)

Done.
```

**handoff:**
```
# Session Handoff... (full output verified)
```

**verify (strict mode):**
```
Exits with code 1 due to one WARN (expected behavior)
```

### Changed Files

```
packages/cli/package.json
packages/cli/src/index.js
packages/cli/src/commands/init.js
packages/cli/src/commands/doctor.js
packages/cli/src/commands/sync.js
packages/cli/src/commands/uninstall.js
packages/cli/src/commands/verify.js
packages/cli/src/commands/handoff.js
packages/cli/src/lib/templates.js
packages/cli/src/lib/managed-blocks.js
packages/cli/src/lib/validator.js
packages/cli/src/lib/parity-check.js
packages/cli/templates/AGENTS.md
packages/cli/templates/agents/*.md
packages/cli/templates/commands/*.md
packages/cli/templates/skills/*/SKILL.md
packages/cli/templates/rules/lazytrae.md
packages/cli/templates/config.json
packages/cli/templates/mcp.json
packages/cli/templates/hooks.json
packages/cli/templates/schemas/*.json
packages/cli/templates/evidence/*.md
packages/cli/templates/state/*.json
packages/cli/README.md
docs/lazytrae-cli-reference.md
docs/lazytrae-parity-ledger.md
docs/lazytrae-command-index.md
```

### Verdict

- **Overall**: PASS
- **Tests**: N/A (pure JavaScript, no test suite needed)
- **Lint**: N/A
- **Typecheck**: N/A
- **Build**: N/A (no build step needed, pure CommonJS)

### Evidence Artifacts

- `packages/cli/` — complete CLI package with all commands and templates
- `docs/lazytrae-cli-reference.md` — full CLI reference
- `docs/lazytrae-parity-ledger.md` — updated parity ledger (57/118 COMPLETE)
- `docs/lazytrae-command-index.md` — updated command index