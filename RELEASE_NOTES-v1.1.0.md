# LazyTrae v1.1.0 — native host readiness boundaries

**Release date:** 2026-08-19
**Status:** Source-and-documentation branch at
[`release/v1.1.0`](https://github.com/elvinzhao10/LazyTrae/tree/release/v1.1.0).
It is not a GitHub Release or marketplace publication. It records package and
host evidence boundaries; durable onboarding may install its pinned source, but
package checks never claim a live host route.

## What changed

v1.1.0 names Trae IDE, Trae Work, and Trae CLI as independent hosts. LazyTrae
may generate local assets, construct an explicit Work profile, or run a bounded
host probe. Those outputs are not host discovery, registration, execution,
credential access, connector launch, or a live MCP connection.

Local-first onboarding remains on the release-owned launcher, with package
evidence kept separate from host-owned discovery and execution.

- **IDE:** generated project assets and optional bounded probes are package
  evidence only.
- **Work:** `--client desktop|web|mobile` and `--execution local|cloud` are
  distinct. Local skills/worktree/executable/probe/bundle behavior is limited
  to desktop/local; the other profiles are descriptors only.
- **CLI:** `traecli-candidate generate` creates receipt-owned `.traecli/`
  configuration candidates. They are inert until an exact fingerprinted probe
  proves the selected structured runner for the current session and worktree.

## Evidence and security

Current writers emit v2 readiness and host-adapter records. Historical v1
evidence remains read-only compatibility input. Package readiness never becomes
host readiness; the latter stays pending until current fingerprint-bound probe,
registration, session, MCP, and live-observation evidence all agree.

The release does not claim a universal CLI, marketplace publish/install, cloud
upload, or an invented host-native capability. Host settings, credentials,
registrations, sessions, discovery, and execution remain host-owned.

## Migration and removal

Read [the v1.1.0 migration guide](docs/v1.1.0-migration-guide.md) before
changing a project. Plan-first offboard removes only exact unmodified
receipt-owned generated output. Modified candidates, descriptor profiles,
host registrations, and caller-owned paths remain preserved. Historical
v1.0.3 evidence is preserved verbatim and never becomes removal authority.
