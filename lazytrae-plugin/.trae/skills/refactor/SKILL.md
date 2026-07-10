<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

---
name: refactor
description: "Safe refactoring discipline. Use when changing code structure without changing behavior. Triggers: refactor, clean up, restructure, reorganize, improve code, rename, extract, move."
---

# refactor

Safe refactoring discipline for LazyTrae. Changes the structure of code without changing its external behavior. Refactoring requires discipline — you must prove the behavior didn't change through tests and small, reversible steps.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/refactor/SKILL.md` — refactoring discipline: characterization tests first, small reversible steps, test after every change, no feature additions during refactoring, rename/move/extract patterns.

## Purpose

Improve code structure, readability, and maintainability WITHOUT changing behavior. Refactoring makes future changes easier and cheaper. The key rule: behavior is preserved at every step.

## Required Context to Inspect

- The code to be refactored (read it thoroughly).
- Existing tests for that code.
- How the code is used by callers.
- The architecture and design constraints.
- Any existing patterns in the codebase to follow.
- The test runner and testing conventions.

## Step-by-Step Procedure

### Phase 0: Safety Check

1. **Do we have tests?** If not, write characterization tests first.
2. **Do we understand the behavior?** Read the code, read the tests, understand what it does.
3. **Is this refactoring worth it?** Weigh the cost against the benefit. Don't refactor just because you can.
4. **Is the code stable?** Don't refactor code that's about to be rewritten.
5. **Do we have a clean starting point?** Commit or stash before starting.

### Phase 1: Pin Behavior with Characterization Tests

1. **Write tests that describe the CURRENT behavior** — whether it's right or wrong.
2. Cover the public API and key internal behaviors.
3. Include edge cases: empty, zero, one, many, error cases.
4. All tests must pass on the unchanged code.
5. These tests are your safety net — they prove behavior didn't change.

### Phase 2: Small Refactoring Steps

Choose the right refactoring for the job. Apply ONE refactoring at a time.

#### Extract Function / Method
1. Identify a coherent block of code that does one thing.
2. Create a new function with a good name.
3. Move the code into the function.
4. Replace the original code with a call to the new function.
5. Run tests. ALL GREEN? → proceed. FAIL? → revert and try again.

#### Rename (Variable / Function / Class / File)
1. Choose a better name that describes what it IS, not what it DOES (unless it's a function).
2. Find all references. Use search + verify each one.
3. Update the name everywhere.
4. Run tests. ALL GREEN? → proceed.

#### Move Code (File / Module)
1. Identify the right home for the code.
2. Move the code to the new location.
3. Update all imports and references.
4. Run tests. ALL GREEN? → proceed.

#### Split Function / Class
1. Identify separate concerns within the function/class.
2. Extract each concern into its own function/class.
3. Keep the original interface but delegate.
4. Run tests after each extraction.

#### Simplify Conditional Logic
1. Replace nested conditionals with guard clauses (early returns).
2. Replace complex conditionals with lookup tables or polymorphism.
3. Combine duplicate branches.
4. Run tests after each simplification.

#### Replace Magic Numbers/Strings with Constants
1. Identify literal values that appear more than once or have non-obvious meaning.
2. Extract to named constants.
3. Update all references.
4. Run tests.

### Phase 3: Verify After Every Step

1. **Run the full test suite** after EVERY single refactoring step.
2. If tests fail: revert immediately. Don't try to fix and continue — you don't know what broke.
3. A step is NOT complete until tests pass.
4. Keep each step small enough that you can revert in 10 seconds.

### Phase 4: Verify the End Result

1. **Full test suite green.** No regressions.
2. **Behavior unchanged.** The characterization tests still pass.
3. **Code is better.** More readable, more maintainable, simpler.
4. **No dead code.** Remove unused functions, variables, imports.
5. **Documentation updated** if the public API changed.

## Refactoring Catalog

| Refactoring | When to Use | Risk |
|-------------|-------------|------|
| Extract function | Long function, duplicated code, nested logic | Low |
| Rename | Bad name, wrong abstraction level | Low |
| Move file/module | Wrong location, wrong module | Medium |
| Split function/class | Doing too many things | Medium |
| Simplify conditionals | Nested ifs, complex boolean logic | Medium |
| Replace conditional with polymorphism | Type-based dispatch | High |
| Introduce parameter object | Many related parameters | Low |
| Replace magic numbers with constants | Repeated literals | Low |
| Consolidate duplicate code | Same logic in multiple places | Medium |
| Remove dead code | Unused code paths | Low |

## Safety Rules

1. **NEVER refactor and add features in the same commit.**
2. **NEVER refactor without tests.** Write characterization tests first.
3. **NEVER skip running tests after a step.** "It should still work" is not proof.
4. **NEVER make multiple changes in one step.** One refactoring at a time.
5. **NEVER ignore a failing test.** Revert and figure out why.
6. **NEVER refactor code you don't understand.** Read it first.
7. **ALWAYS commit before starting a refactoring.** Easy to revert.

## Allowed Edits

- Source code files (structural changes only — no behavior changes).
- Test files (adding characterization tests, updating for new names/locations).
- Import paths (when moving code).
- Configuration (if paths or interfaces changed).

## Forbidden Behavior

- Do NOT add features while refactoring.
- Do NOT fix bugs while refactoring — fix them separately.
- Do NOT skip the characterization test step.
- Do NOT make large changes in one step.
- Do NOT continue when tests fail — revert immediately.
- Do NOT refactor code without reading it first.
- Do NOT leave dead code behind.
- Do NOT rename things without updating all references.

## Verification Gates

1. **Plan reread**: The refactoring goal is achieved, no scope creep.
2. **Automated verification**: Full test suite green, characterization tests pass unchanged.
3. **Manual-QA**: If user-visible, the real surface behaves identically.
4. **Adversarial QA**: Edge cases tested, error paths verified, no regressions.
5. **Cleanup**: No dead code, no unused imports, no leftover debug code.

## Failure Handling

- If a test fails after a step: REVERT IMMEDIATELY. Don't try to fix and continue. Try a smaller step or a different approach.
- If you can't find a safe refactoring path: the design might need a bigger change. Stop refactoring and plan a redesign instead.
- If you break something and can't revert cleanly: `git reset --hard` to the last known good commit.
- If the refactoring takes longer than expected: check if you're actually refactoring or rewriting. If rewriting, stop and plan it properly.

## Output Format

```
REFACTORING REPORT
==================

Goal: <what we're improving>
Starting Point: <commit / state>
Ending Point: <commit / state>

Refactorings Applied:
  1. <name> — <what changed> — tests passed
  2. <name> — <what changed> — tests passed
  ...

Verification:
  - Characterization tests: PASS / FAIL
  - Full test suite: PASS / FAIL
  - Manual-QA: IDENTICAL / CHANGED
  - Dead code removed: yes / no

Improvement: <one-line summary of what got better>
```

## Handoff Target

After refactoring is complete and verified, hand off to `verifier` for formal verification, then to `reviewer` for code quality check. If the refactoring exposed bugs or design issues, hand off to `start-work` with a plan to address them.
