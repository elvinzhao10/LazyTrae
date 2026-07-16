# State and validation

LazyTrae keeps durable workflow data under `.lazytrae/`. These records make a
task resumable, but they are local state, not proof of a host session or a
completed feature.

## State artifacts

`.lazytrae/state/boulder.json` stores work, task status, blockers, evidence
paths, and the active work reference. `active-loop.json` records a durable
loop lifecycle. `sessions.json` stores session information. Plans, evidence,
and loop artifacts live in `.lazytrae/plans/`, `.lazytrae/evidence/`, and
`.lazytrae/loop/`. The schemas in `.lazytrae/schemas/` define the supported
state shapes.

`lazytrae.mark_task_done` requires existing non-empty evidence paths before it
changes task status. It does not run tests or prove an MCP connection. The
artifact-level inventory is in [State artifact reference](reference/state-artifact-reference.md).

## Date-time validation

`doctor` validates the state files against their schemas and versions. The
validator uses `ajv-formats`, so RFC3339 `date-time` fields are actually
enforced rather than silently ignored. Invalid JSON, an invalid schema, a
version mismatch, or an invalid timestamp fails the relevant state validation.

State paths must remain inside the project-owned locations. See [MCP lifecycle](07b-mcp-lifecycle.md)
for how a connected core server reads and updates these records.
