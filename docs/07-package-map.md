# Package map

This map explains what LazyTrae copies and what stays outside the project. It
is a package inventory, not proof that Trae has discovered the files. Verify a
selected host separately through [Host routes](reference/host-routes.md).

| Location | Contents | Learner use |
| --- | --- | --- |
| `.trae/` | Project skills, commands, agents, rules, hooks, and MCP declaration. | Host-facing workflow configuration. |
| `.trae/skills/` | 17 `lazy-` skills. | Match a workflow to a task. |
| `.trae/commands/` | 9 `lazy-` command definitions. | Start common guided workflows. |
| `.trae/agents/` | 11 specialist roles. | Separate planning, exploration, execution, and review responsibilities. |
| `.trae/hooks.json` and `.trae/hooks/` | Five events and eight local scripts. | Advisory context and evidence reminders. |
| `.trae/mcp.json` | One core MCP declaration plus seven disabled placeholders. | Declares capability; connection still requires host observation. |
| `.lazytrae/config.json` and `schemas/` | Configuration and state validation definitions. | Package defaults and durable-state structure. |
| `.lazytrae/state/` | Boulder, active-loop, and session state. | Resume structured work. |
| `.lazytrae/evidence/` | Evidence templates and records. | Support verification and handoff. |
| `.lazytrae/plans/`, `.lazytrae/loop/` | Plans and per-run artifacts. | Keep long-running work recoverable. |
| `packages/cli/` | Installer, doctor, verification, lifecycle, tooling, MCP launcher. | The companion command implementation. |
| `packages/mcp/` | Node stdio MCP implementation. | The 15-tool core server used by `lazytrae mcp`. |
| `packages/cli/templates/` | Source of truth for copied project assets. | Package contributors keep these template mirrors aligned. |

## Templates and managed content

Initialization copies canonical templates into `.trae/` and `.lazytrae/`, adds
runtime ignores, and merges managed blocks into `AGENTS.md` without overwriting
unrelated user content. `sync` updates managed templates and managed blocks
while preserving unrelated caller MCP entries and explicit managed optional
selections. This is why changes to templates and copied project assets should
be interpreted through receipt ownership rather than by directory name alone.

The CLI tarball contains the CLI, local MCP implementation, templates,
package-local license and notice, and its production dependency closure. A cold
offline install validates that artifact, but still does not show a host session
or a live MCP connection.

## Component relationships

```text
templates ──init/sync──> .trae + .lazytrae ──loaded by──> selected Trae host
                                  │                         │
                                  └── evidence/state <── core MCP after connection
companion CLI ── doctor / verify / lifecycle / tooling ────┘
```

Use [Workflow playbooks](04-workflow-playbooks.md) to choose among the
components and [Safe removal](08-safe-removal.md) before deleting any of them.
The durable files are detailed in [State and validation](07a-state-and-validation.md);
the MCP configuration is detailed in [MCP lifecycle](07b-mcp-lifecycle.md).

## Trace one request through the code

Start with `packages/cli/src/index.js`: it routes a CLI request to a command.
`init` and `sync` read from `packages/cli/templates/`, then use managed-block,
path-boundary, and safe-write helpers before changing a project. A template is
therefore not copied blindly: managed content can be refreshed while unknown
caller content, linked paths, and host-managed registration remain out of scope.

`doctor` reads resulting state through `validator.js`. The five state schemas
are kept identical between the package mirror and install templates, so an idle
project and a freshly installed project validate the same way. Study those
schemas to see how optional recovery detail is tolerated while required
identifiers, counters, and timestamps remain checked.

The CLI launches a package-local stdio MCP implementation rather than importing
files from a checkout. The MCP server dispatches a fixed tool inventory,
validates project-relative paths, and returns JSON-RPC errors rather than
terminating its stream on malformed input. Packed-install tests prove this
closure; a host connection is still a separate, deliberately unproven layer.

For trusted package-owned tooling commands, timeout cleanup is best effort: an
owned process group is signaled, but a deliberately detached descendant is not
represented as an impossible cleanup guarantee. This is lifecycle cleanup, not
a sandbox; use a VM or container when the command itself is untrusted.
