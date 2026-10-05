# Trae product surfaces — v1.4.0

Reviewed 2026-10-02. TraeCode IDE, TraeWork and TraeCode CLI are separate
execution surfaces. Record region, application/build and execution profile.
Global TRAE and CN TraeCode documentation must not be treated as identical.

The [CN native IDE hook reference](https://docs.trae.cn/ide_hook-configuration-reference)
documents project `.trae/hooks.json`, blocking PreToolUse/UserPromptSubmit/Stop,
and `RunCommand`. LazyTrae's legacy hooks remain advisory; validate payload
mapping and actual blocked execution before upgrading that adapter's claim.

[TraeCode CLI 2.0](https://docs.trae.cn/cli_get-started-with-trae-code-cli-2)
runs as `traecli`; [extensions](https://docs.trae.cn/cli_tools-and-extensions)
expose `/plugins`, `/skills`, `/mcp`, and [configuration](https://docs.trae.cn/cli_config-file)
uses `~/.trae/traecli.toml`. A complete native plugin schema is not specified
by these pages. Existing `.traecli/` candidate output is not a CLI 2.0
installation. Preserve the legacy CLI route as version-specific; inspect
`--version` and `--help` before choosing a route. Numeric version alone does
not prove CLI 2.0 compatibility.

TraeWork's desktop/local profile can address local files and connectors;
web/mobile/cloud profiles cannot inherit desktop paths. Keep skills discovery,
MCP registration and session restart observable per selected profile.

**HOST READINESS: PENDING** across these surfaces. Required acceptance includes
one real skill/command, project-bound MCP, hook allow/deny/Stop behavior where
supported, and receipt-safe removal. The [family audit](platform-status-2026-10-02.md)
records the common-core recommendation and remaining native acceptance work.
