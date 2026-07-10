# v0.13 Documentation Consistency Fix

Date: 2026-07-10

## Scope

Resolved the documentation/status blockers recorded in
`.omo/evidence/v0-13-final3-goal.md`: public CLI version drift, incomplete
generated `.trae` templates, the stale verification-matrix status model, and
the `cli.test.js` 250-line violation. Platform gaps remain unchanged: Trae has
no native PostCompact event, while LSP and codegraph remain optional external
tooling.

## Red proof

`node --test packages/cli/test/template-parity.test.js` initially failed on
the missing generated artifacts and then on inconsistent public CLI banners.
The test now asserts exact source/template parity, fresh-install parity, and
package/banner version parity.

## Changes

- Added the missing hook, language rules, and eight skills to CLI templates.
- Made `init` and `sync` copy the full rules directory, so a fresh install
  receives every templated `.trae/rules/*` file.
- Aligned public CLI banners with package version `0.8.0` and corrected the
  current MCP template description from v0.14 to v0.13.
- Reconciled the verification matrix with the command index: `VERIFIED` is
  explicitly equivalent to `COMPLETE` for their shared capability scope.
- Moved the fresh-install test from `cli.test.js`; it is now 225 lines.

## Verification

- `node --test packages/cli/test/template-parity.test.js` — 3 pass, 0 fail.
- `npm test --prefix packages/cli` — 56 pass, 0 fail.
- `node packages/cli/src/index.js doctor` — 38 PASS, 1 expected MCP WARN, 0 FAIL.
- Package JavaScript line-count audit — no file above 250 lines.
- Hook line-count audit — no file above 100 lines.
- `diff -qr .trae packages/cli/templates` — no differing common artifacts.

## Recovery note

An early local banner test accidentally invoked uninstall at the repository
root. The managed `.trae` surface and team schema were restored from the
current templates and tracked schema before the final verification above; no
security behavior was changed.
