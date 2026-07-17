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

## Install and onboard

LazyTrae v1.0.1 is installed from this repository because the companion CLI is
not yet published to npm. You need macOS, Node.js 18 or newer, npm, and one of
the supported Trae surfaces.

1. Download the reviewed v1.0.1 source and install its CLI:

```bash
git clone --branch v1.0.1 --depth 1 https://github.com/elvinzhao10/LazyTrae.git
cd LazyTrae
npm install --global ./lazytrae-plugin/packages/cli
```

You can review the source on the [LazyTrae repository](https://github.com/elvinzhao10/LazyTrae)
or download the packaged archive and read the detailed notes on the
[v1.0.1 release page](https://github.com/elvinzhao10/LazyTrae/releases/tag/v1.0.1).

2. Initialize the project where you want to use LazyTrae. Run this from that
project's root, not from the LazyTrae source checkout:

```bash
lazytrae init --host ide
# Use --host work or --host cli for the other supported surfaces.
lazytrae load-check --host ide
```

3. Open the initialized project in the matching Trae surface and type
`onboard` into the Trae chat. `onboard` is a host prompt, not a shell command.
Follow the generated checklist until both the package readiness checks and the
live host/MCP observation pass.

To try LazyTrae in its own source repository, skip step 2, open the cloned
folder in Trae, and type `onboard`. The host-specific checklist in
[AGENTS.md](AGENTS.md) explains the final live verification.

## Verify and remove

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

## Contributing

Issues and focused pull requests are welcome:

1. Search [existing issues](https://github.com/elvinzhao10/LazyTrae/issues) and
   open one for substantial behavior changes or reproducible bugs.
2. Fork the repository, create a short-lived branch from `main`, and make one
   focused change.
3. Run `npm ci --ignore-scripts`, `npm test`, `npm run test:publication`, and
   `npm pack --dry-run --json` from `lazytrae-plugin/packages/cli`.
4. Update user-facing documentation when behavior changes, then open a pull
   request explaining the outcome, compatibility impact, and verification.
5. Respond to review and wait for required checks before merge.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the complete workflow. Report
vulnerabilities privately according to [SECURITY.md](SECURITY.md), never in a
public issue.
