# LazyTrae v1.3.4 — safer runs, clearer host boundaries

A small maintenance release for the LazySeries family. It repairs runtime and
host-adapter boundaries while retaining the workflow foundation inherited from
family versions v1.3.0–v1.3.3. Those inherited features are not new in this patch
and do not imply prior public releases of the Kimi or DeepSeek ports.

## Eval-driven fixes

- Installed post-tool hooks carry their local path and transaction helpers, so they work outside the source checkout.
- Loop writes reject stale revisions and repeated goal creation preserves the existing run.
- Starting a goal consumes one global iteration; resuming it consumes none. Blocked, failed and exhausted states stay distinct.
- Finalization requires all intended tasks done; persisted status is assessed
  separately from completion evidence.

## Cumulative workflow experience

Describe work in natural language or use explicit workflow entry points.
Keep editable Markdown plans, durable decisions, evidence-bound completion
and verification sized to the change. Planning-only requests remain separate
from execution authority. The README presents these inherited features together
with the 1.3.4 fixes; historical notes below retain the version-by-version record.

## Measured efficiency

No new latency, token-saving, cost or recall improvement is measured for this
patch. Ledger append/compaction, learned routing and shared-core migration are deferred.

## Host capability matrix

Commercial TraeCode CLI is distinct from the open-source TRAE-agent. Native authenticated command acceptance remains pending. Hooks are advisory; completion and mutation gates run in the CLI/MCP. Seven optional MCP placeholders remain disabled.

Package and distribution checks do not prove a current native host session.
**HOST READINESS: PENDING** until loading, command/skill behavior and the expected
MCP connections are observed. The README links the selected host's setup guide.

## Migration and upgrade

Use the receipt-aware upgrade route with an explicit project binding. Preserve project evidence and unknown host configuration. No credentials or production host settings are changed by package verification.

Read [AGENTS.md](AGENTS.md) and [the install guide](docs/03-install-and-host-verification.md).
Choose one route, check the installed package version, and restart the host.
Source checkouts and release archives have different build requirements; follow
the documented route. Do not reset populated runs merely to upgrade.

## Known risks

Native acceptance is separate from package readiness. Token/cost budgets are
metadata; pending approvals are persisted observations without a live approval
queue. Shell loop policy beyond the configured global cap needs orchestrator enforcement.

## Rollback

Retain the published v1.3.3 tag and ownership receipts. Remove only receipt-owned, unmodified assets and use a fresh host session to verify removal.

## Documentation and family presentation

Aligned sibling README structure, current setup navigation and a shared six-repo
family table. Personal environment files and caches are ignored while example
configuration and pinned fixture logs remain publishable. Earlier release notes
remain below as historical evidence.

## Post-publication repository maintenance

The current main-branch dependency lock uses patched `fast-uri` 3.1.8 and 4.1.5.
This addresses [host canonicalization](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) and
[encoded mailto fields](https://github.com/advisories/GHSA-jvvf-x445-j334).
Existing published v1.3.4 archives retain their original tagged dependency
contents. Use the current source lock for this fix; a refreshed archive needs
a subsequent versioned release.

## Prior release notes

# LazyTrae v1.3.3 — reliability and release consistency

**Status:** v1.3.3 release. Source, package, and publication checks passed locally on Node 22 and 24 and in PR CI. TraeCode CLI 0.120.52 connected the core MCP server and discovered commands in an isolated project; command execution stopped at the required enterprise login.

## Eval-driven fixes

- Corrected the embedded JavaScript terminator in the SessionStart hook template and shipped mirror. Executable fixtures cover populated, empty, missing, and malformed state.
- Advanced package, runtime, hook, and status metadata together for this candidate.

## Measured efficiency

No token, latency, or cost improvement has been measured for this patch.

## Host capability matrix

Trae CLI package checks exercise hook and MCP entry points. Fresh IDE and CLI activation still require a recorded host build and session.

## Migration and upgrade

Update through the normal Trae package route from v1.3.2. Preserve caller state and verify the installed version before relying on host behavior.

## Known risks

Local package verification does not prove a live Trae hook denial or command execution. The observed TraeCode CLI MCP connection covers only the isolated project and CLI build above; broader host acceptance remains pending.

## Rollback

Use the lifecycle rollback to the prior verified v1.3.2 release, preserving diagnostic evidence and caller state.

## Prior release notes

# LazyTrae v1.3.2 — durable verification handoff

**Status:** v1.3.2 release. Source, publication, and main-branch CI checks passed. Fresh Trae activation remains pending; package verification alone does not establish host readiness.

## Eval-driven fixes

- The start-work contract requires a run-scoped, revision-bound report before a verdict. Trae's generic task completion API does not yet enforce this report format.
- The start-work contract requires focused checks between stages, one full matrix at closure, a compact run digest, and completion events instead of active polling. It forbids duplicate dispatch while owned paths or evidence are changing.
- Trae's PreToolUse hook is advisory. The start-work skill limits orchestrator writes to run state and evidence, but this host does not currently provide a blocking role-aware write gate; direct product writes require independent review.

## Measured efficiency

The B3 postmortem identifies repeated whole-suite verification and polling as major token sinks. v1.3.2 has no measured token, latency, or cost reduction yet.

## Release verification

PR #37 and the merged main branch passed CI. The tag-triggered release workflow separately verifies the CLI and MCP package before attaching its release asset. The current TraeCLI package route is not verified as a native plugin: local `traecli plugin validate` reports no provided capabilities. Use the documented CLI and MCP installation route, and confirm the selected Trae host in a fresh session before claiming live readiness.

## Host capability matrix

| Host | Package route | Current session |
| --- | --- | --- |
| TraeCode, TraeWork, TraeCode CLI | Existing documented routes | Pending live observation |

## Migration and upgrade

Upgrade from v1.3.1 using the documented lifecycle after inventorying managed and modified assets. Preserve caller files and existing run evidence. The report gate applies to new verification attempts; old conversational verdicts do not become durable evidence.

## Known risks

Trae's hook does not enforce the orchestrator write boundary. Quota termination can still leave an in-progress report; it must remain blocked until independently resumed or rerun.

## Rollback

Use the lifecycle rollback to the prior verified release. Keep v1.3.2 run evidence for diagnosis and do not mark in-progress reports complete.

## Prior release notes (v1.3.1)

# LazyTrae v1.3.1 — adaptive workflow experience

**Status:** Published stable release. Repository and package checks passed; see [PR #36](https://github.com/elvinzhao10/LazyTrae/pull/36) for change and CI history. Trae activation in a fresh host session still needs live testing.

## Eval-driven fixes

- **Safer execution:** Intent routing distinguishes explicit work requests from planning requests; ambiguous or denied requests remain plan-only. Isolation distinguishes directory allocation from Git worktree provisioning, rejects untracked caller changes, and preserves populated allocations during release and recovery.
- **Better evidence:** Outcome comparisons hash the supplied task, budget, and permission snapshots and reject mismatched cohorts. Reports distinguish absent, partial, and validated evidence, count explicit host-billed costs from failed runs, and reject fixture telemetry as execution data. Hashes verify supplied bytes, not the truth of their contents.
- **Predictable delegation:** Subagents keep the current model by default. A plan can propose task-specific routing, but switching requires an explicit plan decision and `--allow-switch`. Host-scoped suggestions are advisory; they do not alter host configuration or claim native model availability. Unsupported `auto`, `max`, and `lite` subagent aliases are omitted.
- **Guidance at v1.3.1:** The installed onboarding guide and README agreed: Node.js LTS 24 was recommended, 22 was supported, and the lifecycle accepted 20 for compatibility. Obsolete attribution and initial-port files were removed; credits and licenses remained in NOTICE and LICENSE.

## Measured efficiency

No measured productivity, speed, or native-cost improvement is claimed. Local source, package, publication, and CLI checks passed; [PR #36](https://github.com/elvinzhao10/LazyTrae/pull/36) records the current CI results.

## Host capability matrix

| Host | Release route | Live status |
| --- | --- | --- |
| TraeCode | Project | Pending fresh-session test |
| TraeWork | User Skills or documented selected route | Pending fresh-session test |
| TraeCode CLI | CLI | Pending fresh-session test |

## Migration and upgrade

Before upgrading, record the installed version and lifecycle ownership, then validate the exact v1.3.1 archive. Treat package verification and native-host activation as separate checks.

## Known risks

Repository and CI checks do not establish that a release archive loads in a host. Installation, activation, MCP, specialist, cancellation, and completed-task behavior remain unobserved in fresh Trae sessions. Evidence hashes bind supplied bytes but do not establish their independent truth.

## Rollback

Stop the host session and use the lifecycle offboard/rollback route for the previous release. Remove only unmodified receipt-owned assets; preserve modified, unknown, linked, caller-owned, and host-managed files. Start a fresh session to verify the restored installation.
