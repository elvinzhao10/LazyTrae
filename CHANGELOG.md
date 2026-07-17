# Changelog

All notable public changes to LazyTrae are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.2] - 2026-07-18

### Changed

- Updated current package, runtime, template, and onboarding documentation
  identities for the v1.0.2 release.
- Prepared all six package and lockfile pairs for reproducible publication.

## [1.0.1] - 2026-07-17

### Fixed

- Prevented Node's test discovery from recursively treating the fixture runner
  itself as another test process.
- Isolated temporary npm cache and log state so test results do not depend on a
  contributor's global npm cache ownership or contents.

### Changed

- Updated GitHub Actions to current SHA-pinned artifact and checkout releases.
- Clarified source installation, project initialization, the Trae `onboard`
  prompt, release downloads, and the contribution workflow.

### Verification

- The complete package suite, publication checks, package dry run, YAML workflow
  parsing, and an installed CLI/MCP smoke path are release gates.

## [1.0.0] - 2026-07-16

- First stable public release of the self-contained LazyTrae CLI, project
  templates, local MCP server, completion gates, and explicit optional-tooling
  lifecycle.

[1.0.2]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/elvinzhao10/LazyTrae/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/elvinzhao10/LazyTrae/releases/tag/v1.0.0
