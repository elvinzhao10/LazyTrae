---
name: lazy-debugging
description: "Systematic debugging workflow. Use when something doesn't work and you need to find out why. Triggers: debug, fix bug, not working, error, failing, crash, broken, investigate."
---

# debugging

Systematic debugging discipline for LazyTrae. Provides a structured approach to finding and fixing bugs — from symptom identification to root cause analysis to verified fixes. Debugging is not guessing — it's hypothesis-driven investigation.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/debugging/SKILL.md` — systematic debugging workflow: reproduce, isolate, hypothesize, test, fix, verify, prevent recurrence. Also referenced in ultrawork directive's failure handling section.

## Purpose

Find and fix bugs efficiently without introducing regressions. Good debugging is systematic: you form hypotheses, test them, and learn from each result. You don't randomly change things hoping the problem goes away.

## Required Context to Inspect

- The bug report or error message.
- The expected behavior vs actual behavior.
- Steps to reproduce (if available).
- The files and components involved.
- Recent changes that might have introduced the bug.
- Test output (failing tests, stack traces).
- Logs or error messages.

## Step-by-Step Procedure

### Phase 1: Reproduce

1. **Reproduce the bug consistently.** If you can't reproduce it, you can't fix it.
2. Write down the EXACT steps: input, environment, expected result, actual result.
3. Minimize the reproduction case — strip away everything that doesn't matter.
4. Create a failing test that demonstrates the bug. This is your RED proof.
5. If it's intermittent: find the variable (timing, data, order, concurrency).

### Phase 2: Isolate

1. **Narrow down where the bug is.** Use binary search on the codebase.
2. Add logging or breakpoints at key points in the flow.
3. Check inputs and outputs at each boundary.
4. Use `git bisect` to find the commit that introduced the bug.
5. Once you find the commit, read its diff carefully.
6. Rule out possibilities one by one. Don't assume — verify.

### Phase 3: Hypothesize

1. **Form a specific hypothesis about the root cause.** Not "it's broken" — "the X function returns Y when given Z because it doesn't handle the W case."
2. The hypothesis must be falsifiable — there must be a test that could prove it wrong.
3. Write down the hypothesis before testing it.
4. Consider multiple hypotheses. Don't fixate on the first one.
5. Rank hypotheses by likelihood and ease of testing.

### Phase 4: Test the Hypothesis

1. **Design the smallest experiment that tests your hypothesis.**
2. Run the experiment. Observe the result.
3. If the hypothesis is wrong: cross it off, form a new one, repeat.
4. If the hypothesis is right: you've found the root cause. Move to fixing.
5. Keep a log of what you tried and what you learned.

### Phase 5: Fix

1. **Fix the ROOT CAUSE, not the symptom.**
2. Make the smallest change that fixes the bug.
3. The failing test from Phase 1 should now pass (GREEN).
4. Don't refactor during bug fixes — that can introduce new bugs.
5. If the fix is complex, consider whether a redesign is needed (and plan it separately).

### Phase 6: Verify

1. **Run the full test suite.** No regressions.
2. Run the reproduction case manually. Bug is gone.
3. Check related code for similar bugs — if you found one, there are probably more.
4. Consider edge cases: empty input, large input, concurrent access, error recovery.
5. Run Manual-QA on the real surface if the bug was user-visible.

### Phase 7: Prevent Recurrence

1. Add a regression test that would have caught this bug.
2. If the bug was in a shared utility, add validation to catch it earlier.
3. Update documentation if the behavior was misunderstood.
4. Consider adding type safety or runtime assertions at the boundary.
5. Note the pattern — what kind of bug was this, and how can we catch similar ones faster next time?

## Debugging Heuristics

### Common Bug Categories

| Category | Symptoms | How to Find |
|----------|----------|-------------|
| Off-by-one | Wrong count, fencepost errors | Check boundary values (0, 1, N, N+1) |
| Null/undefined | TypeError, "cannot read property" | Trace variable lifecycle, check initialization |
| Race condition | Intermittent, timing-dependent | Add delays, test with concurrent access |
| State leak | Works first time, fails second | Check global state, caches, singletons |
| Wrong data type | Coercion bugs, comparison failures | Check types at boundaries |
| Scope issue | Variable shadowing, closure over loop variable | Check variable declarations and scopes |
| Async/sync mix | Order wrong, missing data | Check promise chains, async/await usage |
| Path dependency | Works in one order, not another | Check initialization order, dependencies |

### Debugging Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `console.log` / `print` | See values at runtime | Quick sanity check |
| Debugger / breakpoints | Step through code | Complex control flow |
| `git bisect` | Find introducing commit | Regression bug |
| `git blame` | See when code was added | "Why is this here?" |
| Profiler | Performance issues | Slow code, memory leaks |
| Test case | Reproduce reliably | Any bug worth fixing |
| Binary search on code | Isolate the problem | Large unknown area |

## Allowed Edits

- Source code files (bug fixes only — no feature additions).
- Test files (adding regression tests).
- Logging/debug output (temporary, removed before completion).
- Configuration (only if the bug is config-related).

## Forbidden Behavior

- Do NOT randomly change things and see if the bug goes away.
- Do NOT fix symptoms instead of root causes.
- Do NOT add features while fixing bugs.
- Do NOT refactor during bug fixes.
- Do NOT remove the failing test — it's your proof.
- Do NOT leave debug logging in the final code.
- Do NOT assume you know the cause without verifying.
- Do NOT skip the verification step.

## Verification Gates

1. **Plan reread**: The bug is understood and the fix targets the root cause.
2. **Automated verification**: Full test suite green, including the new regression test.
3. **Manual-QA**: The reproduction case no longer fails on the real surface.
4. **Adversarial QA**: Related code checked for similar bugs; edge cases tested.
5. **Cleanup**: No debug logging, no dead code, no unrelated changes.

## Failure Handling

- If you can't reproduce the bug: collect more information. Ask for exact steps, environment details, error messages.
- If you can't find the root cause after 30 minutes: take a break, explain the problem to someone (or a rubber duck), come back fresh.
- If the fix introduces new failures: revert and try a different approach. Don't pile fixes on fixes.
- If the bug is in a third-party library: check for known issues, consider workarounds, file an upstream bug.

## Output Format

```
DEBUGGING REPORT
================

Bug: <one-line description>
Status: FIXED / INVESTIGATING / BLOCKED

Root Cause: <specific, not vague>
Fix: <what was changed, file:line>

Verification:
  - Regression test added: yes / no
  - Full test suite: PASS / FAIL
  - Manual reproduction: FIXED / STILL FAILS
  - Related code checked: yes / no

Lessons Learned:
  - Pattern: <what kind of bug>
  - Prevention: <how to catch similar ones earlier>
```

## Handoff Target

After the bug is fixed and verified, hand off to `verifier` for formal verification, then to `reviewer` for code quality check. If the investigation is blocked, hand off with specific information about what's needed to proceed.
