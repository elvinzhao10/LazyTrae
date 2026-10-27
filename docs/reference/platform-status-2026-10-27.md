# Trae platform status — 2026-10-27

This is a documentation and package-boundary audit for LazyTrae **1.4.0**;
not a host acceptance test. Official pages are rolling documents checked on
2026-10-27. The latest dated entry visible in the [CN TRAE changelog](https://docs.trae.cn/ide_changelog)
is 2026-10-15, covering **3.4.1–3.4.4**; it is not a claim about the newest
build in every region or edition. The October 8 entry describes 3.4.0's Agent
window, multiple project paths, scheduled/cloud tasks and SSH. The official
[CN migration announcement](https://docs.trae.cn/ide_traework-to-traecode-data-migration)
says TraeCode and TraeWork have merged into TRAE with Agent and IDE modes.
The legacy adapter names below identify package routes, not a claim that the
new product still consists of separate applications. Migration and optional
uninstall/delete-data actions are host-owned and were not performed.

Read-only local observations on this machine: `/Applications/Trae CN.app`
bundle version **3.3.99**; `/Applications/TRAE SOLO CN.app` bundle version
**0.1.63**. Both `traecli --version` and `trae-cli --version` report
`trae-cli version 0.120.52`, build date 2026-08-12 and commit
`6756e52a9238b6d493928e55b05127957dbfefb4`; both names resolve to the same
binary. These observations neither identify CLI 2.0 nor show an active host
session. No installation, migration, trust, permissions or settings were changed.

The [CLI 2.0 quick start](https://docs.trae.cn/cli_get-started-with-trae-cli-2)
documents a product generation, not a current numerical release. It says project
configuration and hooks require trust. Its [migration guide](https://docs.trae.cn/cli_get-started-with-trae-cli)
marks 1.0 as lightly maintained, explains non-destructive migration, and
changes `-p` and JSON output semantics. Do not migrate automatically or apply
1.x runner assumptions to 2.0. The separate open-source
[trae-agent](https://github.com/bytedance/trae-agent) uses `trae-cli` and YAML;
its [releases page](https://github.com/bytedance/trae-agent/releases) provided
no numbered release to pin at review time. It is not the commercial CLI route.

| Feature | Official evidence and LazyTrae boundary | Status |
| --- | --- | --- |
| Skills, commands, rules, subagents | [CN Skills](https://docs.trae.cn/ide_skills), [Subagents](https://docs.trae.cn/ide_subagents), [SOLO](https://docs.trae.cn/ide_solo-mode), and [changelog](https://docs.trae.cn/ide_changelog) document native features. CN Subagents use `.trae/agents/*.md`, are invoked only by the built-in Agent and may require the Beta setting; templates and copies are package assets. CLI 2.0 exposes `/skills` and `/plugins` ([extensions](https://docs.trae.cn/cli_tools-and-extensions)). `.traecli/` candidate output is not a native plugin installation. | Package route; discovery and execution pending per selected mode/build. |
| MCP and settings | CLI 2.0 documents `/mcp` and `~/.trae/traecli.toml` with `[mcp_servers.*]` ([config](https://docs.trae.cn/cli_config-file)); The [CN MCP guide](https://docs.trae.cn/ide_add-mcp-servers) documents project MCP enablement and distinct local/cloud Agent environments. Work's historical JSON handoff and generated IDE declaration are package routes, not universal CLI 2.0 registration. | Declaration is not connection; host settings are user-owned. |
| Hooks | [CN IDE reference](https://docs.trae.cn/ide_hook-configuration-reference) documents project `.trae/hooks.json`, stdin/stdout and blocking event decisions. LazyTrae's shipped adapter is advisory; CLI/MCP own package gates. | No claim of live delivery or native blocking; CN protocol is not global parity. |
| Lifecycle, onboarding, offboarding, recovery | Release-owned launcher, receipt-scoped mutations and plan-first removal are package functions. Unified TRAE migration is a separate host action. | Local checks do not establish host discovery or removal. |
| Automation, plans, execution and evidence | [Plan, Spec and Goal](https://docs.trae.cn/ide_built-in-workflows) and the changelog describe host workflows; LazyTrae's loop, plans and verification are independent package workflows. Presented-to-host is not execution. | Host scheduling, delegation, plan execution and blocking remain unobserved. |
| Dashboard, project record, read/edit/sync/usage | Local dashboard and opt-in project store are package-owned; init/sync and receipts guard managed changes. Host Agent-window and cross-device sync do not prove integration with this dashboard. | Local package evidence only; host integration and current session usage pending. |
| Security and packaging | Package provides local stdio MCP, disabled optional placeholders, local launcher and managed boundaries. [CLI configuration](https://docs.trae.cn/cli_config-file) documents permission policy and sandbox descriptors; these do not prove enforcement in a session. | Credentials, trust, permissions, and host registration remain user-controlled; no blanket safety claim. |

The [extension guide](https://docs.trae.cn/cli_tools-and-extensions) recommends
keeping MCP services to those needed because each consumes context and selection
cost. LazyTrae's one enabled core and seven disabled placeholders implement a
bounded default, not a measured host token saving. The existing adaptive capsule
fixture reports 1,076 bytes from a 7,227-byte input (85.11% smaller); that is a
fixture measurement, not measured token consumption or host latency.

**HOST READINESS: PENDING** for each selected region, build, mode, profile and
session. Acceptance requires observed discovery, a real skill or command,
relevant hook behavior, project-bound MCP and receipt-safe removal. Official
documentation, local versions and package tests are separate evidence and do
not substitute for that observation. See [Trae product surfaces](trae-product-surfaces.md)
for the prior adapter rescan and [the historical family audit](platform-status-2026-10-02.md).
