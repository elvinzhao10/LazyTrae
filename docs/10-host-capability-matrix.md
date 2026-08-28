# Host capability matrix

**Current documentation release: v1.1.0.** This is a boundary matrix, not a
claim that a package result has made any host ready.

LazyTrae deliberately aligns policy and package safety across Trae surfaces while keeping host adapters distinct. The same project assets may be present on two surfaces without both hosts exposing the same discovery or registration behavior.

This matrix assumes **Node.js LTS 20 or newer** and **Git** bootstrap
`lifecycle onboard` only from
`https://github.com/elvinzhao10/LazyTrae.git`. Later `lifecycle update`,
`lifecycle status`, and plan-first `lifecycle offboard` run through
`node "<install-root>/LazyTrae/launcher.js"` against
`LazyTrae/{active.json,launcher.js,releases/,receipts/,rollback/,staging/,locks/}`.
The source checkout may be deleted. Moving a tag requires full-SHA
confirmation; a stale runtime requires scoped offboard/re-onboard rather than
receipt edits. These facts never imply a loaded host: **HOST READINESS:
PENDING** until current observation.

## What each host needs

| Capability | TraeCode | TraeWork | TraeCode CLI | Package assertion |
| --- | --- | --- | --- | --- |
| Project assets | `.trae/` and `.lazytrae/` | Global Work skills plus project state | Local project configuration | Templates and managed copies are present. |
| Skills/commands/agents | Project discovery | Global skill discovery; no global command registry | CLI/session discovery | Files are present; host must load them. |
| MCP | Project declaration; reopen is host-owned | Paste-ready JSON for manual Settings → MCP | Paste-ready JSON for the selected build's documented/manual settings flow | Core launcher and protocol tests are present. |
| Hooks | Host event lifecycle | Host-specific behavior | CLI/project behavior | Hooks are advisory declarations. |
| Removal | Project assets only | Bounded skills removal plus manual registration removal | Project assets plus manual registration removal | Package never guesses host locations. |

## Structural differences

The host adapter differs, but the safety model does not:

- **Availability:** release configuration is the **documented package route**;
  supplied macOS IDE/Work results are an **observed prerelease route**; without
  a current Computer Use or user-supplied observation, **HOST READINESS:
  PENDING**. No universal TraeCode CLI MCP command is assumed.

- **Host integration:** IDE, Work, and CLI each own discovery, registration, session lifetime, and event delivery.
- **State/path:** project assets live in `.trae/` and `.lazytrae/`; the verified Work skills path is macOS `~/.trae-cn/skills/`; host settings and credentials remain user-owned.
- **Inventory:** eight MCP declarations are shipped: one executable core server and seven disabled placeholders. Optional providers remain explicit lifecycle decisions.

## v1.1 host-native routes

| Independent host | LazyTrae-owned local output | Host-native boundary | Evidence mode |
| --- | --- | --- | --- |
| TraeCode | `.trae/` assets and an optional bounded capability probe | Discovery, hooks, session and MCP connection remain IDE-owned. | Package evidence; probe is bounded and non-promoting. |
| TraeWork | An explicit `--client` and `--execution` profile; only desktop/local can name a local worktree, executable, skills path, or `.skill` bundle. | Work owns skill loading, account context, connector and execution environment. Web/mobile/cloud profiles are descriptors only. | Profile evidence; no upload, login, credential, or cloud action. |
| TraeCode CLI | `traecli-candidate generate` creates receipt-owned `.traecli/` candidates. | Candidate files are inert configuration, not discovery, registration, marketplace installation, or execution. A runner needs an exact probe-proven structured interface. | Generated evidence then bounded probe evidence; host readiness remains pending. |

The current writers produce v2 readiness and host-adapter records. Historical
v1 records are only read-only compatibility inputs. No route may promote
package readiness to host readiness: all current probe, registration, session,
MCP, and observation evidence must be fingerprint-bound and current first.

## Package-built versus host-native behavior

| Behavior | LazyTrae contribution | Raw host contribution | Learner takeaway |
| --- | --- | --- | --- |
| Workflow guidance | Ships template skills, commands, agents, rules, and hooks. | Decides discovery/exposure on IDE, Work, or CLI. | A copied template is not proof that a host loaded it. |
| Installation | `init`/`sync` performs managed project writes and load checks. | Owns Work global skill discovery and CLI/IDE session behavior. | An initialized project is not a connected host session. |
| Hook policy | Ships advisory scripts and mappings. | Delivers events and defines hook lifecycle semantics. | Hard completion belongs in CLI/MCP gates, not hook exit codes. |
| Local MCP | Ships one core stdio server and disabled placeholders. | Starts, registers, and displays the connection. | A declaration is not a connection. |
| Optional providers | Implements policy, receipts, and managed namespaced entries. | Stores credentials and applies connector/network policy. | Selection/receipt status is not provider authorization or connection. |

The complete dependency classification is in [Dependency and host boundary reference](reference/dependency-and-host-boundaries.md).

## JSON-first manual routes

Use the absolute release-owned launcher. `load-check --host work` and
`load-check --host cli` print the local core connector between
`LAZYTRAE_MCP_JSON_BEGIN` and `LAZYTRAE_MCP_JSON_END`. For Work, paste that
JSON in **Settings → MCP** after approval. For CLI, use the selected build's
documented/manual MCP settings flow; no public universal MCP registration
command is assumed. Paste, reload/new session, and live verification are
separate one-action handoffs. The launcher is the **documented package route**;
supplied macOS IDE/Work behavior is an **observed prerelease route**; without a
current observation, **HOST READINESS: PENDING**. The supplied QA could not
access TraeCode CLI, so its live-host route is explicitly unverified.

## macOS-only scope

The package evidence is verified on macOS only. It does not claim equivalent TraeWork paths, discovery, hook execution, or MCP connection on other operating systems. Those are observed per selected host session.
