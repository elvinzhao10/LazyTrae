# Task 2 Gate Fix — Managed Local Remediation Evidence

Date: 2026-07-18

Artifact path: `/private/tmp/lazyseries-local-first-v102/LazyTrae/.omo/evidence/local-first-v102-onboarding/task-2-bare-guidance-fix.md`

## Success criteria ledger

### 1. Work status remains executable with a node-only PATH

- Scenario: an empty Trae Work skills directory is inspected through the permanent release launcher while `PATH` contains only a `node` symlink.
- Failing-first invocation: `node --test test/local-launcher.test.js` from `lazytrae-plugin/packages/cli` before the production edit.
- RED observable: `tests 9`, `pass 6`, `fail 3`; `work status prints a release-owned repair command when PATH contains only node` failed because stdout still contained ``Run `lazytrae work install` ``.
- GREEN invocation: `node --test --test-name-pattern="work status prints|completion status prints|generated stop hook" test/local-launcher.test.js`.
- GREEN observable: `tests 3`, `pass 3`, `fail 0`.
- Real tmux invocation: `env PATH=/private/tmp/lazytrae-bare-guidance-repro.9HDesP/node-bin /usr/local/bin/node /private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js --root /private/tmp/lazyseries-local-first-v102/LazyTrae work status --skills-dir /private/tmp/lazytrae-bare-guidance-repro.9HDesP/empty-skills`.
- Real binary observable: exit `1` for the intentionally missing skills, with remediation ``node '/private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js' --root '/private/tmp/lazyseries-local-first-v102/LazyTrae' work install`` and no bare `lazytrae work install` command.
- Captured artifact: this ledger, under “Manual tmux transcript.”

### 2. Completion and generated stop-hook remediation are release-owned

- Scenario: a project has one in-progress Boulder task without completion evidence.
- Direct completion invocation: `env PATH=/private/tmp/lazytrae-bare-guidance-repro.9HDesP/node-bin /usr/local/bin/node /private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js --root /var/folders/xl/tv3mcy3j01j_lb2gtj6p60580000gn/T/lazytrae-bare-guidance-completion-ZkXpuF completion-status`.
- Direct binary observable: exit `1`, status `blocked`, and `Next command: node '<absolute release launcher>' --root '<canonical project>' verify --must-pass`; no `Next command: lazytrae`.
- Generated-hook invocation: `/bin/bash /var/folders/xl/tv3mcy3j01j_lb2gtj6p60580000gn/T/lazytrae-bare-guidance-completion-ZkXpuF/.trae/hooks/stop.sh`.
- Generated-hook observable: exit `0`; the completion reminder relays the same absolute `node ... verify --must-pass` command and no bare PATH command.
- Captured artifact: this ledger, under “Manual tmux transcript.”

### 3. CLI and publishable MCP runtime stay source-equivalent

- Scenario: the publishable MCP runtime and CLI fallback are compared byte-for-byte through the package parity mapping.
- Invocation: `node --test --test-name-pattern="packaged CLI fallback MCP stays source-equivalent" test/packaged-mcp.test.js`.
- Binary observable: `tests 1`, `pass 1`, `fail 0`, duration `46.016542ms`.
- Structural observable: `cmp lazytrae-plugin/packages/cli/src/lib/local-command.js lazytrae-plugin/packages/mcp/src/runtime/local-command.js` exited `0`.
- Captured artifact: this ledger.

### 4. Focused and full package regression coverage passes

- Focused invocation: `node --test test/local-launcher.test.js test/completion-gates.test.js test/work.test.js`.
- Focused observable: `tests 30`, `pass 30`, `fail 0`, duration `6171.482916ms`.
- Full invocation: approved-network `npm test` from `lazytrae-plugin/packages/cli`.
- Full observable: `tests 272`, `pass 272`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, duration `135684.777875ms`.
- Fixture observable: `LAZYTRAE_TEST_FIXTURE_INVENTORY ... remaining=[]`.
- Captured artifact: this ledger.

The initial restricted-network full run terminated with `266/272` passing: one expected MCP source-parity failure that prompted the required mirror update, plus five `npm ETIMEDOUT` tooling-provisioning failures. After the mirror update and approved-network rerun, all 272 tests passed.

### 5. Publication checks pass without publishing

- Invocation: `npm run test:publication`.
- Binary observable: `tests 7`, `pass 7`, `fail 0`, duration `56.656ms`.
- Fixture observable: `LAZYTRAE_TEST_FIXTURE_INVENTORY ... remaining=[]`.
- Captured artifact: this ledger.

### 6. Static validation is clean within available tooling

- Invocation: `node --check` for `work.js`, both completion-gates modules, both local-command modules, `local-launcher.js`, and `local-launcher.test.js`.
- Binary observable: every invocation exited `0` with no syntax output.
- Invocation: `git diff --check`.
- Binary observable: exit `0` with no whitespace errors.
- Invocation: `rg -n 'next_command:.*lazytrae |Next command:.*lazytrae |Run `lazytrae (work install|verify --must-pass|completion-status)' ...` across managed CLI, MCP, template-hook, and checked-in hook sources.
- Binary observable: exit `1` with no matches, the expected ripgrep result for an empty inventory.
- LSP limitation: `mcp__lsp__status` reported TypeScript/JavaScript and ESLint servers missing; diagnostics also rejected the temporary worktree as outside the fixed request cwd. No LSP-clean claim is made.
- Captured artifact: this ledger.

## Manual tmux transcript

Session: `lazytrae-bare-guidance-qa`

```text
Trae Work global skills: 0/17 current, 17 missing, 0 outdated.
Directory: /private/tmp/lazytrae-bare-guidance-repro.9HDesP/empty-skills
Run `node '/private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js' --root '/private/tmp/lazyseries-local-first-v102/LazyTrae' work install` to repair the global skill installation.
WORK_EXIT=1

blocked
- [boulder_task_evidence] Boulder task task-1 is in_progress; completion evidence is not recorded yet
Next command: node '/private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js' --root '/private/var/folders/xl/tv3mcy3j01j_lb2gtj6p60580000gn/T/lazytrae-bare-guidance-completion-ZkXpuF' verify --must-pass
COMPLETION_EXIT=1

=== LazyTrae Completion Gate Reminder ===
blocked
- [boulder_task_evidence] Boulder task task-1 is in_progress; completion evidence is not recorded yet
Next command: node '/private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/bin/lazytrae.js' --root '/private/var/folders/xl/tv3mcy3j01j_lb2gtj6p60580000gn/T/lazytrae-bare-guidance-completion-ZkXpuF' verify --must-pass
STOP_HOOK_EXIT=0
```

## Scope and architecture review

- `work.js` owns Trae Work lifecycle output; it now calls the pre-existing local command surface.
- `completion-gates.js` owns completion decisions and remediation; CLI and MCP mirrors share the same 25-line `local-command.js` implementation.
- `local-launcher.js` still owns MCP declaration lifecycle and re-exports the extracted local command API without changing callers.
- No tagged variants, untyped escape hatches, new broad error handling, parameter bloat, or logging changes were introduced.
- `local-launcher.test.js` is in the 200–250 pure-LOC warning band at 249 lines; a future test addition should split local-guidance scenarios into a dedicated file.
