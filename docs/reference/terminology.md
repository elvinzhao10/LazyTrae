# Terminology

| Term | Meaning |
| --- | --- |
| **Package readiness** | Local evidence that canonical assets and declarations are present; not proof of host loading or connection. |
| **Host observation** | What a person sees after reopening, reloading, registering, or starting the selected Trae surface. |
| **Companion command** | Installed `lazytrae` CLI that supplies installation, verification, lifecycle, tooling, and `lazytrae mcp`. |
| **Core MCP server** | The single executable local `lazytrae` stdio server; after connection it exposes 15 tools. |
| **Disabled placeholder** | One of seven non-base MCP declarations that does not run until explicitly selected/configured. |
| **Skill** | Workflow guidance matched to a task such as planning, debugging, or verification. |
| **Command** | A `lazy-` slash-command entry point for a common workflow. |
| **Agent definition** | A specialist role such as Explorer, Prometheus, Atlas, or Oracle. |
| **Hook** | Local script run on a configured event. LazyTrae hooks are advisory and always exit zero. |
| **Boulder state** | Durable plan/task state used for stepwise execution and blockers. |
| **Evidence gate** | A planned check: plan reread, automated verification, manual QA, adversarial QA, or cleanup. |
| **Receipt-owned** | An asset LazyTrae may safely remove because its exact lifecycle/receipt identifies it as package-owned. |
| **Caller-owned** | An asset controlled by the project/operator, such as a CodeGraph project index; LazyTrae preserves it. |
| **Local-first** | Prefer local search and read-only capabilities before optional remote services. |
| **Persistent compatibility** | An explicit `tooling enable` choice that writes a managed namespaced MCP selection. |
| **Approval boundary** | Actions that require an operator decision, budget, or prompt, especially remote, metered, authenticated, destructive, or secret-related work. |
| **Package-built capability** | Behavior implemented and shipped by LazyTrae, such as CLI commands, templates, safe writes, receipts, or the core MCP process. |
| **Host-native capability** | Behavior owned by TraeCode, Work, or CLI, such as discovery, session lifecycle, registration, connector launch, and credential storage. |
| **Base MCP declaration** | A package-shipped core/placeholder entry; it becomes a usable endpoint only when a host starts and connects it. |
| **Tooling dependency** | A pinned local fallback placed only in a receipt-owned root, not a dependency added to the target project. |

For component locations, see [Package map](../07-package-map.md). For proof
boundaries, see [Verification contract](verification-contract.md). For removal,
see [Safe removal](../08-safe-removal.md).

## How to read these terms in the code

Start with **package readiness**, **host observation**, and **base MCP
declaration** for an install or connection route. Then use **receipt-owned**,
**caller-owned**, and **host-native capability** to decide whether a command
may write or remove a path. Finally, use **evidence gate** and **Boulder state**
when following a workflow to completion. This mirrors package facts, host
boundaries, and outcome claims in that order.
