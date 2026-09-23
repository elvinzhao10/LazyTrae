# LazyTrae v1.3.1 — release candidate (unpublished)

The latest published stable release is v1.3.0. This v1.3.1 worktree is a release candidate only: it has not been tagged or published, and it makes no host-installation or activation claim. Main-branch CI and package checks are not evidence about a release archive.

## Eval-driven fixes

- Cohort comparison now reads and hashes referenced task, budget and permission snapshots. Outcome integrity distinguishes absent, partial and validated evidence; explicitly marked fixture-validation telemetry is rejected as execution input.
- Isolation now separates directory allocation from Git worktree provisioning, rejects untracked caller changes and preserves populated allocations during release/recovery.
- Model-routing health checks validate configured category values and explicitly leave native model resolution unobserved.
- Subagents inherit the current model unless a plan explicitly enables switching. Host-scoped routing gives advisory task-tier guidance from a safe catalog when `--allow-switch` is used. It never writes host configuration, treats a current empty TraeCLI catalog as local observation only, and omits unsupported `auto`, `max`, and `lite` subagent model aliases.

- Outcome evaluation reports explicit host-billed cost only. It does not infer dollar costs from token rates, preserves usage records when a run fails, includes failed-run costs in the condition numerator, and rejects cohorts with mismatched host build, model, task snapshot, budget, or permissions. Artifact hashes establish integrity, not independent truth.
- Trae intent routing distinguishes explicit execution (/lazy-start-work and /start-work) from explicit planning (/lazy-ulw-plan and /ulw-plan); ambiguous or denied requests remain plan-only, including supported multilingual denials.

- The installed onboarding guide now matches the repository guide: Node.js LTS 24 is recommended, 22 is the supported alternative, and the lifecycle accepts 20 for compatibility.

## Documentation cleanup

Removed obsolete implementation-session notes and initial port instructions. Current contributor guidance is in AGENTS.md and CONTRIBUTING.md; project credits and licenses remain in NOTICE and LICENSE.

## Measured efficiency

No observed productivity gain, speedup, token-price estimate, or efficiency improvement is claimed for this candidate. Cost comparisons follow the [outcome evaluation protocol](lazytrae-plugin/packages/cli/contracts/OUTCOME-EVALUATION.md) and are limited to explicit host-billed records and matching cohorts.

## Host capability matrix

The package routes below describe available package declarations. The rows remain pending until a fresh host session supplies current host build/edition, selected route, session identity, activation, MCP call, specialist action, cancellation, completion, and actual artifact evidence.

| Host | Package route | Current host evidence |
| --- | --- | --- |
| TraeCode | Project route | Pending: current build/edition/route/session, activation, MCP calls, specialist, cancellation, completion artifact. |
| TraeWork | User Skills route or documented selected route | Pending: current build/edition/route/session, activation, MCP calls, specialist, cancellation, completion artifact. |
| TraeCode CLI | CLI route | Pending: current build/edition/route/session, activation, MCP calls, specialist, cancellation, completion artifact. |

## Migration and upgrade

Keep the published v1.3.0 release as the stable reference. For candidate evaluation, use normal durable lifecycle inventory and package verification; preserve modified, unknown, linked, and caller-owned files. Verify the exact archive or candidate commit independently before host testing. Do not infer archive contents from main-branch CI. No host mutation is included in this preparation.

## Known risks

- Host integration remains pending without current-session observation. CI and host-parser validation do not prove asset discovery, a loaded Skill/command, specialist execution, MCP connectivity, cancellation behavior, or task completion.
- Evaluation hashes only bind supplied evidence bytes; they do not establish that evidence is independently true.

## Rollback

Stop the host session, then use the durable lifecycle rollback/offboard path to return to the exact prior release after reviewing receipt ownership. Remove only unmodified receipt-owned assets; preserve modified, unknown, linked, caller-owned, and host-managed state. Start a fresh session before recording any restored host behavior.
