<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

---
name: remove-ai-slops
description: "Remove AI-generated code smells (slop) from branch changes or an explicit file list. Locks behavior with regression tests FIRST, then runs categorized cleanup, then verifies with quality gates. Covers 10 slop categories. Use when the user asks to remove slop, clean AI code, deslop, or clean up AI-generated patterns. Triggers: remove ai slops, clean ai code, deslop, cleanup AI generated, remove AI slop, strip slop, ai-slop cleanup."
---

# remove-ai-slops

Clean AI-generated slop from a bounded set of changed files while strictly preserving behavior. Locks behavior with regression tests first, then runs a categorized multi-pass cleanup, then verifies with quality gates and a critical review.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/remove-ai-slops/SKILL.md` — 10 slop categories (stylistic, structural, hidden cost, behavior coverage), deletion ladder, parallel slop removal via deep agents in batches of 5, quality gates, critical review checklist.

## Purpose

Remove AI-generated code smells from changed files while preserving behavior. The core safety invariant: **behavior is locked by green tests before a single line is removed**. A checklist alone is not safety; a passing regression test is.

## Required Context to Inspect

- The scope of files to clean (branch diff vs merge-base main, or explicit file list).
- The project's test runner and lint configuration.
- Existing test coverage for the changed files.
- The project's coding conventions and style guide.

## Step-by-Step Procedure

### Phase 0: Plan with TodoWrite

Create todos for all phases. Mark in_progress one at a time.

### Phase 1: Determine Scope

If file paths were passed as arguments, that is the scope. Otherwise:
```bash
git diff $(git merge-base main HEAD)..HEAD --name-only
```
Filter out: deleted files, binary files, generated/vendored files (node_modules/, dist/, target/, lockfiles).

### Phase 2: Lock Behavior with Regression Tests

For each in-scope source file:
1. Identify the public/observable behavior the file exposes.
2. Check whether existing tests cover that behavior.
3. **If behavior is uncovered, write the narrowest regression test that pins current behavior BEFORE editing.**
4. Run the test suite. Tests must be **green** before any cleanup begins.

If you cannot establish a green baseline, STOP and report. Do not proceed.

### Phase 3: Cleanup Plan — Existence First, Then Smells

Before categorizing smells, run the **deletion ladder** on each changed unit:
- **Delete entirely** — the behavior is not needed (YAGNI, speculative, dead on arrival).
- **Reuse** — an existing helper or pattern already does it.
- **Platform/stdlib/native/dependency** — the language or runtime already does it.
- **Simplify in place** — it must exist; make it smaller.

Only code that lands on "Simplify in place" proceeds to smell categories.

### Phase 4: Cleanup by Category

Apply changes in order (safest → riskiest):
1. **Obvious comments** — comments restating code, trivial docstrings, section dividers, commented-out code, vague TODOs. KEEP: comments explaining WHY, ticket links, regex/algorithm explanations.
2. **Dead code** — unused imports, unused private functions, unreachable branches, stale feature flags, debug leftovers. KEEP: code referenced via reflection or dynamic dispatch.
3. **Over-defensive code** — null checks for guaranteed values, try/except around code that cannot raise, broad exception catching. KEEP: validation at system boundaries, I/O error handling.
4. **Duplication** — copy-pasted branches with trivial differences, redundant helpers. KEEP: incidental duplication serving different intents.
5. **Excessive complexity** — deep nesting (>3 levels), nested ternaries, long parameter lists (>5 args), god functions (>50 lines), if/elif chains for type discrimination. KEEP: performance-critical hot paths.
6. **Needless abstraction** — pass-through wrappers, single-use helpers, speculative indirection. KEEP: abstractions that provide real seams.
7. **Boundary violations** — wrong-layer imports, leaky responsibilities, hidden coupling. KEEP: pragmatic short-circuits already established.
8. **Performance equivalences** — behavior-preserving optimizations: O(n²)→O(n), hoist loop invariants, unnecessary intermediate collections. Only apply when equivalence is obvious.
9. **Missing tests** — ADD the narrowest test that pins the behavior (do not remove code).
10. **Oversized modules** — files exceeding 250 pure LOC. Execute a full modular refactoring: identify distinct responsibilities, plan the split, extract into clean modules.

### Phase 5: Verify with Quality Gates

| Gate | Tool | Pass condition |
|------|------|----------------|
| Regression tests | Project's test runner | All green |
| Lint | Project's linter | Zero errors (warnings OK if pre-existing) |
| Typecheck | Project type-checker | Zero new errors |
| Unit/integration tests | Project's test runner | All green |
| Static/security scan | Project's scanner | Zero new findings, or N/A if not configured |

### Phase 6: Critical Review

Walk the critical review checklist:
- **Safety**: No functional logic removed, error handling preserved, type hints intact, imports valid, no breaking changes to public APIs.
- **Behavior**: Return values unchanged, side effects unchanged, exception behavior unchanged, edge case handling preserved.
- **Quality**: Removed changes are genuinely slop, remaining code follows project conventions, no orphaned code, performance changes are obviously equivalent.

### Phase 7: Fix Issues

If any gate fails or checklist item flips:
1. Identify the specific change that caused the failure.
2. Revert just the problematic change.
3. Re-run the failing gate.
4. If you fail three times on the same file, STOP and escalate.

## Allowed Edits

- Edit files in the cleanup scope.
- Write regression tests.
- Run test suites, linters, typecheckers.
- Revert problematic changes.

## Forbidden Behavior

- Do NOT skip Phase 2 (regression tests). Removing code on uncovered ground is a behavior-change time bomb.
- Do NOT bundle unrelated refactors in a single cleanup commit.
- Do NOT change algorithm behavior under the guise of "performance optimization."
- Do NOT remove comments that explain WHY (only those that restate WHAT).
- Do NOT touch files outside scope.
- Do NOT claim PASS without evidence.
- When in doubt, SKIP — do not GUESS.

## Verification Gates

1. **Plan reread**: All changes are in the cleanup plan, no unexpected edits.
2. **Automated verification**: All tests green, lint clean, typecheck passes.
3. **Manual-QA**: Diff review confirms only slop removed, behavior preserved.
4. **Adversarial QA**: Edge cases still handled, error paths still work.
5. **Cleanup**: No temporary files, no orphaned code.

## Failure Handling

- If a test fails after cleanup: `git checkout` the affected file, re-edit with only safe changes.
- If three failures on the same file: STOP, escalate with file, what was tried, what failed, hypothesis.
- If a quality gate is N/A: report `N/A` explicitly with reason.

## Output Format

```
AI SLOP REMOVAL REPORT
======================

Scope: [branch diff vs merge-base main / explicit file list]
Files: [N files]

Behavior Lock:
  - Existing coverage: [N files already covered]
  - Tests added: [M new regression tests]
  - Baseline status: GREEN

Cleanup Plan:
  [Per-file: ladder + categories + order + risk]

Per-File Results:
  [Each change: before/after, why-slop, why-safe]
  [Each skip: reason]

Quality Gates:
  - Regression tests: PASS
  - Lint: PASS
  - Typecheck: PASS
  - Unit/integration tests: PASS
  - Static/security scan: N/A

Critical Review:
  - Safety: PASS
  - Behavior: PASS
  - Quality: PASS

Net Impact:
  - LOC: -N (removed N, added M)

Final Status: CLEAN | ISSUES FIXED | REQUIRES ATTENTION
```

## Handoff Target

After cleanup, hand off to `verifier` for final verification, then `handoff` for session completion.