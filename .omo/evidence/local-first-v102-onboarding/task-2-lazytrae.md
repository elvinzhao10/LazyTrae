# Task 2 evidence: permanent local LazyTrae launcher

Date: 2026-07-18 (Asia/Shanghai)

Scope: only `/private/tmp/lazyseries-local-first-v102/LazyTrae`.
No Trae host settings, accounts, plugins, credentials, remote state, tags,
releases, publication state, or main-checkout files were changed.

## Starting state and concurrent work

- Scenario: verify the isolated worktree before editing.
- Invocation: `git status --short` and `git rev-parse HEAD` in the task worktree.
- Observable: clean starting tree at
  `39e06f876190841fdfc395482d69b1d2ac2832ff`.
- Concurrent observable: another authorized lane later added commit
  `9889f1428a7e256fb934f0567c4a6e9d1b498630`, limited to release metadata and
  `test/version-parity-v102.test.js`. This task preserved that commit and did
  not edit those files.

## Red-to-green launcher contract

- Scenario: prove the missing permanent launcher, local materialization,
  preservation, and failure-boundary behavior before implementation.
- Red invocation:
  `node --test test/local-launcher.test.js test/mcp-declaration-safety.test.js`
- Red observable: exit 1; the initial run was 0 pass / 11 fail because
  `bin/lazytrae.js` and the local declaration lifecycle did not exist, legacy
  entries remained PATH-dependent, modified entries were overwritten, and
  malformed/permission/atomic errors were not actionable.
- Green focused invocation:
  `node --test test/local-launcher.test.js test/mcp-declaration-safety.test.js test/load-check.test.js test/work-mcp-declaration.test.js`
- Green observable: exit 0; 30 pass / 0 fail.
- Final affected-surface invocation:
  `node --test test/load-check.test.js test/local-launcher.test.js test/template-parity.test.js test/cli.test.js`
- Final affected-surface observable: exit 0; 37 pass / 0 fail after the manual
  QA-driven local remediation and absolute-bash changes.

## Acceptance-criterion ledger

| Criterion | Exact scenario and invocation | Binary observable |
| --- | --- | --- |
| Permanent release launcher | `node lazytrae-plugin/packages/cli/bin/lazytrae.js --version` | exit 0; stdout `1.0.2`; both package bin aliases resolve to `bin/lazytrae.js`. |
| Paths with spaces and unrelated cwd | Real tmux terminal from `.../Unrelated Caller/deep`: `env -i PATH="/usr/local/bin" HOME=".../home" node ".../Old Release/bin/lazytrae.js" init --root ".../Consumer Project" --host ide` | `QA_INIT_STATUS=0`; package readiness passed. |
| Absolute local declaration | Parse `Consumer Project/.trae/mcp.json` after init. | command `node`; args `[/private/tmp/.../Old Release/bin/lazytrae.js, --root, /private/tmp/.../Consumer Project, mcp]`; schema 1 SHA-256 fingerprint present. |
| No global/PATH dependency | Every real launcher/MCP command used `env -i PATH=/usr/local/bin`; automated moved-release test also put a fake `lazytrae` on PATH. | local MCP started; stale start failed without emitting `PATH_FALLBACK_USED`; generated stop hook contained no `command -v lazytrae` or `&& lazytrae`. |
| Direct JSON-RPC identity | Spawn the generated declaration from the unrelated caller with node-only PATH and send `initialize`. | `QA_MCP_STATUS=0`; `serverInfo.name=lazytrae-mcp`; `serverInfo.version=1.0.2`. |
| Generated guidance | Read generated `AGENTS.md` after real init. | `QA_GUIDANCE_LOCAL=true`; it contains the absolute release launcher and consumer root; global shorthand is labeled secondary. |
| Repeat onboarding | Hash `.trae/mcp.json`, `.trae/hooks/stop.sh`, and `AGENTS.md`; run local `init` and `sync`; hash again. | both commands exit 0; `QA_BYTE_IDEMPOTENT=true`. Final-code automated idempotency test also passed. |
| Moved release fails closed | Rename `Old Release` to `New Release`, then start the unchanged generated declaration. | `QA_MOVE_STATUS=0`; `QA_STALE_START_STATUS=1`; no PATH fallback. |
| Actionable stale diagnosis | With final code copied as `Final Release`, run node-only `load-check --root ... --host ide` and `doctor --root ...` while config points at `New Release`. | load-check exit 1 and both summaries print the stale old path plus the absolute Final Release `sync` command; doctor exit 1 with 8/8 hook syntax PASS and only the MCP declaration failing. |
| Deliberate refresh | Run `env -i ... node ".../Final Release/bin/lazytrae.js" sync --root ".../Consumer Project"`. | `QA_FINAL_REFRESH_SYNC_STATUS=0`; output reports `refreshed stale launcher ".../New Release/bin/lazytrae.js"`; declaration now points to Final Release. |
| Refreshed runtime | Send `initialize` through the refreshed declaration from unrelated cwd. | `QA_FINAL_MCP_STATUS=0`; server version `1.0.2`. |
| Unknown config survives | `node --test test/mcp-declaration-safety.test.js` legacy migration and uninstall cases. | caller top-level keys, `user_server`, args, and env survive; only exact managed surfaces change. |
| Modified same-name survives | Same test file: add env to legacy-shaped entry and mutate a fingerprinted entry without recomputing fingerprint. | updater returns `preserved_modified`; source bytes and temp-file inventory are unchanged; uninstall preserves the entire file. |
| Malformed/read/atomic failures | Same test file with malformed JSON, mocked `EACCES`, and mocked rename `EIO`. | each exits through an actionable error; original bytes unchanged; no `.tmp` remains. |
| Symlink/hard-link safety | `node --test test/security.test.js`. | dangling MCP symlink and hard-linked MCP target are rejected with path-specific diagnostics; peers/targets unchanged. |
| Packed install | `node --test test/packed-offline-install.test.js`. | cold offline install passes; installed generated declaration is absolute/local and initializes MCP at v1.0.2 under node-only PATH. |
| CodeGraph local launcher | `node --test test/codegraph.test.js`. | enabled managed CodeGraph entry uses `node`, the same absolute release launcher, explicit root/target/tooling-root args, and fingerprint; caller MCP entries survive. |

## Complete verification

- Dependencies (isolated worktree/cache):
  `npm ci --ignore-scripts --no-audit --cache /private/tmp/lazytrae-local-launcher-npm-cache`
  exited 0 and added the six locked packages. The first restricted-network
  attempt stalled; the required retry used approved network access.
- Full invocation:
  `npm_config_cache=/private/tmp/lazytrae-local-launcher-npm-cache npm test`
  with approved network access for the suite's existing receipt-owned tooling
  install scenarios.
- Full observable: exit 0; **268 pass / 0 fail / 0 cancelled / 0 skipped** in
  122.4 seconds; fixture inventory reported `remaining=[]`.
- Publication invocation:
  `npm_config_cache=/private/tmp/lazytrae-local-launcher-npm-cache npm run test:publication`
- Publication observable: exit 0; **7 pass / 0 fail**; fixture inventory empty.
- Package invocation:
  `npm_config_cache=/private/tmp/lazytrae-local-launcher-npm-cache npm pack --dry-run --json`
- Package observable: exit 0; package `lazytrae-ai@1.0.2`, filename
  `lazytrae-ai-1.0.2.tgz`, entry count 764; `bin/lazytrae.js` present with mode
  493, together with `src/lib/local-launcher.js` and
  `src/lib/mcp-declaration.js`.
- Syntax invocation: `node --check` for every changed production JavaScript
  file and `bash -n` for both stop-hook mirrors.
- Syntax observable: every command exited 0; hook mirrors are byte-identical
  and exactly 100 lines.
- Diff observable: `git diff --check` exited 0; MCP and hook project/template
  mirrors compare byte-identically.

## LSP diagnostic attempt

- Invocation: `lsp.status`, then `lsp.diagnostics` with severity `error` for
  `/private/tmp/lazyseries-local-first-v102/LazyTrae/lazytrae-plugin/packages/cli/src`.
- Observable: status reported JavaScript `typescript`/`eslint` servers missing;
  diagnostics then rejected the task worktree because it is outside the
  session's fixed request cwd. No LSP-clean claim is made. Installing a user
  language server or touching the main checkout was outside this task's scope;
  syntax and all runtime suites above are the verified fallback.

## Failure recovery and adversarial checks

- A first full suite was accidentally overlapped with another retained test
  process, producing a packed-test timeout and long tooling stall. The runs
  were bounded and interrupted; no pass claim used them. The packed test then
  passed alone in 4.1 seconds and in the final full suite in 2.3 seconds.
- Restricted-network full verification reached 222 passing assertions with no
  failures before stalling in a real nested tooling `npm install`. It was
  bounded and interrupted, then rerun with approved network access to the
  terminal 268/268 result.
- A tmux inspection command initially triggered zsh history expansion on `!`.
  It produced no product mutation; the harness expression was corrected and
  the same inspection passed (`QA_GUIDANCE_LOCAL=true`,
  `QA_HOOK_HAS_NO_BARE_FALLBACK=true`).
- Dirty/concurrent state, stale paths, malformed JSON, misleading success,
  repeat onboarding, atomic failure, permission failure, dangling symlink,
  hard link, and bounded process stalls were all exercised above.
- No external prompt-bearing content or credentials entered the test inputs.

## Readiness boundary

This evidence proves package/local-launcher readiness only. Trae IDE, Trae
Work, and Trae CLI host registration/connection remain explicitly unverified;
no GUI or host setting was changed.

Evidence artifact:
`.omo/evidence/local-first-v102-onboarding/task-2-lazytrae.md`
