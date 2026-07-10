---
name: ast-grep
description: "Structural code search and rewriting using AST patterns. Use when you need to find or rewrite code by its structure, not just its text. Triggers: ast-grep, sg, structural search, codemod, find pattern, rewrite code, AST search."
---

# ast-grep

Structural code search and rewriting using AST (Abstract Syntax Tree) patterns. Find and rewrite code by its structure, not just by text matching. More powerful than regex because it understands the code's syntax.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/ast-grep/SKILL.md` — structural code search: AST pattern matching, find-and-rewrite codemods, pattern syntax, multi-file search, safety checks.

## Purpose

Search and transform code structurally. Use ast-grep when regex isn't enough: finding specific function calls, refactoring API usage across a codebase, finding anti-patterns, or doing large-scale codemods safely.

## Required Context to Inspect

- The codebase language (JavaScript, TypeScript, Python, etc.).
- What you're searching for (function call, pattern, anti-pattern).
- What you want to do (find only, or find and rewrite).
- The scope (whole repo, specific directory, specific files).
- Safety: is this a read-only search or a destructive rewrite?

## Step-by-Step Procedure

### Phase 1: Explore and Understand

1. **Install ast-grep if needed:**
   ```bash
   npm install -g @ast-grep/cli
   # or
   brew install ast-grep
   ```
2. **Check language support.** ast-grep supports: JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Ruby, PHP, HTML, CSS, and more.
3. **Understand the target code.** Read a few examples of the pattern you're looking for.

### Phase 2: Write the Search Pattern

1. **Write a pattern** that matches the code structure. Use `$VAR` as wildcards:
   ```yaml
   # Find all console.log calls
   pattern: console.log($$$ARGS)
   ```
2. **Use `$` for single-node wildcards:**
   - `$VAR` — matches a single AST node
   - `$$$ARGS` — matches zero or more nodes (like function arguments)
   - `$` — anonymous wildcard (you don't care about the name)
3. **Use `inside` / `has` / `follows`** for relational matching:
   ```yaml
   # Find function calls inside try blocks
   rule:
     pattern: $FUNC($$$ARGS)
     inside:
       pattern: try { $$$ }
   ```
4. **Test the pattern** on a small sample first:
   ```bash
   sg scan -p 'console.log($$$ARGS)' src/
   ```

### Phase 3: Refine and Narrow

1. **Add constraints** to reduce false positives:
   ```yaml
   rule:
     pattern: $FUNC($$$ARGS)
     regex: '^get'     # function name starts with "get"
   ```
2. **Filter by file type / path:**
   ```bash
   sg scan -p 'pattern' --lang ts src/
   sg scan -p 'pattern' --globs '**/*.test.ts' src/
   ```
3. **Count matches** before doing anything destructive:
   ```bash
   sg scan -p 'pattern' src/ | wc -l
   ```

### Phase 4: Rewrite (If Applicable)

1. **Write the rewrite pattern** using the same `$VAR` names:
   ```yaml
   # Replace console.log with logger.info
   rule:
     pattern: console.log($$$ARGS)
   fix: logger.info($$$ARGS)
   ```
2. **Dry run first** to see what would change:
   ```bash
   sg scan -r 'console.log($$$ARGS)' --rewrite 'logger.info($$$ARGS)' src/
   ```
3. **Review every match** before applying.
4. **Apply the rewrite:**
   ```bash
   sg scan -r 'console.log($$$ARGS)' --rewrite 'logger.info($$$ARGS)' --update-all src/
   ```
5. **Run tests** to verify no regressions.

### Phase 5: Verify and Commit

1. **Review the diff** carefully:
   ```bash
   git diff
   ```
2. **Run the full test suite.** All tests must pass.
3. **Commit as a single refactor commit.**
4. **If anything looks wrong:** `git checkout .` and refine the pattern.

## Safety Rules

1. **Always dry-run first.** Never run `--update-all` without checking.
2. **Always commit before running a rewrite.** Easy to revert.
3. **Always run tests after rewriting.** The AST is correct but the semantics might not be.
4. **Start narrow, then broaden.** Get the pattern right on one file, then expand.
5. **For large codemods:** do it in phases, verify at each step.
6. **Never rewrite without version control.** You need to be able to revert.

## Common Patterns

### Find unused variables
```yaml
pattern: const $VAR = $$$
constraints:
  VAR:
    regex: '^_'     # convention: unused vars start with _
```

### Find deprecated API usage
```yaml
rule:
  pattern: oldApi($$$ARGS)
```

### Rename a method across the codebase
```yaml
rule:
  pattern: $OBJ.oldMethod($$$ARGS)
fix: $OBJ.newMethod($$$ARGS)
```

### Find console.log in production code
```yaml
rule:
  pattern: console.$METHOD($$$ARGS)
  not:
    inside:
      pattern: if (process.env.NODE_ENV === 'development') { $$$ }
```

## Allowed Edits

- Source code files (when doing structural rewrites).
- Test files (when updating tests to match).
- Configuration files.

## Forbidden Behavior

- Do NOT run `--update-all` without a dry run first.
- Do NOT commit without running tests.
- Do NOT rewrite code you don't understand.
- Do NOT use ast-grep for one-off changes — just edit the file.
- Do NOT skip the review step — AST patterns can have surprising matches.
- Do NOT do large rewrites without version control safety.
- Do NOT mix feature changes with ast-grep rewrites — keep them in separate commits.

## Verification Gates

1. **Plan reread**: The pattern matches what we're looking for, no false positives.
2. **Automated verification**: Full test suite green after any rewrites.
3. **Manual-QA**: Diff reviewed, every change is intended and correct.
4. **Adversarial QA**: Edge cases checked, no unintended matches or rewrites.
5. **Cleanup**: No leftover patterns, no debug code, clean commit.

## Failure Handling

- If the pattern matches too much: add constraints (regex, relational rules, file filters).
- If the pattern matches too little: relax constraints, check language, try simpler pattern.
- If a rewrite breaks tests: revert, understand why, refine the pattern, try again.
- If ast-grep doesn't support the language: use regex with grep as a fallback, but be more careful.
- If you're not sure the pattern is right: test on one file first, then expand.

## Output Format

```
AST-GREP OPERATION REPORT
==========================

Operation: search / rewrite
Pattern: <pattern>
Language: <language>
Scope: <directory / files>

Results:
  - Matches found: <count>
  - Files affected: <count>
  - False positives: <count> (if known)

If rewrite:
  - Dry run reviewed: yes / no
  - Applied: yes / no
  - Tests pass: yes / no
  - Committed: yes / no (commit: <sha>)
```

## Handoff Target

After a search operation, hand off the results to the next phase (debugging, refactoring, etc.). After a rewrite operation, hand off to `verifier` for formal verification and `reviewer` for code quality check.
