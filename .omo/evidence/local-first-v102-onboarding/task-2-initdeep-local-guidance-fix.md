# InitDeep release-owned local guidance — verification evidence

Date: 2026-07-18
Starting HEAD: `12274640cd94cd832baec609f341929831e504c1`
Scope: LazyTrae CLI templates, checked-in mirrors, installed InitDeep guidance, and missing-hook remediation. No host registration, publication, or host configuration action was performed.

## 1. Failing-first contract

- Scenario: run the newly added installed-guidance and missing-hook remediation contracts against the unchanged production implementation.
- Invocation: `node --test test/onboarding-contract.test.js`
- Binary observable: exit `1`; `tests 7`, `pass 5`, `fail 2`. The two failures were `InitDeep managed guidance uses the project release-owned launcher without PATH fallback` and `missing hook remediation names the release-owned local init command`.
- Captured artifact: this file, section 1.

## 2. Focused guidance contracts

- Scenario: validate template, checked-in mirror, fresh installed skill/command, hook remediation, safety semantics, and template parity after the fix.
- Invocation: `node --test test/onboarding-contract.test.js test/documentation-regression.test.js test/template-parity.test.js`
- Binary observable: exit `0`; `tests 21`, `pass 21`, `fail 0`.
- Captured artifact: this file, section 2.

## 3. Template/mirror and source audit

- Scenario: prove both managed InitDeep template/mirror pairs are byte-identical.
- Invocation: `cmp -s packages/cli/templates/skills/lazy-init-deep/SKILL.md .trae/skills/lazy-init-deep/SKILL.md && cmp -s packages/cli/templates/commands/lazy-init-deep.md .trae/commands/lazy-init-deep.md` from `lazytrae-plugin/`.
- Binary observable: exit `0`.
- Scenario: scan all managed templates, checked-in managed files, and CLI runtime source for the affected bare command family.
- Invocation: `rg -n 'lazytrae (load-check|init|sync|work install)\b' lazytrae-plugin/.trae lazytrae-plugin/packages/cli/templates lazytrae-plugin/packages/cli/src`
- Binary observable: no positive operational instruction remains. The only matches are CLI syntax banners in `sync.js`, `load-check.js`, and `init.js`, plus a non-executable ownership comment in `managed-gitignore.js`.
- Scenario: syntax and whitespace validation for changed JavaScript and the full diff.
- Invocation: `node --check` for `src/commands/hook.js`, `test/onboarding-contract.test.js`, and `test/documentation-regression.test.js`; then `git diff --check`.
- Binary observable: all commands exit `0`; debug-marker scan has no matches.
- Captured artifact: this file, section 3.

## 4. Full package regression suite

- Scenario: execute the full LazyTrae CLI suite, including fresh-install, packaged-release, offline, safety, and tooling lifecycle coverage.
- Invocation: `npm test`
- Binary observable: exit `0`; `tests 274`, `pass 274`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`; `LAZYTRAE_TEST_FIXTURE_INVENTORY ... remaining=[]`.
- Note: the prior baseline was 272 tests; the two failing-first guidance contracts intentionally increase the total to 274.
- Captured artifact: this file, section 4.

## 5. Publication-readiness gate

- Scenario: validate public learner pages, release-boundary semantics, link graph, and symlink fail-closed behavior without publishing.
- Invocation: `npm run test:publication`
- Binary observable: exit `0`; `tests 7`, `pass 7`, `fail 0`; fixture inventory `remaining=[]`.
- Captured artifact: this file, section 5.

## 6. Real installed-skill manual QA

- Scenario: from a real initialized Git fixture, sync the fixed package guidance and run its explicit absolute release launcher with a `PATH` containing only `node`; inspect the installed skill and command for bare operational guidance.
- Surface: task-owned tmux session `lazytrae-initdeep-guidance-qa`.
- Invocation:
  - `PATH=<fixture>/.node-only-bin node <absolute-release-launcher> --root <fixture> sync`
  - `PATH=<fixture>/.node-only-bin node <absolute-release-launcher> --root <fixture> load-check --host ide`
  - `/usr/bin/grep -E 'lazytrae (load-check|init|sync|work install)' <fixture>/.trae/skills/lazy-init-deep/SKILL.md <fixture>/.trae/commands/lazy-init-deep.md`
- Binary observable: `SYNC_EXIT=0`; `LOAD_CHECK_EXIT=0`; `PASS skills: 17/17`; `PASS commands: 9/9`; `PASS LazyTrae MCP declaration: node with absolute release-owned launcher`; installed text displays `.trae/mcp.json`, `command: node`, the absolute-launcher/root tuple, and `Never call a bare lazytrae executable or search PATH`; grep yields no match and the scenario prints `BARE_GUIDANCE=PASS` followed by `QA_COMPLETE`.
- Captured artifact: this file, section 6.

## 7. Cleanup and mutation boundary

- Task-owned tmux session, reproduction fixture, dependency restore, and debug journal were removed before commit.
- No Trae host registration, host MCP setting, release publication, or external configuration was changed.
- Captured artifact: this file, section 7.
