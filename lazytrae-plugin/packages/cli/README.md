# lazytrae-ai

LazyTrae CLI — Trae-native workflow installer and runtime.

This CLI belongs to the LazyTrae learning project. It is
primarily inspired by LazyCodex. Its package-local [NOTICE](NOTICE) records
the LazyCodex and OmO upstream attribution; it is an independent implementation
and does not require LazyCodex or OmO at runtime. It is verified on macOS only.
Its self-contained CLI tarball carries the CLI, local MCP implementation,
templates, package-local `LICENSE` and `NOTICE`, and its production dependency
closure; a cold offline install checks that artifact without asserting host
discovery or an MCP connection.

**Node.js LTS 20 or newer** and **Git** are required. Bootstrap `lifecycle
onboard` only from `https://github.com/elvinzhao10/LazyTrae.git`. After
promotion, invoke `node "<install-root>/LazyTrae/launcher.js"` from any
project. The source checkout may be deleted. `lifecycle update`, `lifecycle
status`, `recover-bootstrap-lock`, and plan-first `lifecycle offboard` manage
`LazyTrae/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
A moved same-version ref requires `--confirm-revision <full-sha>`; stale runtime
recovery is scoped offboard/re-onboard. `--yes` is accepted only for the
explicitly confirmed `lifecycle offboard` and `lifecycle recover-bootstrap-lock`
actions. Package checks leave **HOST READINESS: PENDING** without current
observation.

## Commands

```bash
# Keep both paths absolute; this array prevents PATH/global command lookup.
LOCAL_LAZYTRAE=(node "<install-root>/LazyTrae/launcher.js" --root "<project-root>")

# Project-local package commands.
"${LOCAL_LAZYTRAE[@]}" init --host ide
"${LOCAL_LAZYTRAE[@]}" load-check --host ide
"${LOCAL_LAZYTRAE[@]}" doctor
"${LOCAL_LAZYTRAE[@]}" sync
"${LOCAL_LAZYTRAE[@]}" verify --must-pass

# Durable lifecycle commands use their own subcommand and arguments.
node "<verified-source-root>/lazytrae-plugin/packages/cli/bin/lazytrae.js" \
  lifecycle onboard --source https://github.com/elvinzhao10/LazyTrae \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle status \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle update \
  --source https://github.com/elvinzhao10/LazyTrae \
  --install-root "<install-root>" --project "<project-root>" --json
node "<install-root>/LazyTrae/launcher.js" lifecycle offboard \
  --install-root "<install-root>" --project "<project-root>" --json

# Recovery is confirmation-gated; pass --yes only after verifying the stale,
# lifecycle-owned sibling bootstrap lock named by the status report.
node "<install-root>/LazyTrae/launcher.js" lifecycle recover-bootstrap-lock \
  --install-root "<install-root>" --project "<project-root>" --yes --json

# Remove only receipt-owned project assets after the lifecycle plan is confirmed.
"${LOCAL_LAZYTRAE[@]}" uninstall --yes
"${LOCAL_LAZYTRAE[@]}" work status
"${LOCAL_LAZYTRAE[@]}" work uninstall

# Optional explicit lifecycle commands remain task- and approval-gated.
"${LOCAL_LAZYTRAE[@]}" tooling lsp-status --target "/absolute/project" --tooling-root "/absolute/lazytrae-lsp"
"${LOCAL_LAZYTRAE[@]}" tooling codegraph-doctor --target "/absolute/project" --tooling-root "/absolute/lazytrae-codegraph"
"${LOCAL_LAZYTRAE[@]}" tooling remote-status
```

The bootstrap source is transport only; after promotion, `launcher.js` is the
durable command. A lifecycle collision preserves the caller workspace. Only an
explicitly verified lifecycle-owned sibling bootstrap lock or product
`staging/`/`locks/` artifact may be recovered.

## Managed LSP bridge

The optional LSP bridge is separate from the local core MCP server; that server
retains its 15-tool contract. It detects an existing project or host provider
before provisioning a package-owned fallback. Only JavaScript/TypeScript
(`typescript-language-server@5.3.0` with `typescript@5.9.3`) and Python
(`basedpyright@1.39.9`) are supported. TypeScript requires Node 20 or later.
The bridge exposes only advertised read-only definitions, references, symbols,
hover, and diagnostics operations. It rejects rename requests and uses an
explicit receipt-owned tooling root, so it never changes the target project's
source, manifest, lockfile, or global tools.

## Tool-selection ladder

Use `rg` for exact local text/file search and `sg` for syntax-aware structural
search. Use the separate LSP bridge for semantic navigation, CodeGraph for an
explicit architecture/dependency question on a prepared large repository,
Context7 for current library documentation, and `grep_app` for explicit public
code examples when local evidence is insufficient. Use `lazytrae tooling verify`
to discover project-native lint/typecheck/test/build commands; it runs none
until the caller gives `--run <selection>`.

## Optional CodeGraph bridge

CodeGraph is a separate optional MCP process, never an extra LazyTrae internal tool. `lazytrae tooling codegraph-doctor` recommends it only when the target has at least 500 supported source files or 100,000 supported source lines. It never starts CodeGraph, downloads anything, or creates `.codegraph/`. `codegraph-install` pins `@colbymchenry/codegraph@1.4.1` in an explicit empty LazyTrae-owned tooling root with package scripts disabled. `codegraph-init` is an explicit caller action that creates or refreshes the project index with telemetry disabled and all runtime state contained in that tooling root; it never claims ownership of or removes the project `.codegraph/` directory. `codegraph-enable` proves that index before adding the managed `lazytrae codegraph ...` MCP entry. `sync` preserves that managed entry and caller MCP entries. The bridge invokes only `codegraph init` and `codegraph serve --mcp`; it never calls CodeGraph's agent-install, uninstall, upgrade, or provisioning commands. `codegraph-uninstall` removes only an unmodified receipt-owned tooling root and never removes a project `.codegraph/` directory.

## Automatic capabilities and persistent compatibility

Automatic capability routing selects providers through the bundled contract. It
may use safe local tools from the private receipt-owned toolpack for one task,
then tears them down without changing `.trae/mcp.json`, project tooling state,
dependencies, lockfiles, or host MCP settings. Provider requests carry only a
sanitized bounded query; provider output is untrusted. Metered services require
an explicit bounded budget, while CodeGraph and Playwright require approval.
Authenticated browser work, forms, external writes, purchases, destructive
actions, and secret reads always prompt.

`lazytrae tooling enable <capability>` is deliberately different: it is the
explicit, persistent compatibility path. It writes a namespaced `lazytrae_*`
MCP selection only when the operator requests it. Onboarding and InitDeep copy
package-owned skills, commands, rules, hooks, agents, and the single core MCP
declaration only; they never enable or register optional remote services.

## Optional remote MCP capabilities

Context7 and `grep_app` are disabled by default. `lazytrae tooling enable context7` adds a managed, endpoint-only `lazytrae_context7` entry for `https://mcp.context7.com/mcp`; `lazytrae tooling enable grep_app` adds the experimental, unpinned `lazytrae_grep_app` entry for `https://mcp.grep.app`. `sync` preserves both selections and unrelated caller MCP entries. Neither normal install, InitDeep, doctor, nor status contacts either service. Credentials are never accepted as raw values or written to project state. Use `lazytrae providers configure --provider <id> --credential-ref env:NAME` for an opaque reference; status output never reveals its value. Use `tooling disable` to remove only the corresponding LazyTrae-managed entry.

## Onboard

Open or link the durable `v1.0.3` release in the selected Trae host, give the agent
`https://github.com/elvinzhao10/LazyTrae`, and type `onboard`. The setup guide
asks for Trae IDE, Trae Work, or Trae CLI and uses the stable durable
launcher, never PATH/global lookup:

```text
node "<install-root>/LazyTrae/launcher.js" --root "<project-root>" <command>
```

It runs only safe package checks and project-local setup first. **Package
readiness** is reported separately from **host readiness**. Before a Trae Work
Skills copy, Settings → MCP connector, or Trae CLI registration, ask for
approval. Then give one exact host action and wait; after the user responds,
inspect the app with Computer Use. A reload/new session is a separate action.
Verify one real Skill/command and the expected `lazytrae` core MCP connection;
without that observation, host readiness remains pending.

Availability labels are evidence boundaries: the launcher and generated
configuration are the **documented package route**; supplied macOS IDE/Work
observations are an **observed prerelease route**; and the current surface
remains **HOST READINESS: PENDING** until observed. For Work, run `load-check
--host work`; for CLI, run `load-check --host cli`. Copy only the JSON between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. After approval, paste
it into Work's **Settings → MCP** or the selected CLI build's
documented/manual MCP settings flow. No public universal MCP registration
command is assumed. The supplied QA could not access Trae CLI, so its live-host
route remains explicitly unverified.

This will:
- Detect repo root (finds `.git`)
- Create directory structure: `.trae/`, `.lazytrae/`
- Copy all templates (rules, skills, commands, agents)
- Merge managed blocks into `AGENTS.md` without overwriting user content
- Add `.gitignore` entries for runtime state

For Trae Work, invoke the absolute release-owned launcher with `work install`
after selecting the package. It copies the bundled `lazy-*` skills to
`~/.trae-cn/skills/` on macOS. That built-in location is the only documented
and tested host default; reload/discovery must still be confirmed manually.
Trae Work has no global command registry, and MCP still must be registered
manually in **Settings → MCP** using the package's `mcp` entry. Linux and
Windows locations are unverified; pass `--skills-dir` only after the host
reports the directory.

## Uninstall safely

The absolute release-owned launcher with `uninstall --yes` removes only project
files that still exactly match the bundled templates. It preserves modified or
unknown files in `.trae/` and `.lazytrae/`, all normal runtime data under
`.lazytrae/state/`, `.lazytrae/evidence/`, `.lazytrae/plans/`,
`.lazytrae/loop/`, and files in foreign or legacy namespaces. `--soft` removes
verified `.trae/` assets only. `--purge-state` additionally removes only exact
bundled runtime template files; it never recursively deletes a runtime
directory. `--soft` and `--purge-state` cannot be combined.

For Trae Work on macOS, invoke the same launcher with `work uninstall`; it
removes only manifest-listed `lazy-*` skills whose sole `SKILL.md` still
exactly matches the bundled contents. It refuses symlinks and hard links, and
preserves edited or nonempty skill directories. Linux and Windows locations
and host behavior are unverified; pass a directory reported by Trae Work with
`--skills-dir` only after manually confirming it. Remove the package MCP entry
yourself in **Settings → MCP**.

For Trae IDE, invoke the release-owned launcher with `uninstall --yes`, then
remove or disable the local core server in the IDE's MCP settings if you added
one separately. For Trae CLI, remove the server through the selected build's
documented MCP settings flow; uninstalling project files never changes CLI
registration. No global command is required; if one was installed separately,
remove it through the package manager that installed it.

## What Gets Installed

| Path | Purpose |
|------|---------|
| `.trae/rules/lazytrae.md` | Project-level LazyTrae behavioral rules |
| `.trae/skills/*/SKILL.md` | 17 workflow skills (init-deep, ulw-plan, start-work, etc.) |
| `.trae/commands/*.md` | 9 slash command definitions |
| `.trae/agents/*.md` | 11 custom agent role definitions |
| `.trae/hooks.json` | Five configured events referencing eight hook scripts |
| `.trae/mcp.json` | 8 MCP declarations; one executable core server and seven disabled placeholders. The `lazytrae` declaration exposes 15 tools when connected. |
| `.lazytrae/config.json` | LazyTrae configuration |
| `.lazytrae/state/` | Durable runtime state (boulder, active-loop, sessions) |
| `.lazytrae/schemas/` | JSON schemas for state validation |
| `.lazytrae/evidence/` | Evidence templates for verification gates |
| `.lazytrae/plans/` | Plan files |
| `.lazytrae/loop/` | Per-run loop artifacts |

## License

This package is distributed under the [MIT License](LICENSE). Attribution and
third-party notices are in the package-local [NOTICE](NOTICE).
