# LazyTrae

![LazyTrae banner](lazytrae-banner.jpg)

LazyTrae is a learning project and workflow harness for **Trae IDE**, **Trae
Work**, and **Trae CLI**. It gives an agent a disciplined way to understand a
repository, plan work, make changes, verify them on the real user surface, and
retain evidence for the next task. It is primarily inspired by LazyCodex
([upstream project](https://github.com/code-yeongyu/lazycodex));
[NOTICE](NOTICE) records the related OmO upstream attribution. LazyTrae is an
independent implementation and does not require LazyCodex or OmO at runtime.

> **Install and host setup:** [AGENTS.md](AGENTS.md).
> **Package details:** [lazytrae-plugin/README.md](lazytrae-plugin/README.md).

LazyTrae is verified on macOS only. Other operating systems and live host
behaviour need local confirmation before they are relied on.

## What you do with it

Open a project in a supported Trae surface and describe the outcome you need.
For a small, clear task, ask normally. For a new, broad, or risky task, use the
workflow deliberately:

```text
/lazy-init-deep                         # learn an unfamiliar repository once
/lazy-ulw-plan "add project search"    # inspect and write an approval-ready plan
# review and approve the plan
/lazy-start-work                        # execute the approved work with evidence
/lazy-review-work                       # independently review a significant result
```

`/lazy-ulw-loop "goal"` is for a long-running outcome that needs durable
checkpoints. The agent can select the same playbooks from ordinary language:
“debug this failure”, “refactor without changing behaviour”, or “commit these
changes” are usually enough. The rule is simple: choose the smallest workflow
that matches the risk, state what success looks like, and confirm it on a real
CLI, page, API, or other user surface rather than stopping at a test result.

## Your first task

Start with the result and acceptance criteria, not a list of internal steps.
For example:

> Add project search. It must work on a real project, include focused tests,
> and be exercised in the user interface before it is called done.

LazyTrae then uses its 17 skills, 9 commands, and 11 specialist agents to
choose an appropriate route. Its completion gate is intentionally outside Trae
hooks: Trae hooks are advisory, while `lazytrae verify --must-pass` and the
`mark_task_done` MCP tool require evidence before completion is reported.

## Get started on your Trae host

Copy or clone this repository, open it in the host you use, and type
`onboard`. The setup guide asks which surface is installed and follows only
that route:

| Host | What LazyTrae installs or declares | What you confirm yourself |
| --- | --- | --- |
| **Trae IDE** | Project `.trae/` and `.lazytrae/` assets plus `.trae/mcp.json`. | Reopen the project and observe host discovery and MCP connection. |
| **Trae Work** | On macOS, `lazytrae init --host work` installs the 17 global skills; `lazytrae work status` reports the copied assets. | Reload Work and add `lazytrae mcp` in **Settings → MCP**. |
| **Trae CLI** | Project assets and the documented `trae-cli mcp add-json` registration command. | Start a new Trae CLI session and observe the connection. |

The final `load-check` is **package readiness**: it checks copied assets and
declared configuration. It does not prove host discovery, a loaded plugin,
hook execution, or an MCP connection. The base MCP file has eight declarations:
one executable `lazytrae` core server and seven disabled placeholders. The core
server exposes 15 tools after a host connects to it.

See [AGENTS.md](AGENTS.md) for exact install and safe offboarding steps. It is
important to keep the package result separate from what you observe in Trae.

## Automatic tooling and MCP capabilities

LazyTrae has a local-first capability broker. When a task calls for a known
local capability, it may select it for that task without requiring you to name
a tool:

| Need | Temporary task-scoped capability |
| --- | --- |
| Fast text and file search | `rg` (ripgrep) |
| Structural code search | `sg` (ast-grep) |
| Definitions, references, symbols, diagnostics | Read-only LSP bridge for supported JavaScript/TypeScript and Python projects |
| Repository-native confidence | Detect declared lint, typecheck, test, and build commands; run only the check selected for the task |

Before provisioning a local fallback, the broker detects a compatible existing
tool. Any fallback lives in a private, receipt-owned tooling root. This is
temporary task support, not host configuration: automatic routing never edits
project MCP files, dependencies, lockfiles, or host settings, and it never
turns on a remote provider.

CodeGraph is intentionally more deliberate. Use it for architecture maps,
dependency tracing, or cross-file relationships only after explicitly choosing
that work and running `lazytrae tooling codegraph-init` with a receipt-owned
tooling root. Its project index remains caller-owned. Context7, `grep_app`,
filesystem, and Playwright are optional capabilities with their own lifecycle
and approval boundary. CodeGraph and Playwright require approval. Authenticated
browser work, forms, publishing, external writes, purchases, destructive work,
and secret reads always require approval; metered providers also require an
explicit bounded budget.

There is one separate persistent path:

```bash
lazytrae tooling enable <capability>
```

It writes a namespaced optional MCP selection only when you explicitly request
that compatibility choice. Onboarding, InitDeep, doctor, and automatic task
routing never run it. `setup`, `providers`, and `providers test` report
redacted readiness and opaque credential references; they do not expose raw
credentials.

Useful inspection commands:

```bash
lazytrae tooling status --tooling-root /absolute/lazytrae-tools
lazytrae tooling capability-status --json
lazytrae doctor
lazytrae setup --non-interactive --json
lazytrae providers --json
```

## Skills, commands, and package contents

All workflow skills and commands are `lazy-` prefixed. The principal commands
are `/lazy-init-deep`, `/lazy-ulw-plan`, `/lazy-start-work`, `/lazy-ulw-loop`,
and `/lazy-review-work`. Supporting skills cover verification, review,
research, programming, Git, debugging, refactoring, structural search, and
frontend work. On Trae Work, install the skills once, then invoke them through
natural language because Work has no global command registry.

| Component | Count | Included |
| --- | --- | --- |
| Skills | 17 | Workflow playbooks |
| Commands | 9 | `lazy-` commands |
| Agents | 11 | Specialist roles |
| MCP declarations | 8 | One core server; 15 core tools after connection |
| CLI | 17 | Installer, doctor, verification gate, lifecycle, MCP launcher, and tooling commands |

For package layout, template ownership, and the test map, read the
[package README](lazytrae-plugin/README.md). The repository keeps attribution
and provenance in [NOTICE](NOTICE).

The self-contained CLI tarball carries the CLI, local MCP implementation,
templates, package-local legal notices, and its production dependency closure.
It is checked by a cold offline install; that package check does not establish
host discovery or an MCP connection.

## Remove it safely

Review removal from the initialized project, then choose only the scope you
intend:

```bash
lazytrae uninstall --help
lazytrae uninstall --yes
lazytrae uninstall --yes --soft
lazytrae uninstall --yes --purge-state
```

Uninstall removes only exact receipt-owned package assets. It preserves
modified, unknown, caller-owned, and host-managed files, and it never guesses
or removes host MCP registrations. On macOS, `lazytrae work uninstall` removes
only unmodified installed Work skill folders. Remove the MCP entry manually in
the host; for Trae CLI, use `trae-cli mcp remove lazytrae`. See the `offboard`
protocol in [AGENTS.md](AGENTS.md) for the safe order and host-specific manual
steps.

## License and attribution

LazyTrae is available under the [MIT License](LICENSE). See [NOTICE](NOTICE)
for attribution and provenance.
