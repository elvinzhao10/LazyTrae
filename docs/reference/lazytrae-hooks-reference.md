# LazyTrae Hooks Reference

> **v0.7 — Hooks and Enforcement.** Part of the v0.x series.
> This document describes the LazyTrae hook system, hook event lifecycle, and the PostCompact gap mitigation strategy.

## Overview

LazyTrae uses Trae's native hook system to approximate historical source record's lifecycle enforcement. Hooks provide:

- Durable state persistence across sessions — nudges Trae back to unfinished work
- Sanity checks (write-before-read warning, destructive git command warning)
- AI-slop comment detection on edits
- Post-compact recovery for context compaction
- Keyword detection for workflow commands

All hooks follow one invariant: **always exit 0**. They never block Trae operations — they only provide warnings and reminders.

No network calls from any hook. All operations are pure local file I/O.

## Hook Event Lifecycle

Trae fires 6 hook events. LazyTrae implements 5 of them directly. The sixth (Notification) is available for future use.

| Trae Event | LazyTrae Hook | Purpose | historical source record Equivalent |
| --- | --- | --- | --- |
| **SessionStart** | `.trae/hooks/session-start.sh` | Reads `boulder.json`, `active-loop.json`, `sessions.json`. Outputs active plan name, current task, blockers, next action, active loop goal/iteration. Checks for post-compact recovery and emits recovery notice if needed. | `SessionStart` — rules loading, bootstrap, state check |
| **UserPromptSubmit** | `.trae/hooks/user-prompt-submit.sh` | Detects keywords: `ulw`, `ultrawork`, `start-work`, `ulw-loop`, `handoff`, `stop-continuation`, `ralph-loop`. Emits skill-loading hint if detected. Checks for context-pressure markers (compaction warnings) and sets `post_compact_recovery_needed=true` in `sessions.json`. Detects ulw-loop steering directives. | `UserPromptSubmit` — rules re-injection, ultrawork trigger detection, ulw-loop steering |
| **PreToolUse** | `.trae/hooks/pre-tool-use.sh` | Warns on write-before-read heuristic (checks if target file was read in `read_history` before edit/write). Warns on destructive git commands (`push --force`, `reset --hard`, `clean -f`, `branch -D`). | `PreToolUse` — git bash MCP guidance, ulw-loop goal budget protection |
| **PostToolUse** | `.trae/hooks/post-tool-use.sh` | Records changed file path in `sessions.json` `changed_files` for current session. If changed file is a code file (.ts/.js/.py/.rs), runs comment-checker for obvious AI-slop patterns (e.g., `// This function does X`, `// TODO: implement`). Captures exit code from `RunCommand` tool and reports non-zero exit codes. | `PostToolUse` — comment checker, rule matching, changed file tracking |
| **Stop** | `.trae/hooks/stop.sh` | Checks `boulder.json` for incomplete tasks (pending/in_progress) and emits continuation reminder with next task. Checks `active-loop.json` for in-progress goal and emits loop continuation prompt. | `Stop/SubagentStop` — start-work continuation, evidence verification |
| **Notification** | (not implemented) | Async, non-blocking (for tool call waiting for confirmation, or task complete). Available for future use. | — |

## What Each Hook Does

### session-start.sh

**Purpose:** On session start, remind the agent what work is active and what to do next.

**Behavior:**

1. Reads `.lazytrae/state/boulder.json` — extracts `active_work_id`, finds the work, lists the current task (in_progress first, then pending, then blocked), counts blockers.
2. Reads `.lazytrae/state/active-loop.json` — finds the in-progress goal and iteration count.
3. Checks `.lazytrae/state/sessions.json` for `post_compact_recovery_needed` flag. If true:
   - Emits recovery notice: "Post-compact recovery needed. Re-injecting project rules and state context."
   - Resets the flag to `false`.
4. Prints all collected info to stdout.
5. Always exits 0.

**Key implementation note:** Post-compact recovery is handled here because Trae has no PostCompact event. See §PostCompact Gap Mitigation below.

---

### user-prompt-submit.sh

**Purpose:** Detect workflow keywords in user prompt and emit hints. Detect context compaction for post-compact recovery.

**Behavior:**

1. Reads prompt from stdin (hook event JSON).
2. If prompt contains `ultrawork` or `ulw` (case-insensitive), emits hint to load ultrawork directive via ulw-plan/ulw-loop skill.
3. If prompt contains any of the LazyTrae command keywords (`ulw-loop`, `start-work`, `ulw-plan`, `handoff`, `stop-continuation`, `ralph-loop`, `init-deep`, `review-work`, `remove-ai-slops`), emits hint that the skill should be loaded.
4. If prompt contains an ulw-loop steering directive (`OMO_ULW_LOOP_STEER`, `workflow.ulw-loop.steer`, `workflow ulw-loop steer`), emits note that it will be processed by the loop engine.
5. If prompt contains any context-pressure markers (mirroring historical source record `context-pressure.ts`):
   - `context compacted`
   - `context_length_exceeded`
   - `skill descriptions were shortened`
   - `context_too_large`
   - `codex ran out of room`
   - `your input exceeds the context window`
   - `long threads and multiple compactions`
   
   Then:
   - Emits note: "Context pressure detected. Setting post-compact recovery flag."
   - Sets `post_compact_recovery_needed=true` in `.lazytrae/state/sessions.json`, increments compaction count.
6. Always exits 0.

---

### pre-tool-use.sh

**Purpose:** Warn the agent before potentially dangerous operations.

**Behavior:**

1. Reads tool call metadata from stdin (JSON).
2. Extracts `tool_name`.
3. If tool is an edit/write/delete operation (`write`, `edit`, `multiedit`, `multi_edit`, `apply_patch`, `delete_files`):
   - Emits warning: "Edit/write operation detected. Ensure target file was read first."
   - Note: Full write-before-read enforcement isn't possible in Trae (no hashline system like Codex), so this is just a heuristic reminder.
4. If tool is a shell/command tool (`bash`, `shell_command`, `exec_command`, `RunCommand`):
   - Extracts the command from `tool_input.command`.
   - If command matches a destructive git pattern (`push --force`, `reset --hard`, `clean -f`, `branch -D`, etc.), emits warning: "WARNING: Destructive git command detected. Verify this is intentional before proceeding."
5. Always exits 0.

---

### post-tool-use.sh

**Purpose:** Track changed files, check for AI-slop comments, capture non-zero exit codes.

**Behavior:**

1. Reads tool call metadata from stdin (JSON).
2. Only processes edit/write/delete tools (same pattern as pre-tool-use).
3. Extracts changed file paths from common fields (`filePath`, `path`, `target`, `filePaths`, etc.).
4. If `current_session_id` is set in `sessions.json`, appends the changed file paths to the session's `changed_files` array.
5. For each changed file that has a code extension (.ts, .js, .py, .rs, .go, .java, .kt, .tsx, .jsx, .mjs, .cjs):
   - Greps for common AI-slop comment patterns:
     - `// This function does`
     - `// This class represents`
     - `// This file contains`
     - `// TODO: implement`
     - `// TODO: remove`
     - `// removed code here`
     - Same patterns with `#` prefix for Python/Ruby
     - `// FIXME: implement`
   - Prints matching line numbers to stdout as a warning.
6. If tool is a shell/command tool and response contains a non-zero exit code, prints the exit code to stdout.
7. Always exits 0.

---

### stop.sh

**Purpose:** Prevent false completion claims when work is still incomplete.

**Behavior:**

1. Reads `boulder.json` — if there's an active work with incomplete tasks (pending or in_progress):
   - Counts the incomplete tasks.
   - Emits a continuation reminder with the next task description.
   - Notes how to resume (`paste handoff summary` or `lazytrae handoff`).
2. Reads `active-loop.json` — if there's an in-progress goal:
   - Emits a continuation reminder with goal title and iteration.
   - Notes how to continue (`ulw-loop` or `start-work`).
3. If everything is complete, outputs nothing.
4. Always exits 0.

## PostCompact Gap Mitigation

### The Gap

historical source record has a `PostCompact` hook event that fires after context compaction. historical source record uses this to:
- Reset caches (project rule cache, LSP diagnostics cache, git bash MCP reminder cache)
- Re-inject project rules after compaction

**Trae does not have a PostCompact hook event.** This is a known platform gap documented in `docs/lazytrae-architecture-plan.md`.

### The Mitigation

LazyTrae uses a two-part detection strategy:

1. **UserPromptSubmit detection:** When the user submits a prompt, check if the prompt text contains any context-pressure markers (the messages Trae outputs when compaction happens). If detected, set `post_compact_recovery_needed=true` in `sessions.json`.

2. **SessionStart check:** When a new session starts, check if `post_compact_recovery_needed` is `true` in `sessions.json`. If true:
   - Emit the recovery notice
   - Reset the flag to `false`

The recovery notice reminds the agent to re-read the project rules (AGENTS.md) and state context, which accomplishes the same goal as historical source record's PostCompact hook.

### State Changes

| Event | Action on `post_compact_recovery_needed` |
| --- | --- |
| Context pressure marker in prompt | Set to `true` |
| SessionStart when flag is `true` | Emit notice, set to `false` |

## Hook Configuration Format

Trae's `hooks.json` format (used by Trae IDE):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bash \"${PROJECT_DIR}/.trae/hooks/session-start.sh\"",
        "timeout": 10
      }
    ],
    ...
  },
  "lazytrae": {
    "version": "v0.7",
    "note": "LazyTrae hooks...",
    "safety": "All hooks exit 0 always...",
    "postcompact_gap": "..."
  }
}
```

LazyTrae `hooks.json` uses the array format (multiple commands per event) which is the Trae-recommended format.

## Hook Safety Rules

All LazyTrae hooks follow these safety rules:

1. **Always exit 0** — hooks never block Trae. Warnings are informational only.
2. **No network calls** — all operations are local file I/O.
3. **No state mutation except where documented** — only `sessions.json` is mutated (for `post_compact_recovery_needed` and `changed_files`).
4. **Handle missing files gracefully** — if state files don't exist yet, just output defaults and continue.
5. **All node calls are error-handled** — syntax errors or missing files don't break the hook.
6. **Timeouts are conservative** — 10 seconds for most hooks, 30 seconds for post-tool-use.

## Structural Limitation: Non-Blocking Hooks

**This is the defining structural deficit of LazyTrae compared to historical source record**

historical source record hooks can block tool execution — the Stop hook can prevent session termination if evidence gates haven't passed, PreToolUse can deny destructive operations, and PostToolUse can reject edits that fail quality checks. This is how historical source record mechanically enforces its evidence gate and quality bar.

Trae hooks **cannot block**. All hooks exit 0 unconditionally. The `Stop` hook can only print a continuation reminder — the user can always dismiss it and end the session. This means:

- The evidence/completion gate is **advisory**, not enforced.
- A user can always end a session without passing verification gates.
- Quality enforcement depends on agent discipline, not platform mechanics.

**Mitigation**: The reviewer/Oracle protocol and the ulw-loop skill both emphasize that completion claims without evidence are invalid. The hooks provide reminders, and the agent instructions require evidence. But this is a **soft enforcement** — it relies on the agent following instructions, not on the platform blocking bad behavior.

**Risk**: R-012 (PostCompact gap) and R-015 (non-blocking hooks) in `docs/lazytrae-risk-register.md`.

**Unfixable without Trae platform change**: Trae would need to support non-zero exit codes in hooks to block operations. This is not currently available.

## Testing Hooks with Fixtures

LazyTrae includes test fixtures in `packages/cli/test/fixtures/`:

| Fixture | Purpose | Test Command |
| --- | --- | --- |
| `session-start.json` | Empty SessionStart | `cat packages/cli/test/fixtures/session-start.json \| node packages/cli/src/index.js hook session-start` |
| `user-prompt-submit.json` | User prompt with "ulw" keyword | `cat packages/cli/test/fixtures/user-prompt-submit.json \| node packages/cli/src/index.js hook user-prompt-submit` |
| `pre-tool-use-edit.json` | PreToolUse for Write | `cat packages/cli/test/fixtures/pre-tool-use-edit.json \| node packages/cli/src/index.js hook pre-tool-use` |
| `pre-tool-use-git.json` | PreToolUse for destructive git | `cat packages/cli/test/fixtures/pre-tool-use-git.json \| node packages/cli/src/index.js hook pre-tool-use` |
| `post-tool-use-edit.json` | PostToolUse after Write | `cat packages/cli/test/fixtures/post-tool-use-edit.json \| node packages/cli/src/index.js hook post-tool-use` |
| `stop-incomplete.json` | Stop with incomplete work | `cat packages/cli/test/fixtures/stop-incomplete.json \| node packages/cli/src/index.js hook stop` |
| `stop-complete.json` | Stop with all complete | `cat packages/cli/test/fixtures/stop-complete.json \| node packages/cli/src/index.js hook stop` |

## CLI Hook Dispatcher

The `lazytrae hook <event-name>` CLI command:

```bash
# Dispatch with JSON from stdin
cat fixture.json | lazytrae hook session-start

# Or with prompt as argument
lazytrae hook user-prompt-submit "ulw: implement this feature"
```

The dispatcher:

1. Validates the event name against the list of valid events.
2. Finds the script in `.trae/hooks/<event-name>.sh`.
3. Checks that the script exists and is executable.
4. Passes stdin through to the script.
5. Captures stdout/stderr and writes to parent stdout/stderr.
6. If the script fails for any reason, logs a warning but still exits 0 (hooks must not block).

## Parity with historical source record

| historical source record Hook Component | LazyTrae Equivalent | Status |
| --- | --- | --- |
| SessionStart hook | `.trae/hooks/session-start.sh` | COMPLETE |
| UserPromptSubmit hook | `.trae/hooks/user-prompt-submit.sh` | COMPLETE |
| PreToolUse hook | `.trae/hooks/pre-tool-use.sh` | COMPLETE |
| PostToolUse hook | `.trae/hooks/post-tool-use.sh` | COMPLETE |
| Stop/SubagentStop hook | `.trae/hooks/stop.sh` | COMPLETE |
| PostCompact hook | (gap) — SessionStart + UserPromptSubmit detection | GAP (mitigated) |
| Comment checker | Built into post-tool-use.sh (grep patterns) | COMPLETE |
| Ultrawork trigger detection | Built into user-prompt-submit.sh | COMPLETE |
| Ulw-loop steering detection | Built into user-prompt-submit.sh | COMPLETE |
| Context pressure detection | Built into user-prompt-submit.sh | COMPLETE |
| Dynamic rule matching | (simplified) — changed file tracking in sessions.json | COMPLETE (simplified) |
| Tool path extraction | Built into post-tool-use.sh | COMPLETE |
| Event budget | (not needed in shell script approach) | N/A |
| Transcript search | (not needed in Trae hook model) | N/A |

## References

- historical source record source: historical source record
- historical source record rules component: historical source record
- historical source record comment-checker: historical source record
- historical source record ultrawork: historical source record
- historical source record ulw-loop steering: historical source record
- Architecture: `docs/lazytrae-architecture-plan.md` §2.5, §4
- Parity ledger: `docs/lazytrae-parity-ledger.md`
- State machine: `docs/lazytrae-state-machine.md`

## Changelog

- **v0.7** — Initial implementation of all five main hooks. PostCompact gap mitigated via SessionStart/UserPromptSubmit detection.
