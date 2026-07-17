# Request decomposition

The workflow layer converts an open-ended request into three durable concepts: an outcome, acceptance criteria, and a proof surface. The package does not parse product intent automatically; skills and agents make these concepts explicit so later state and verification have something concrete to reference.

## Input shape

An effective workflow request has this conceptual shape:

```text
outcome: what changes for the user
constraints: scope, safety, compatibility, ownership limits
acceptance criteria: observable pass/fail conditions
proof surface: test, CLI, API, browser, or host session
```

The `lazy-ulw-plan` template teaches the planning role to preserve uncertainty as a decision rather than silently inventing it. `lazy-start-work` assumes that a plan has already identified the acceptance criteria. This is why planning and execution are separate template files and separate CLI/host actions.

## From request to records

The CLI and MCP persistence layer writes plans, tasks, blockers, evidence references, loop state, and handoffs under `.lazytrae/`. The loop and completion helpers operate on that state rather than trying to infer current work from the latest chat message. A verifier can therefore inspect the claimed outcome, named checks, and recorded result independently.

## Proof surface selection

The proof surface is intentionally not always a test suite. A library change may be proved by tests; a command requires a command invocation; a UI needs a visual/user interaction check; a host integration requires host observation. The workflow text only directs that selection. The CLI/MCP gates record package-local checks, while the person or host supplies the final surface observation.

See [Workflow playbooks](04-workflow-playbooks.md) for policy roles and [State and validation](07a-state-and-validation.md) for the persisted representation.

## Implementation handoff

The request text is interpreted by template policy first, then becomes project state only when an execution path chooses to record it. `templates/skills/` defines planning/execution expectations; `loop.js`, `run.js`, MCP handlers, and completion helpers turn those expectations into `.lazytrae` plans, task state, evidence references, and gates.

```mermaid
flowchart LR
    Prompt["request text"] --> Skill["template workflow policy"]
    Skill --> Plan["plan/acceptance criteria"]
    Plan --> State[".lazytrae task state"]
    State --> Gate["doctor + completion gate"]
    Gate --> Evidence["evidence/task record"]
```

Nothing in this flow infers success from the prompt itself. Each transition is an explicit CLI/MCP operation, host invocation, or recorded observation; that makes the result inspectable after the original conversation has ended.
