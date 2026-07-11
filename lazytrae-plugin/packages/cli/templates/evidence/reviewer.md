# Adversarial QA Evidence (Reviewer)

> **Gate 4: Adversarial QA** — Edge cases, regression scenarios, adversarial inputs.
> LazyCodex source: `lazycodex/packages/web/content/docs/manual-qa.md`

## Template

### Plan Under Review

- **Plan file**: `.lazytrae/plans/<plan-name>.md`
- **Reviewer**: `<agent name>`
- **Date**: `<ISO 8601 date>`

### Adversarial Classes

For each applicable adversarial class, run the specific probe and record the result.

#### 1. Malformed Input

**When applicable**: New input parsing (file reads, JSON parsing, CLI args, user input).

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Invalid JSON | Parse error, not crash | `<actual>` | PASS/FAIL |
| Empty input | Graceful handling | `<actual>` | PASS/FAIL |
| Boundary values | Correct behavior | `<actual>` | PASS/FAIL |
| Special characters | No corruption | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 2. Prompt Injection

**When applicable**: Untrusted external text enters the agent prompt.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Escape sequences | Sanitized output | `<actual>` | PASS/FAIL |
| Injection payloads | No unintended execution | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 3. Cancel/Resume

**When applicable**: Resumable flows (checkpointing, state saves).

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Cancel mid-operation | State preserved | `<actual>` | PASS/FAIL |
| Resume from checkpoint | Correct continuation | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 4. Stale State

**When applicable**: Generated/cached artifacts.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Stale cache | Cache invalidation | `<actual>` | PASS/FAIL |
| Expired data | Refresh or error | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 5. Dirty Worktree

**When applicable**: Uncommitted files.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Modified unstaged files | Correct handling | `<actual>` | PASS/FAIL |
| Untracked files | Correct handling | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 6. Hung Commands

**When applicable**: Long external commands.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Timeout behavior | Clean timeout, no hang | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 7. Flaky Tests

**When applicable**: Timing-sensitive tests.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Run 5 times | Consistent results | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 8. Misleading Output

**When applicable**: Log-based success claims.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Verify actual observable | Match expected, not just log | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

#### 9. Repeated Interruptions

**When applicable**: Mid-operation interrupts.

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Signal handling | Clean shutdown | `<actual>` | PASS/FAIL |
| Partial writes | No corruption | `<actual>` | PASS/FAIL |

**Evidence**: `<path to artifact or inline output>`

### Adversarial QA Verdict

- **Overall**: PASS / FAIL / BLOCKED
- **Classes probed**: `<N>/9`
- **Classes N/A**: `<list>` (with one-line reason each)
- **Classes failed**: `<list>`

---

## Example (filled)

### Plan Under Review

- **Plan file**: `.lazytrae/plans/v0.5-state-machine.md`
- **Reviewer**: Oracle
- **Date**: 2026-07-09

### Adversarial Classes

#### 1. Malformed Input — PASS

| Probe | Expected | Result | Verdict |
|-------|----------|--------|---------|
| Invalid JSON | Parse error, not crash | `python3 -m json.tool` rejects invalid JSON with error message | PASS |
| Empty input | Graceful handling | Empty state files have valid structure with empty arrays/objects | PASS |

**Evidence**: `python3 -m json.tool` exits with non-zero on invalid JSON; state files are valid JSON with empty arrays.

#### 2. Prompt Injection — N/A

No untrusted external text enters the agent prompt in this context.

#### 3. Cancel/Resume — N/A

No resumable flows in this deliverable (state files are static).

#### 4. Stale State — N/A

No cached artifacts in this deliverable.

#### 5. Dirty Worktree — N/A

State files are new; no uncommitted files conflict.

#### 6. Hung Commands — N/A

No long-running commands in this deliverable.

#### 7. Flaky Tests — N/A

No timing-sensitive tests in this deliverable.

#### 8. Misleading Output — N/A

No log-based success claims in this deliverable.

#### 9. Repeated Interruptions — N/A

No mid-operation interrupts in this deliverable.

### Adversarial QA Verdict

- **Overall**: PASS
- **Classes probed**: 1/9
- **Classes N/A**: 8 (prompt injection, cancel/resume, stale state, dirty worktree, hung commands, flaky tests, misleading output, repeated interruptions) — no applicable surface in static state/config files.
- **Classes failed**: None
