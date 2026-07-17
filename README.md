# LazyTrae

![LazyTrae](lazytrae-banner.jpg)

LazyTrae is a self-contained workflow harness for **Trae IDE**, **Trae Work**,
and **Trae CLI**. Its companion command installs project assets, checks local
readiness, runs completion gates, and launches a local stdio MCP server.

It is verified on macOS only. Package checks establish copied assets and local
contracts; the selected Trae surface remains the authority for discovery,
hook execution, and MCP connection.

## Start with the outcome

State the result you need, acceptance criteria, and the surface that must
prove it. Use the smallest workflow that fits the uncertainty and risk:

| Situation | Ask for | Why |
| --- | --- | --- |
| Small, well-understood change | A normal request | Avoid process for process's sake. |
| Unfamiliar repository | `lazy-init-deep` | Establish project-local instructions and context. |
| Broad or ambiguous change | `lazy-ulw-plan` | Make decisions reviewable before editing. |
| Approved plan | `lazy-start-work` | Execute against explicit acceptance criteria. |
| Failure | “Debug why … fails” | Reproduce, compare hypotheses, and verify the fix. |
| Material-risk completion | `lazy-review-work` | Add independent quality, QA, security, and scope checks. |
| Long-running goal | `lazy-ulw-loop` | Keep durable state and checkpoints. |

For a CLI project, use `lazytrae verify --must-pass` before reporting a task
complete. Trae hooks are advisory; hard completion decisions live in the CLI
and MCP gates.

## Design mindset

LazyTrae treats a task as an evidence problem: define the observable outcome,
keep authority with the host and user, choose local tools before heavier
providers, and exercise the surface the user actually cares about. A passing
unit test is useful evidence, not automatically proof of a CLI, page, API, or
host integration.

The package keeps `.trae/` and `.lazytrae/` project assets separate from host
settings, credentials, marketplace state, and live sessions. It does not turn
a package readiness result into a claim about a running Trae host.

## Install, verify, and remove

Open a copied repository in the selected host and type `onboard`, or follow
the exact host route in [AGENTS.md](AGENTS.md). Run `lazytrae init --host
ide|work|cli`, then complete the host-specific observation step.

`lazytrae load-check --host ide` reports **package readiness** only. Type
`offboard` for the safe-removal protocol; it preserves host-managed paths and
leaves host MCP registrations for the user to remove through the host.

The distributable is a **self-contained CLI tarball**: after installation it
does not require a source checkout. See
[lazytrae-plugin/README.md](lazytrae-plugin/README.md) for package commands
and optional tooling lifecycle details.

## Package inventory

| Surface | Count | Role |
| --- | ---: | --- |
| CLI | 17 | Command modules for installation, state, verification, tooling, and lifecycle actions. |
| Skills | 17 | Host-facing workflow policies copied from canonical templates. |
| MCP declarations | 8 | One executable core server and seven disabled placeholders. |

## Technical reference and evaluation

The source-level explanation lives in [docs/README.md](docs/README.md). It
maps template installation, managed writes, state validation, the CLI/MCP
boundary, tooling ownership, and the release checks with diagrams tied to the
implementation.

For a capability-by-capability comparison with the original reference harness,
including what LazyTrae implements and where it intentionally differs, see
[lazytrae-evaluation.md](lazytrae-evaluation.md). Attribution and provenance
are recorded in [NOTICE](NOTICE); this is an independent implementation with
no external harness runtime dependency.

## License

[MIT](LICENSE). See [NOTICE](NOTICE) for attribution and provenance.
