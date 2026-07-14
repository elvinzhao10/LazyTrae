---
name: lazy-programming
description: "General programming discipline and best practices. Use for any implementation work to ensure code quality, correctness, and maintainability. Triggers: implement, code, build, develop, write code, add feature, fix bug."
---

# programming

General programming discipline for LazyTrae. Ensures implementation work follows best practices for correctness, maintainability, and quality. This skill is not a substitute for domain-specific skills — it provides the baseline discipline that every implementation task should follow.

## Scope


## Purpose

Ensure every code change is correct, maintainable, and follows established patterns. Programming discipline prevents bugs before they happen by enforcing a consistent approach to implementation work.

## Required Context to Inspect

- The files being modified (read them before editing).
- Existing patterns in the codebase (neighboring files, similar functions).
- The project's language, framework, and conventions.
- The test runner and testing conventions.
- The lint and typecheck configuration.
- Any relevant design docs or architecture decisions.

## Step-by-Step Procedure

### 1. Read Before Writing

1. Read the actual files you will modify — never edit from memory.
2. Read neighboring files to understand patterns and conventions.
3. Search the codebase for similar patterns to follow existing style.
4. Identify the smallest surface area that needs to change.
5. Confirm the change is necessary — don't refactor what works.

### 2. Smallest Correct Change

1. Make the SMALLEST change that achieves the goal.
2. No drive-by refactoring. No "while I'm here" improvements.
3. Keep the diff focused. Each commit changes one logical thing.
4. If you see unrelated issues, note them but fix them separately.
5. Prefer adding code over changing existing code when possible.

### 3. Naming

1. Names should describe WHAT the thing does, not HOW it does it.
2. Follow existing naming conventions in the codebase (camelCase, snake_case, PascalCase).
3. Booleans start with `is`, `has`, `can`, `should`.
4. Functions are verbs or verb phrases.
5. Variables/constants are nouns or noun phrases.
6. Avoid abbreviations unless they're domain-standard.
7. If you can't think of a good name, the design might be wrong.

### 4. Error Handling

1. Every error path must be handled — no silent failures.
2. Throw or return errors with enough context to debug.
3. Don't catch errors you can't handle; let them propagate.
4. Validate inputs at boundaries (function entry, API surface).
5. Use specific error types, not generic `Error`.
6. Never swallow errors with empty catch blocks.

### 5. Type Safety

1. Use the type system to prevent bugs.
2. Avoid `any`, `unknown`, or untyped values.
3. Type external data at the boundary (API responses, config, user input).
4. Use discriminated unions for state machines.
5. Make invalid states unrepresentable.

### 6. Testing Discipline

1. Every behavior change needs a test.
2. Write the failing test first (RED), then make it pass (GREEN).
3. Tests should test behavior, not implementation.
4. Test the boundary conditions: empty, zero, one, many, max, overflow.
5. Test error paths, not just happy paths.
6. A test that can't fail is not a test — delete it.

### 7. Performance Awareness

1. Don't optimize prematurely, but don't pessimize either.
2. Use appropriate data structures for the access pattern.
3. Avoid O(n^2) in hot paths when n can be large.
4. Cache expensive computations that are used repeatedly.
5. Profile before optimizing — guesses are usually wrong.

### 8. Readability

1. Code is read more often than it's written. Optimize for the reader.
2. Prefer clarity over cleverness.
3. Functions should do one thing and do it well.
4. Keep functions short enough to fit on a screen.
5. Use whitespace to group related logic.
6. Comments explain WHY, not WHAT. The code already says WHAT.

### 9. Refactoring Safety

1. Before refactoring, pin the current behavior with tests.
2. Refactor in small, reversible steps.
3. Run tests after every step.
4. Don't refactor and add features in the same commit.
5. Use rename/move operations when possible instead of rewrite.

## Allowed Edits

- Source code files (implementation changes).
- Test files (adding/updating tests).
- Configuration files (when the change requires it).
- Documentation (when behavior changes).

## Forbidden Behavior

- Do NOT edit files you haven't read.
- Do NOT make changes larger than necessary.
- Do NOT add features that weren't requested.
- Do NOT skip tests for behavior changes.
- Do NOT leave error paths unhandled.
- Do NOT use `any` or untyped values without justification.
- Do NOT commit commented-out code.
- Do NOT add TODO/FIXME comments without a tracking issue.

## Verification Gates

1. **Plan reread**: Change matches the requirement, nothing extra.
2. **Automated verification**: Tests green, lint clean, typecheck passes.
3. **Manual-QA**: The feature works as specified through the real surface.
4. **Adversarial QA**: Edge cases handled, error paths tested.
5. **Cleanup**: No dead code, no unused imports, no debug logs left.

## Failure Handling

- If tests fail: read the error, understand the root cause, fix it. Don't patch symptoms.
- If you get stuck: write down what you know, what you don't know, and formulate a hypothesis to test.
- If a refactor breaks things: revert to the last known good state and try a smaller step.
- If you can't reproduce a bug: add logging, write a test, narrow the scope.

## Output Format

Implementation work should produce:
1. A short summary of what was changed.
2. Test results (all green).
3. Evidence of correctness (Manual-QA artifacts if applicable).
4. Files changed (list with line counts).

## Handoff Target

After implementation, hand off to `verifier` for verification gates, then to `reviewer` for the Oracle/protocol review. If bugs are found during verification, hand back to programming with specific fixes.
