# Trae product surfaces — v1.4.0

Reviewed 2026-10-02; rescanned 2026-10-18. See the [2026-10-27 audit](platform-status-2026-10-27.md) for the current CN merger and dated releases. TraeCode IDE, TraeWork and TraeCode
CLI are separate execution surfaces. Record region, application/build and
execution profile. Global TRAE and CN TraeCode documentation must not be
treated as identical. The 2026-10-18 rescan found the global portal
announcing that TraeCode and TraeWork are merged into the all-new TRAE
(<https://docs.trae.ai>); that banner carries no dated release note or
adapter contract, so the three host adapters stay in place until the merged
product documents stable replacements.

The [CN native IDE hook reference](https://docs.trae.cn/ide_hook-configuration-reference)
documents project `.trae/hooks.json`, blocking PreToolUse/UserPromptSubmit/Stop,
and `RunCommand`. LazyTrae's legacy hooks remain advisory; validate payload
mapping and actual blocked execution before upgrading that adapter's claim.
The rescan re-confirmed `loop_limit` (default five) and exit-2 blocking, and
additionally recorded reference-page facts: `Notification` matches by
`notification_type` (`idle_prompt`, `permission_prompt`, `document_review`,
`ask_user_question`, `browser_interaction`); Claude Code settings
(`~/.claude/settings.json`, `.claude/settings.local.json`) are read and
merged with TRAE hooks; `PreToolUse` supports `permissionDecision`
(allow/deny/ask) with `updatedInput`; `SessionStart` supports `source` and
`TRAE_ENV_FILE`/`CLAUDE_ENV_FILE` injection. These remain documentation, not
observed execution.

[TraeCode CLI 2.0](https://docs.trae.cn/cli_get-started-with-trae-code-cli-2)
runs as `traecli`; [extensions](https://docs.trae.cn/cli_tools-and-extensions)
expose `/plugins`, `/skills`, `/mcp`, and [configuration](https://docs.trae.cn/cli_config-file)
uses `~/.trae/traecli.toml`. A complete native plugin schema is not specified
by these pages. Existing `.traecli/` candidate output is not a CLI 2.0
installation. Preserve the legacy CLI route as version-specific; inspect
`--version` and `--help` before choosing a route. Numeric version alone does
not prove CLI 2.0 compatibility. From the 2026-10-18 rescan the CLI adapter
adopted the documented stable CLI 2.0 approval and ACP surfaces as
descriptor-only capability candidates (observed 2026-10-18):
`approval_policy` (`untrusted`, `on-failure`, `on-request`, `never`) and
`default_permissions` (`:read-only`, `:workspace`, `:danger-full-access`)
keys in `traecli.toml`, plus `traecli acp serve` / `traecli --acp` with
`--permission-mode` (`default`, `auto`, `bypass_permissions`) from the
[ACP reference](https://docs.trae.cn/cli_agent-client-protocol).
Descriptor-only means documented, not executed: bounded probes, receipts and
session-bound observations remain the only promotion path.

TraeWork's desktop/local profile can address local files and connectors;
web/mobile/cloud profiles cannot inherit desktop paths. Keep skills discovery,
MCP registration and session restart observable per selected profile.

**HOST READINESS: PENDING** across these surfaces. Required acceptance includes
one real skill/command, project-bound MCP, hook allow/deny/Stop behavior where
supported, and receipt-safe removal. The [family audit](platform-status-2026-10-02.md)
records the common-core recommendation and remaining native acceptance work.

## Rescan record — 2026-10-18

Official pages reviewed: CN IDE changelog, CN hook reference, CN CLI config,
extensions and ACP pages, and the global docs portal plus global changelog.
Findings not adopted:

| Item | Source | Classification | Reason |
| --- | --- | --- | --- |
| Agent window workbench with cloud/scheduled tasks, SSH remote development, multi-path project mounts, desktop quick-action ball (v3.4.0, 2026-10-08) | [IDE changelog](https://docs.trae.cn/ide_changelog) | experimental | CN feature-release note; no documented adapter API |
| `/goal`, `/plan`, `/spec` commands, Solo/Agent merge, Max/Auto modes (v3.3.93–96, 2026-09-01) | [IDE changelog](https://docs.trae.cn/ide_changelog) | experimental | enterprise-only; the IDE plan/spec observation seam stays observation-driven |
| Personal plugin marketplace (2026-09-03), Computer Use (2026-08-12), mobile connect (2026-08-20) | [IDE changelog](https://docs.trae.cn/ide_changelog) | experimental | edition-gated product features without adapter contracts |
| TraeCode + TraeWork merged into the all-new TRAE | [docs.trae.ai](https://docs.trae.ai) | unknown | announcement banner only; the global changelog shows no update record |
| `/hooks` TUI command and `trae-cli plugin list` on CLI 2.0 | third-party pages only | unknown | absent from official CLI pages; `docs.trae.cn/cli_hooks` is a 404 |

Adopted stable items carry the 2026-10-18 observation date and the URLs above.
Native discovery, permissions and receipts are unchanged: the manifest still
declares the same three hosts, package paths and receipts, and no capability
was promoted beyond descriptor-only.
