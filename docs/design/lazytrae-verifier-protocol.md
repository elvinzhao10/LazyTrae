# LazyTrae Verifier Protocol

> **v0.9 — Long-Horizon Execution Loop.** Part of the v0.x series.
> This document specifies when verification runs, what it checks, how evidence is recorded, and what happens on pass/fail.

## 1. When Verification Runs

Verification triggers after each bounded implementation unit (step 7 of the loop cycle):

| Trigger | Condition |
|---------|-----------|
| After implementation | Atlas/Hephaestus reports task unit complete. Loop transitions `active` → `verifying`. |
| After re-implementation | After a verification failure, the fix is applied and verification re-runs. |
| After ITERATE fix | After Oracle ITERATE, fixes are applied and verification re-runs before re-review. |
| On resume | If loop resumes in `verifying` state, re-run verification for the current task. |

Verification runs BEFORE review. A task that fails verification never reaches Oracle.

## 2. What Verification Checks

Four categories of automated checks, plus one manual-QA channel:

### 2.1 Automated Tests

Run the project's test suite on changed files:
- Test runner: whatever the project uses (vitest, jest, pytest, etc.).
- Only changed files and their dependents need to be tested.
- Full suite green required (no skipped, no xfail, no `.only`).
- Evidence: test output captured with exit status.

Source: `lazycodex/packages/web/content/docs/tdd.md`.

### 2.2 Linters

Run the project's linter on changed files:
- JavaScript/TypeScript: `biome check` or `eslint`.
- Python: `ruff check` or `flake8`.
- Zero errors, zero warnings.
- Evidence: linter output captured.

### 2.3 Type Checks

Run the project's type checker:
- TypeScript: `tsc --noEmit`.
- Python: `mypy --strict`.
- Zero type errors.
- Evidence: type checker output captured.

### 2.4 Build

Run the project's build:
- `npm run build`, `cargo build`, etc.
- Must pass without errors.
- Evidence: build output captured.

### 2.5 Manual-QA

Real-surface proof through one of the Manual-QA channels:

| Channel | Tool | Artifact |
|---------|------|----------|
| HTTP | `curl -i` against live endpoint | Status line + headers + body |
| CLI | `RunCommand` with exact command | Exit code + stdout/stderr |
| Browser | Trae Preview or agent-browser skill | Screenshot + action log |
| tmux | `tmux send-keys` + `capture-pane` | Transcript |
| Data | DB query, config dump, file read | Diff or parsed output |

The Manual-QA scenario must be the exact, literal command/action with concrete inputs and a single PASS/FAIL observable. "Run the endpoint" is not a scenario — write the exact `curl` command.

Source: `lazycodex/plugins/omo/components/ultrawork/directive.md` Manual-QA channels section.

## 3. Evidence Recording Format

Each verification run produces evidence at `.lazytraework/evidence/test-runs.md`:

```markdown
## Verification Run — <timestamp>

### Task: <task-id> — <task-description>

#### Automated Tests
- Command: `<test command>`
- Exit status: `<0 or non-zero>`
- Output:
\`\`\`
<test output>
\`\`\`

#### Linter
- Command: `<lint command>`
- Exit status: `<0 or non-zero>`
- Output:
\`\`\`
<lint output>
\`\`\`

#### Type Check
- Command: `<typecheck command>`
- Exit status: `<0 or non-zero>`
- Output:
\`\`\`
<typecheck output>
\`\`\`

#### Build
- Command: `<build command>`
- Exit status: `<0 or non-zero>`
- Output:
\`\`\`
<build output>
\`\`\`

#### Changed Files
- `<file-path>`
- ...

#### Manual-QA
- Channel: `<cli|http|tmux|browser|data>`
- Invocation: `<exact command/action>`
- Expected: `<what should happen>`
- Actual: `<what actually happened>`
- Verdict: `<PASS|FAIL>`
```

Evidence is also recorded in the loop event log as a `verification_passed` or `verification_failed` event.

Evidence must be non-empty (from `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts` line 49-51: `nonEmptyEvidence` throws if evidence string is empty or whitespace-only).

## 4. Pass/Fail Criteria

### PASS

All of:
1. Automated tests exit 0 (all green, no skipped/xfail).
2. Linter exits 0 (zero errors, zero warnings).
3. Type checker exits 0 (zero errors).
4. Build exits 0.
5. Manual-QA scenario produces the expected observable.

### FAIL

Any of:
1. Any test fails (exit non-zero or unexpected output).
2. Linter reports errors or warnings.
3. Type checker reports errors.
4. Build fails.
5. Manual-QA scenario does not produce the expected observable.
6. Evidence is empty or missing.

## 5. Retry Behavior

From LazyCodex `checkpoint.ts` and `steering.ts`: max 3 retries before blocking.

| Attempt | Action |
|---------|--------|
| 1st failure | Diagnose the failure. Fix the issue. Re-run verification. `retry_count` = 1. |
| 2nd failure | Diagnose more thoroughly. Fix the issue. Re-run verification. `retry_count` = 2. |
| 3rd failure | Diagnose one more time. Fix the issue. Re-run verification. `retry_count` = 3. |
| 4th failure (retry_count >= 3) | Mark task as `blocked`. Record blocker. Transition loop to `blocked`. Ask user for direction. |

After 2 identical failed attempts at one step, surface what was tried and ask the user before another retry (from `directive.md` Stop rules).

Each retry increments `retry_count` in `active-loop.json`. The `max_retries` field is always 3.

## 6. Failure Diagnosis

When verification fails:

1. **Read the failing output** — Identify which check failed and why.
2. **Diagnose the root cause** — Is it a code bug, a test that needs updating, a configuration issue?
3. **Check changed files** — Did the implementation change introduce a regression?
4. **Check the task specification** — Does the implementation actually satisfy the acceptance criteria?
5. **Record the diagnosis** — Append to the notepad with the failure reason.
6. **Apply the fix** — Smallest correct change. No drive-by refactors.
7. **Re-run verification** — Start from the first check (tests → linter → typecheck → build → manual-QA).

If the failure persists after 2 identical attempts, surface what was tried and ask the user.

## 7. Manual-QA Channel Requirements

From `lazycodex/plugins/omo/components/ultrawork/directive.md`:

- The scenario MUST name the exact tool and exact invocation upfront.
- The scenario MUST have a single binary observable that decides PASS vs FAIL.
- "Run the endpoint", "open the page", "check it works" are NOT valid scenarios.
- For HTTP: write the exact `curl` command with URL, method, headers, body.
- For CLI: write the exact shell command with all arguments.
- For Browser: write the exact `page.click(...)`, `page.fill(...)`, or equivalent.
- Auxiliary surfaces (CLI stdout, DB state diff, config dump) are first-class evidence for CLI- or data-shaped criteria.
- `--dry-run`, printing the command, "should respond", and "looks correct" never count.

## 8. Cleanup

After Manual-QA, ALL resources MUST be torn down:

- Server PIDs: `kill <pid>`; verify `kill -0` fails.
- tmux sessions: `tmux kill-session -t ulw-qa-<criterion>`.
- Browser contexts: `.close()`.
- Containers: `docker rm -f`.
- Bound ports: `lsof -i :<port>` empty.
- Temp files/dirs: `rm -rf` the `mktemp` paths.
- QA-only env vars: unset.

A one-line cleanup receipt is required. No receipt → verification stays `in_progress`.

Source: `directive.md` Execution Loop step 5 (CLEANUP).

## 9. References

- LazyCodex evidence: `lazycodex/plugins/omo/components/ulw-loop/src/evidence.ts`
- LazyCodex checkpoint: `lazycodex/plugins/omo/components/ulw-loop/src/checkpoint.ts`
- LazyCodex ultrawork directive: `lazycodex/plugins/omo/components/ultrawork/directive.md`
- LazyCodex TDD docs: `lazycodex/packages/web/content/docs/tdd.md`
- LazyTrae state machine: `docs/lazytrae-state-machine.md`
- LazyTrae execution loop: `docs/lazytrae-execution-loop.md`
