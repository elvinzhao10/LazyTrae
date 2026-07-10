---
name: lazy-ulw-loop
description: "Long-horizon execution loop with ultrawork mode. Decomposes work into systematic, evidence-bound steps and runs until verified completion. Use for durable goal execution, evidence-led work, manual QA, or checkpointed long-running delivery. Triggers: ulw-loop, ulw, ultrawork, durable execution, evidence-led work."
---

# ulw-loop

Long-horizon execution loop that decomposes work into systematic, evidence-bound steps and runs until verified completion. Combines the LazyCodex ulw-loop skill and ultrawork directive into a single Trae-native workflow.

## Canonical LazyCodex Source

- `lazycodex/plugins/omo/components/ulw-loop/skills/ulw-loop/SKILL.md` — loop execution with CLI state, evidence recording, delegation to subagents.
- `lazycodex/plugins/omo/components/ultrawork/skills/ultrawork/SKILL.md` — ultrawork mode directive: tier triage, Manual-QA channels, execution loop (PIN->RED->GREEN->SURFACE->CLEAN), verification gate, constraints.

## Mandatory First Line

**The first user-visible line of output this turn MUST be exactly:**

```
ULTRAWORK MODE ENABLED!
```

## Purpose

Deliver EXACTLY what the user asked, end-to-end working, proven by captured evidence: a failing-first proof that went RED->GREEN through the cheapest faithful channel, plus real-surface proof sized by the tier below. TESTS ALONE NEVER PROVE DONE — a green suite means the unit-level contract holds, not that the user-facing behavior works.

## Required Context to Inspect

- The task brief or goal.
- `AGENTS.md` and `.trae/rules/lazytrae.md`.
- The loop state file: `.lazytraework/state/active-loop.json`.
- The evidence directory: `.lazytraework/evidence/`.
- The ultrawork notepad (if running): persists across turns.

## Tier Triage (classify ONCE at bootstrap; record tier + one-line justification in the notepad; ratchet up only)

Default is LIGHT. Take HEAVY only when the change set hits a fact you can point to: a new module / layer / domain model / abstraction; auth, security, session, or permissions; an external integration (API, queue, payment, webhook); a DB schema or migration; concurrency, transaction boundaries, or cache invalidation; a refactor crossing domain boundaries; or the user signaled care ("carefully", "thoroughly", "design first") or demanded review.

When unsure, take HEAVY. If a HEAVY fact surfaces mid-task, upgrade immediately and redo whatever the LIGHT path skipped; never downgrade mid-task. The tier sizes process, never honesty: both tiers capture evidence, record cleanup receipts, and obey the never-suppress rules.

**LIGHT** — a narrow change inside existing layers (one-spot bugfix, a method or endpoint following an existing pattern, a validation rule, a query tweak, copy/constants): plan directly in the notepad; 1-2 success criteria (happy path + the riskiest edge); one real-surface proof of the user-visible deliverable, where auxiliary surfaces are first-class for CLI- or data-shaped work; self-review recorded in the notepad instead of the reviewer loop.

**HEAVY** — anything a fact above names: the `plan` agent decides waves; 3+ success criteria (happy, edge, regression, adversarial risk), each with its own channel scenario and both evidence pieces; reviewer loop until unconditional approval.

## Bootstrap (DO ALL FIVE BEFORE ANY OTHER WORK — NO SKIPPING)

### 0. Survey the skills, then size the work

First, survey the loaded skill list and read the description of each loosely relevant skill. Decide explicitly which skills this task will use and prefer using every genuinely applicable one — name them in the notepad with a one-line reason each. Skipping a skill that fits the task is a defect.

Then run Tier triage (above) on the change set and record the tier. HEAVY: spawn the `plan` agent (Prometheus) with the gathered context, follow its wave order and parallel grouping exactly, and run the verification it specifies. LIGHT: plan directly in the notepad.

### 1. Create the goal with binding success criteria

Open your reply with a `# Goal` block (treated as binding) using exactly the objective. Do not include status. Goals are unlimited; never invent a numeric budget or limit.

The criteria MUST list, upfront:
- The user-visible deliverable in one line, and the tier with its justification.
- Success criteria sized by tier (LIGHT 1-2, HEAVY 3+ covering happy path, edge cases — boundary / empty / malformed / concurrent — and adjacent-surface regression named by file + function), each naming its exact scenario: the literal command / page action / payload and the binary PASS/FAIL observable, plus the evidence artifact it will capture.
- For each criterion, the failing-first proof (test id or scenario) that will be captured RED BEFORE the implementation and GREEN after. Evidence added after the green code does NOT satisfy this.

These scenarios are the contract. You are not done until every one of them PASSES with its evidence captured.

### 2. Open the durable notepad

Create a notepad file with `RunCommand`: `NOTE=$(mktemp -t ulw-$(date +%Y%m%d-%H%M%S).XXXXXX.md)`. Echo the path. Initialise it with these sections and APPEND (never rewrite) as you work:

```
# Ultrawork Notepad — <one-line goal>
Started: <ISO timestamp>

## Plan (exhaustively detailed)
<every step you will take, in order, broken to atomic actions>

## Success criteria + QA scenarios
<copied from the goal>

## Now
<the single step in progress>

## Todo
<every remaining step, ordered>

## Findings
<every non-obvious fact discovered, with file:line refs>

## Learnings
<patterns / pitfalls / principles to remember next turn>
```

Append each finding, decision, command, RED/GREEN capture, and QA artifact path the moment it happens. Update `## Now` and `## Todo` on every transition. Append-only — never rewrite. This notepad is your durable memory and it OUTLIVES the context window. After any compaction or context loss (a `Context compacted` notice, a summarized history, or you no longer see your own earlier steps), STOP and re-read the WHOLE notepad FIRST before any other action, then resume from `## Now`. Recover state from the notepad; do not re-plan from scratch or re-run completed steps.

### 3. Register obsessive todos via TodoWrite

The todo tool is Trae `TodoWrite` — your live, user-visible checklist. Translate every action from the plan into one todo step — one step per atomic work unit: an edit plus its verification, a QA scenario run, a teardown. Keep each step small enough to finish within a few tool calls.

Call `TodoWrite` on EVERY state transition — the instant a step starts (mark it `in_progress`) and the instant it finishes (mark it `completed` and the next `in_progress`). Exactly ONE `in_progress` at a time. Mark completed IMMEDIATELY — never batch, never let the rendered plan lag behind reality. Add newly discovered steps the moment they surface instead of waiting for the next pass. Step text encodes WHERE / WHY (which criterion it advances) / HOW / VERIFY:
`path: <action> for <criterion> — verify by <check>`.

GOOD pair (test-first, ordered):
  `foo.test.ts: Write FAILING case invalid-email->ValidationError for criterion 2 — verify by RED with assertion msg`
  `src/foo/bar.ts: Implement validateEmail() RFC-5322-lite for criterion 2 — verify by foo.test.ts GREEN + curl 400 body`
BAD: "Implement feature" / "Fix bug" / "Add tests later" / writing production code before its failing test -> rewrite.

### 4. Write initial loop state

Write the goal and success criteria to `.lazytraework/state/active-loop.json` under the `goals` array. Set `active_goal_id` to the new goal. This persists the loop state across sessions.

## Manual-QA Channels

Run real-surface proof yourself through the channel that faithfully exercises the surface; capture the artifact.

| Channel | Tool | Artifact |
|---------|------|----------|
| HTTP call | `curl -i` against live endpoint (or RunCommand) | Status line + headers + body |
| Terminal | `RunCommand` with exact command | Terminal output |
| Browser | Trae Preview (OpenPreview) or agent-browser skill | Screenshot + action log |
| CLI | CLI command with arguments via RunCommand | Exit code + stdout/stderr |
| Data | DB query, config dump, file read | Diff or parsed output |

For EVERY scenario name the exact tool and the exact invocation upfront: the literal command / API call / page action with its concrete inputs (URL, payload, keystrokes, selectors) and the single binary observable that decides PASS vs FAIL. "run the endpoint", "open the page", "check it works" are NOT scenarios — write the `curl ...`, the `send-keys ...`, the Browser action, the `page.click(...)`, the expected status/text.

Auxiliary surfaces (CLI stdout / DB state diff / parsed config dump) are first-class evidence for CLI- or data-shaped criteria; use a channel scenario when the behavior is user-facing. `--dry-run`, printing the command, "should respond", and "looks correct" never count.

## Finding Things (lead with these, parallel-flood the first wave)

Never guess from memory — locate with the right tool, and re-read before you claim or change. Fire 3+ independent lookups in one action; serialize only when one output strictly feeds the next.

- Repo-wide inspection, CLI smoke tests, git/history, bounded command output -> use RunCommand directly: `rg`, `rg --files`, `cat`, and `git`. Narrow huge output before reading it.
- Semantic code questions -> SearchCodebase (Trae's semantic search). Use this for "how/where/what" questions.
- Text / strings / comments / logs -> Grep. File-name discovery -> Glob. Verbatim content -> Read.
- History -> `git log` / `git blame` / `git show` via RunCommand.

When discovery needs multiple angles or the module layout is unfamiliar, delegate to the `explorer` subagent (read-only codebase search, absolute-path results). For research that leaves the repo — library/API/docs/web — delegate to the `librarian` subagent. Spawn them via the Task tool with `subagent_type: "search"` and keep doing root work while they run.

## Execution Loop (PIN -> RED -> GREEN -> SURFACE -> CLEAN)

Until every success criterion PASSES with its evidence captured:

1. **Pick next criterion** -> mark in_progress -> update notepad `## Now`.
2. **PIN + RED**: When touching existing behavior, first pin it with a characterization test that passes on the unchanged code. Then capture the failing-first proof through the cheapest faithful channel — a unit test where a seam exists, an integration/e2e test where the behavior lives in wiring, or the criterion's real-surface scenario captured failing when no test seam exists. It must fail for the RIGHT reason (not a syntax error, not a missing import). Paste RED output into the notepad. No production code yet.
3. **GREEN**: Write the SMALLEST production change that flips RED->GREEN. Re-run the proof. Capture GREEN output. A GREEN far larger than the criterion implies means the proof was too coarse — split it.
4. **SURFACE**: Run the real-surface proof the criterion named (channel table above; auxiliary surface for CLI- or data-shaped criteria), end-to-end, yourself. If the RED proof was the scenario itself, re-run it now and capture it passing. Paste the artifact path into the notepad.
5. **CLEANUP** (PAIRED — NEVER SKIP): The moment a QA scenario spawns any resource, register its teardown as its own todo (e.g. `cleanup: kill server pid for criterion 2 — verify kill -0 fails`). Every runtime artifact the QA spawned in step 4 MUST be torn down before this step completes: server PIDs (`kill <pid>`; verify `kill -0` fails), tmux sessions (`tmux kill-session -t ulw-qa-<criterion>`; verify with `tmux ls`), browser contexts (`.close()`), containers (`docker rm -f`), bound ports (`lsof -i :<port>` empty), temp files / dirs (`rm -rf` the `mktemp` paths), QA-only env vars. Append a one-line cleanup receipt to the notepad next to the artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo; rm -rf /tmp/ulw.aB12cD`. No receipt -> criterion stays in_progress.
6. **Verify**: LSP diagnostics clean on changed files + full test suite green (no skipped, no xfail added this turn).
7. **Mark completed**. Append non-obvious findings / learnings.
8. After each increment, re-run every criterion's scenario. Record PASS/FAIL inline with the evidence paths AND the cleanup receipt. Loop until all PASS.

Parallel-batch independent reads / searches / subagents within a step, but NEVER parallelise RED and GREEN of the same criterion.

## Subagent Reliability (Trae Adaptation)

Every Task tool subagent invocation is self-contained and starts with `TASK: <imperative assignment>`, then names `DELIVERABLE`, `SCOPE`, and `VERIFY`. State that it is an executable assignment, not a context handoff. The Trae Task tool provides independent context by default (equivalent to LazyCodex `fork_context: false`). Paste only the context the child needs.

### Trae vs Codex Subagent Differences

- **Synchronous execution**: Trae's Task tool is synchronous — the parent waits for the subagent to return. Unlike LazyCodex's `multi_agent_v1.wait_agent`, there is no async polling. Plan around this by doing independent root work before spawning, and processing the result when it returns.
- **No TOML-backed role routing**: The Trae Task tool accepts `subagent_type` (e.g., `search`, `general_purpose_task`) but cannot select a LazyCodex TOML-backed role by name. Paste the role requirements into the task description and judge the result from delivered evidence. Never claim a specific role was selected unless runtime evidence confirms it.
- **Result is a single message**: The subagent returns one final summary. There is no mailbox or incremental updates. Structure the task description to request a complete deliverable in the final response.

### Subagent-Dependent Transition Barrier

Do not mark a `TodoWrite` step `completed` while a Task subagent result for that step has not been integrated. Do not start dependent implementation until the audit, research, or review result is integrated or explicitly recorded as inconclusive. Do not generate a plan before spawned research lanes that feed the plan have returned or been closed as inconclusive.

## Verification Gate (TRIGGERED, NOT OPTIONAL)

Trigger when ANY apply:
- Tier is HEAVY.
- User demanded strict, rigorous, or proper review.

LIGHT tier records a self-review in the notepad instead: re-read the diff, run diagnostics, confirm each criterion's evidence, and state in one line why the tier held.

Procedure (NON-NEGOTIABLE):
1. Spawn a Task subagent with a self-contained reviewer assignment. The Trae Task tool cannot select a TOML-backed reviewer role, so paste the reviewer requirements into the task description. Pass: goal, success-criteria, scenario evidence, full diff, notepad path.
2. Treat the reviewer's verdict as binding. There is NO "false positive". Every concern is real. Do not argue. Do not minimise. Do not explain it away.
3. Fix every issue. Re-run the FULL scenario QA. Capture fresh evidence. Update notepad.
4. Re-submit to the SAME reviewer. Loop until you receive an UNCONDITIONAL approval ("looks good but..." = REJECTION).
5. Only on unconditional approval may you declare done. Stopping early IS failure.

## Commits

Atomic, Conventional Commits (`<type>(<scope>): <imperative>` — feat / fix / refactor / test / docs / chore / build / ci / perf). One logical change per commit; each commit builds + tests green on its own. No WIP on the final branch. If a plan file exists, final commit footer: `Plan: .omo/plans/<slug>.md`. Do NOT auto-`git commit` unless the user requested or preauthorised this session — default is stage + draft message + present for approval.

## Constraints

- Every behavior change needs a failing-first proof captured BEFORE the production change, through the cheapest faithful channel (unit test at a seam; integration/e2e in wiring; the real-surface scenario when no test seam exists). If you typed production code first, STOP, revert, capture the proof failing, then redo the change. Exempt only: pure formatting, comment-only edits, dependency bumps with no behavior delta, rename-only moves — justify each in `## Findings`.
- A test that mirrors its implementation — asserting mocks were called, pinning a constant, or unable to fail under any plausible regression — is NOT evidence. Prefer a real-surface proof with no new test over a tautological test.
- Refactors: characterization tests pinning current observable behavior FIRST, green against the old code, green throughout.
- Smallest correct change. No drive-by refactors.
- Never suppress lints / errors / test failures. Never delete, skip, `.only`, `.skip`, `xfail`, or comment out tests to green the suite.
- Never claim done from inference — only from captured evidence.
- Parallel tool calls for any independent work.

## Output Discipline

- First line literally: `ULTRAWORK MODE ENABLED!`
- After bootstrap: 1-2 paragraph plan summary + notepad path.
- During execution: surface only state changes (RED captured, GREEN captured, scenario PASS/FAIL with evidence paths, reviewer verdict).
- Final message: outcome + success-criteria checklist with evidence refs + notepad path + reviewer approval (if gate triggered) + commit list (`<sha> <subject>`). No file-by-file changelog unless asked.

## Stop Rules

- Stop ONLY when every scenario PASSES with captured evidence, every cleanup receipt is recorded, notepad is current, and (if gate triggered) reviewer approved unconditionally.
- Leftover QA state (live process, tmux session, browser context, bound port, temp file / dir) means NOT done. Tear it down, record the receipt, then continue.
- After 2 identical failed attempts at one step, surface what was tried and ask the user before another retry.
- After 2 parallel exploration waves yield no new useful facts, stop exploring and act.

## Allowed Edits

- Write to `.lazytraework/state/active-loop.json`.
- Write evidence files to `.lazytraework/evidence/`.
- Create and edit the ultrawork notepad.
- Delegate code edits to subagents.
- Run verification commands.

## Forbidden Behavior

- Never mark a step complete while a child agent owns evidence for that step.
- Never suppress lints, errors, or test failures. Never delete, skip, or comment out tests.
- Never claim done from inference — only from captured evidence.
- Never parallelize RED and GREEN of the same criterion.
- Never leave QA state (live process, tmux session, browser context, bound port, temp file) running. Tear it down, record the receipt.
- After 2 identical failed attempts at one step, surface what was tried and ask.

## Verification Gates

1. **Plan reread**: Every criterion has evidence captured.
2. **Automated verification**: Tests green, lint clean, typecheck passes.
3. **Manual-QA**: Real-surface artifact captured for every criterion.
4. **Adversarial QA**: Edge cases and regression scenarios exercised.
5. **Cleanup**: All QA resources torn down, receipts recorded.

## Failure Handling

- If a subagent fails: investigate, record the reason, respawn with narrowed scope.
- If verification fails: diagnose, fix, rerun.
- After 2 identical failed attempts: surface what was tried and ask the user.
- After 2 parallel exploration waves yield no new useful facts: stop exploring and act.

## Handoff Target

After loop completion, produce a handoff summary with `handoff`. If the loop is part of a larger plan, hand off to `start-work` for the next plan phase.
