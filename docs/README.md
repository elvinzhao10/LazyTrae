# LazyTrae documentation

## Current v0.15 entrypoints

Use these documents to install, operate, or verify the current release:

| Document | Purpose |
| --- | --- |
| [Setup guide](../AGENTS.md) | Host-specific onboarding for Trae IDE, Trae Work, and Trae CLI. |
| [User guide](../README.md) | Workflow selection, package limits, and safe removal. |
| [Plugin guide](../lazytrae-plugin/README.md) | Package layout, installation, and package-readiness boundaries. |
| [CLI guide](../lazytrae-plugin/packages/cli/README.md) | Current command-line installation, verification, and uninstall behavior. |
| [Setup detail](lazytrae-setup-guide.md) | Manual Trae Work and Trae CLI configuration detail. |
| [Implementation evidence](../lazytrae-evaluation.md) | v0.15 inventory, checks, and host-compatibility limits. |

The package configuration and source-local CLI checks are the source of truth for current MCP and runtime behavior. They confirm package readiness, not live host loading or MCP connection. The only built-in Trae Work global-skills location is macOS `~/.trae-cn/skills/`; Linux and Windows locations are manual and unverified.

## Historical records

The remaining files preserve earlier plans, prompts, designs, references, reports, and archived dogfood material. They are retained for provenance and study only; they are not current operating instructions and are not a dependency of a v0.15 installation.

- `archive/`, `plan/`, and `prompts/` contain dated records.
- `design/` and `reference/` capture prior analysis and design material.
- The repository [NOTICE](../NOTICE) and [LICENSE](../LICENSE) are the authoritative attribution and license records.
