<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

---
name: lcx-report-bug
description: "Structured bug reporting for LazyTrae / LazyCodex issues. Use when you need to report a bug or issue with the tool itself, not with the project you're working on. Triggers: report bug, bug report, issue, feedback, problem with lazytrae."
---

# lcx-report-bug

Structured bug reporting for LazyTrae. Ensures bug reports contain all the information needed to reproduce and fix the issue. A good bug report is specific, reproducible, and includes context.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/lcx-report-bug/SKILL.md` — bug reporting: structured bug template, reproduction steps, environment info, expected vs actual, severity classification, log collection.

## Purpose

Report bugs in LazyTrae itself (not in the project you're working on) in a structured way that makes them easy to triage, reproduce, and fix.

## Required Context to Inspect

- The bug you're seeing (what happened).
- What you expected to happen.
- Steps to reproduce (what you were doing).
- Your environment (OS, Trae version, LazyTrae version).
- Error messages or logs.
- The project you were working on (if relevant).

## Step-by-Step Procedure

### 1. Gather Information

1. **Describe the bug in one sentence.** What went wrong?
2. **Expected behavior:** What should have happened?
3. **Actual behavior:** What actually happened?
4. **Steps to reproduce:** Exact, numbered steps. Assume the reader knows nothing.
5. **Environment:**
   - Operating system and version
   - Trae IDE version
   - LazyTrae version (from `package.json` or `AGENTS.md`)
   - Node.js version (if applicable)
6. **Impact:** How severe is this? What does it prevent you from doing?

### 2. Classify Severity

| Severity | Definition | Examples |
|----------|------------|----------|
| **Critical** | Blocks core workflow, data loss, security issue | Commands don't work at all, state corruption, secrets exposed |
| **High** | Major feature broken, no workaround | Hooks don't fire, MCP server crashes |
| **Medium** | Feature works but has issues, workaround exists | Wrong output format, missing documentation |
| **Low** | Cosmetic, minor UX issue | Typo in docs, formatting issue |

### 3. Collect Logs and Evidence

1. **Error messages:** Copy the exact error text.
2. **Console output:** Any terminal output or logs.
3. **State files:** Check `.lazytrae/state/` for relevant state.
4. **Evidence files:** Check `.lazytrae/evidence/` for context.
5. **Reproduction repo:** If possible, create a minimal reproduction case.
6. **Screenshots:** If it's a visual issue, include screenshots.

### 4. Write the Report

```markdown
# Bug Report: <one-line summary>

## Severity
Critical / High / Medium / Low

## Expected Behavior
<What should have happened>

## Actual Behavior
<What actually happened>

## Steps to Reproduce
1. <Step 1>
2. <Step 2>
3. <Step 3>
...

## Environment
- OS: <OS and version>
- Trae IDE: <version>
- LazyTrae: <version>
- Node.js: <version (if applicable)>

## Error Messages / Logs
```
<Paste error messages and logs>
```

## Additional Context
- Project repo: <repo name / link, if applicable>
- Workaround: <any workaround you found>
- Suggested fix: <if you have an idea>
```

### 5. Submit the Report

1. **Check if it's already reported.** Search existing issues first.
2. **File the issue** in the appropriate repository (LazyTrae issue tracker).
3. **Tag it appropriately** — bug, severity level, affected component.
4. **Follow up** if you find more information or the bug changes.

## Allowed Edits

- Bug report files / markdown.
- Collecting logs and evidence from `.lazytrae/`.
- Creating reproduction cases (in a separate repo or temp directory).

## Forbidden Behavior

- Do NOT include secrets, API keys, credentials, or PII in bug reports.
- Do NOT include proprietary code from the project you're working on.
- Do NOT make assumptions about the root cause — report the symptoms.
- Do NOT file duplicate bugs — search first.
- Do NOT use vague language like "it doesn't work" — be specific.

## Verification Gates

1. **Plan reread**: The report clearly describes the problem.
2. **Automated verification**: Logs and error messages are captured.
3. **Manual-QA**: Steps are reproducible by someone else.
4. **Adversarial QA**: Edge cases and alternative causes are considered.
5. **Cleanup**: No secrets or PII in the report.

## Failure Handling

- If you can't reproduce the bug consistently: note that in the report, describe the conditions when it happens.
- If you're not sure it's a bug: describe what you expected vs what happened and ask.
- If you found a workaround: include it in the report — it helps triage.

## Output Format

The output is the bug report itself (markdown format shown above).

## Handoff Target

After creating the bug report, hand off to the maintainers via the issue tracker. If it's a critical bug blocking work, also note it in the handoff summary.
