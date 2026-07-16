# Test and release verification

Verification should state exactly what was checked. Package tests establish
local behavior; the chosen Trae host and requested user outcome still need
their own observation.

## Package checks

Use `lazytrae load-check --host <host>` for copied assets and declarations,
`lazytrae doctor` for local health and state validation, and `lazytrae verify
--must-pass` when the task needs the CLI completion gate. Focused Node tests
cover templates, CLI lifecycle, state validation, JSON-RPC behavior, MCP
package parity, receipt-safe removal, and Work skill handling.

The package distribution is also tested through a cold offline installation.
That clean-install layer proves the tarball carries its local MCP implementation
and dependencies without a source checkout. It does not establish host
discovery, a running session, or a connection.

## Release evidence boundary

Normal CI is self-contained and does not require a sibling repository. Any
release-only paired parity is explicitly supplied evidence, not an installation
or runtime dependency. The macOS CI readiness workflow runs package checks and
inspection; it does not publish, tag, or modify a remote.

For host observations, use [Host capability matrix](10-host-capability-matrix.md).
For a compact claim vocabulary, read [Verification contract](reference/verification-contract.md).
