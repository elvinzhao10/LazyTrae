# LazyTrae 1.4.1 native integration

Release preparation: 2026-11-01. Package metadata is 1.4.1; no tag, merge or publication is implied.

The current TRAE combines Agent and IDE modes. The IDE project adapter uses .trae assets; legacy work/cli adapter IDs remain compatibility identifiers. Work Skills/manual-MCP and CLI connector descriptions do not establish merged Agent-mode discovery. Hooks remain advisory in this adapter.

## Native versus portable behavior

The app owns plugin discovery, native tools, user settings, model/provider selection, permissions and live sessions. This package contributes the appropriate manifests/project assets and bridges. The shared local dashboard, verification and run ledger remain package capabilities; a working browser fallback is not native embedding. Do not start a parallel loop/scheduler or copy host settings into package state. Simple requests stay direct.

## Acceptance and release gates

- Package: version classification, load/contract checks, relevant adapter regressions and extracted-archive validation.
- Host: record exact client/build/route, verify one command/Skill, roles/hooks as applicable and six project-bound MCP connections. These model-driven tests remain deferred; absent evidence stays pending.
- Release: green CI at the exact PR head, matching 1.4.1 runtime/manifests, self-contained archives and recorded digests. Leave PRs open; do not merge, tag, dispatch publication or enable auto-merge.

See [platform audit](platform-status-2026-10-30.md) for first-party documentation, build distinctions and known limits; [host capability matrix](../10-host-capability-matrix.md) for route-specific contracts; and [release notes](../../RELEASE_NOTES.md) for the complete combined scope. Historical dated records retain their original version and observations.
