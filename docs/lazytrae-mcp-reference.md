# LazyTrae MCP Reference

> **v0.8 — MCP and Tool Integration.** Part of the v0.x series.

## MCP Architecture

LazyTrae's MCP server is a pure Node.js stdio JSON-RPC server implementing the Model Context Protocol (MCP) specification. It runs inside Trae IDE as a child process, communicating via stdin/stdout.

### How Trae Discovers MCP

Trae reads `.trae/mcp.json` at project root. When a `lazytrae` server entry is configured with `command` and `args`, Trae spawns the process and connects to it via stdio JSON-RPC. The server responds to `initialize` and `tools/list` requests, and Trae makes the tools available to agents.

### How to Start the MCP Server Manually

```bash
# Start the server directly (for testing)
node packages/mcp/src/index.js
```

The server listens on stdin for JSON-RPC requests and responds on stdout. All startup messages go to stderr.

### Protocol

LazyTrae implements MCP JSON-RPC 2.0 over stdio, protocol version `2024-11-05`. No external MCP SDK dependency is required — the protocol is implemented directly using Node.js built-in modules.

```
Request (stdin):  {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lazytrae.get_boulder_status","arguments":{}}}
Response (stdout): {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"..."}]}}
```

## MCP Tool Reference

All 15 tools follow the `lazytrae.` namespace convention. Read tools do not mutate state. Write tools use file-based locks for concurrent safety. Context tools label their results as `heuristic` or `project-tool-backed`; they do not claim semantic codegraph or LSP precision.

### 1. lazytrae.get_active_plan

Read `.lazytrae/state/boulder.json`, return active plan name, plan path, task list with statuses.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | None |
| Returns | `{ active_work_id, active_plan, plan_name, plan_path, status, tasks: [{ index, id, description, status, evidence_paths }], blocker_count }` |
| Error | `{ error: "boulder.json not found" }` if no boulder state |

### 2. lazytrae.get_boulder_status

Read `.lazytrae/state/boulder.json`, return summary of all works, tasks, and blockers.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | None |
| Returns | `{ active_work_id, work_count, works: [{ work_id, plan_name, status, total_tasks, completed, pending, in_progress, blocked, failed, blockers }] }` |
| Error | `{ error: "boulder.json not found" }` if no boulder state |

### 3. lazytrae.get_next_task

Read `.lazytrae/state/boulder.json`, find the first task with status "pending" or "in_progress".

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | None |
| Returns | `{ work_id, plan_name, next_task: { index, id, description, status }, remaining_pending, active_blockers }` |
| Note | If no pending tasks but one is in_progress, returns `in_progress_task` instead |

### 4. lazytrae.record_evidence

Record verification evidence. Writes to `.lazytrae/evidence/{gate_type}.md`.

| Property | Value |
| --- | --- |
| Type | Write (appends to evidence file) |
| Parameters | `gate_type` (required): `plan_reread` \| `automated_verification` \| `manual_qa` \| `adversarial_qa` \| `cleanup` |
| | `commands` (optional): Array of `{ command, description, expected_exit_code }` |
| | `outputs` (optional): Array of command output strings |
| | `exit_status` (optional): Map of command index to exit code |
| | `changed_files` (optional): Array of file paths |
| | `manual_checks` (optional): Array of `{ scenario, channel, invocation, expected, actual, verdict }` |
| | `reviewer_findings` (optional): Array of `{ category, finding, severity }` |
| | `verdict` (optional): `pass` \| `fail` \| `blocked` |
| | `notes` (optional): Additional notes |
| Returns | `{ recorded: true, gate_type, file, file_path, timestamp, verdict }` |

### 5. lazytrae.mark_task_done

Mark a task as complete. **Refuses to mark complete without evidence** (core LazyTrae principle).

| Property | Value |
| --- | --- |
| Type | Write (mutates boulder.json, appends evidence) |
| Parameters | `task_index` (optional): Zero-based index of the task |
| | `task_description` (optional): Task description to match |
| | `evidence_summary` (required for success): Summary of evidence |
| Returns | `{ marked_complete: true, work_id, task_id, task_index, task_description, completed_at, evidence_paths }` |
| Error (no evidence) | `{ error: "EVIDENCE_REQUIRED", message: "...", task_id, current_status }` |
| Error (already complete) | `{ error: "Task ... is already complete" }` |
| Mutex | File-based lock on boulder.json |

### 6. lazytrae.add_blocker

Add a blocker to the active work. If `task_index` is provided, also blocks that task.

| Property | Value |
| --- | --- |
| Type | Write (mutates boulder.json) |
| Parameters | `reason` (required): Reason for the blocker |
| | `task_index` (optional): Zero-based index of the task to block |
| | `severity` (optional): `pass` \| `info` \| `warning` \| `fail` |
| Returns | `{ blocker_added: true, blocker: { reason, severity, occurred_at, task_id }, work_id, total_blockers }` |
| Mutex | File-based lock on boulder.json |

### 7. lazytrae.request_review

Create a review request entry in `.lazytrae/evidence/oracle-review.md`. Does **NOT** perform the review — that is the Oracle agent's job.

| Property | Value |
| --- | --- |
| Type | Write (appends to oracle-review.md) |
| Parameters | `review_type` (required): `plan_reread` \| `adversarial_qa` \| `full` |
| | `context` (optional): Description of what was implemented |
| | `files_changed` (optional): Array of file paths |
| | `task_id` (optional): Task ID being reviewed |
| Returns | `{ review_requested: true, review_type, file, timestamp, task_id, message }` |

### 8. lazytrae.generate_handoff

Read boulder.json, active-loop.json, evidence directory. Return a handoff summary matching the CLI `lazytrae handoff` command format.

| Property | Value |
| --- | --- |
| Type | Read-only (also writes handoff.md for persistence) |
| Parameters | None |
| Returns | `{ session_id, handoff_date, what_was_accomplished, current_state, evidence_produced, remaining_gaps, blockers, next_prompt }` |

### 9. lazytrae.get_parity_status

Read `docs/lazytrae-parity-ledger.md`, parse summary table. Same logic as `packages/cli/src/lib/parity-check.js`.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | None |
| Returns | `{ present: true, total, complete, design, gap, deferred, na, coverage_percentage, categories }` |
| Error | `{ error: "Parity ledger not found" }` if ledger file missing |

### 10. lazytrae.symbol_search

Heuristic local text search for a symbol or string across project files.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | `query` (required), `limit` (optional) |
| Returns | `{ provenance: "heuristic", query, results: [{ file, line, preview }] }` |

### 11. lazytrae.find_references

Heuristic local reference search for a symbol.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | `symbol` (required), `limit` (optional) |
| Returns | `{ provenance: "heuristic", symbol, references: [{ file, line, preview }] }` |

### 12. lazytrae.goto_definition

Heuristic JavaScript/TypeScript-style definition search. Returns `no_result` instead of throwing when no definition is found.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | `symbol` (required), `limit` (optional) |
| Returns | `{ provenance: "heuristic", symbol, results, no_result }` |

### 13. lazytrae.diagnostics

Detects project-native diagnostic commands without running them.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | `run` (reserved; currently reports commands only) |
| Returns | `{ provenance: "project-tool-backed", executed: false, commands, note }` |

### 14. lazytrae.docs_lookup

Project-backed lookup across local README, package metadata, and `docs/`.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | `query` (required), `limit` (optional) |
| Returns | `{ provenance: "project-tool-backed", query, results: [{ file, line, preview }] }` |

### 15. lazytrae.dependency_graph

Heuristic file-level import graph and reverse text references.

| Property | Value |
| --- | --- |
| Type | Read-only |
| Parameters | `path` (required), `limit` (optional) |
| Returns | `{ provenance: "heuristic", path, imports, reverse_references, missing }` |

## Optional MCP Server Templates

The following optional MCP servers are configured in `.trae/mcp.json` with `required: false`. They degrade gracefully when not installed.

| Server | Purpose | Source |
| --- | --- | --- |
| `grep_app` | Remote code search | `https://mcp.grep.app` (mirrors LazyCodex) |
| `context7` | Documentation lookup | `https://mcp.context7.com/mcp` (mirrors LazyCodex) |
| `filesystem` | File system access | `@modelcontextprotocol/server-filesystem` |
| `git` | Git operations | `@modelcontextprotocol/server-git` |
| `playwright` | Browser automation | `@playwright/mcp` |
| `ast_grep` | Structural code search | `@ast-grep/mcp` |
| `lsp` | Language server diagnostics | `lsp-mcp` |

## Security

State tools access `.lazytrae/` state and evidence paths. Context tools read local project files for search, docs lookup, and dependency inspection, skipping large dependency/reference directories such as `.git`, `node_modules`, `reference`, and `lazycodex`. The `record_evidence` and `mark_task_done` tools only append to or update well-known paths within `.lazytrae/evidence/` and `.lazytrae/state/`.

## Graceful Degradation

When optional MCP servers are not configured or not running:
- Trae agents can still use the `lazytrae` MCP server for state management
- Filesystem, git, and browser operations fall back to built-in Trae tools
- The `lazytrae` server is the only required MCP server for LazyTrae workflow management

## Package Architecture

```
packages/mcp/
  package.json              # @lazytrae/mcp-server, bin: lazytrae-mcp
  src/
    index.js                # JSON-RPC server entry point (stdio loop)
    tools.js                # handler registry
    tool-defs.js            # 15 tool definitions
    handlers-context.js     # 6 local context handlers
    state-access.js         # State file read/write helpers (shared with CLI)
    parity.js               # Parity ledger coverage checker
```

The CLI `mcp` command (`packages/cli/src/commands/mcp.js`) is a thin wrapper that delegates to `packages/mcp/src/index.js`.
