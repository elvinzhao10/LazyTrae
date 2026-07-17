# Contributing to LazyTrae

Thank you for improving LazyTrae. Keep changes focused, preserve the package
boundary, and avoid adding host configuration, credentials, or generated local
state to commits.

## Before opening an issue

Search existing issues first. For a bug report, include the LazyTrae version,
Trae surface, operating system, exact reproduction steps, and sanitized output
from the relevant verification command. Do not paste tokens, credentials, or
private workspace paths.

## Pull requests

Create one focused branch and describe the user-visible change, compatibility
impact, and verification. Update documentation or the release notes when public
behavior changes.

Run these checks from `lazytrae-plugin/packages/cli` before requesting review:

```bash
npm ci --ignore-scripts
npm test
npm run test:publication
npm pack --dry-run --json
```

The CI workflow runs these package and publication checks on every pull request.

## Releases

Use a version tag in the form `vX.Y.Z` only after default-branch CI is green.
The tag-release workflow creates GitHub release notes from merged pull requests
and labels. Review the generated notes before publishing a prerelease or major
release.
