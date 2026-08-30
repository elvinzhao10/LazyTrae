# CodeBuddy long-horizon service adapters

LazyTrae does not bundle the CodeBuddy daemon, background, serve, or prewarm
service adapter. Those host-specific surfaces belong to LazyBuddy. TraeCode
uses LazyTrae's existing direct and MCP routes, whose task, verification,
review, iteration, checkpoint, and receipt state remains authoritative.

This boundary is intentional: a CodeBuddy service receipt is not accepted as
LazyTrae task or completion evidence, and LazyTrae does not discover, launch,
stop, or recover CodeBuddy processes. For the LazyTrae route and evidence
contracts, see [Host routes](host-routes.md) and
[Verification contract](verification-contract.md).
