# Automated Verification Evidence

> **Gate 2: Automated Verification** — Tests, linters, type checks, builds.

## Template

### Plan Under Verification

- **Plan file**: `.lazytrae/plans/<plan-name>.md`
- **Task ID**: `<task-id>`
- **Task description**: `<description>`

### Commands Executed

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `<test command>` | `0` | All tests passed |
| `<lint command>` | `0` | No new errors |
| `<typecheck command>` | `0` | No type errors |
| `<build command>` | `0` | Build succeeded |

### Full Output

```
<full command output>
```

### Changed Files

```
<list of changed files from git diff --name-only>
```

### Verdict

- **Overall**: PASS / FAIL / BLOCKED
- **Tests**: `<N>` tests, `<M>` failed
- **Lint**: PASS / FAIL (with details)
- **Typecheck**: PASS / FAIL (with details)
- **Build**: PASS / FAIL (with details)

### Evidence Artifacts

- `<path to artifact 1>`
- `<path to artifact 2>`

---

## Example (filled)

### Plan Under Verification

- **Plan file**: `.lazytrae/plans/v0.5-state-machine.md`
- **Task ID**: `task-1`
- **Task description**: Create `.lazytrae/config.json`

### Commands Executed

| Command | Exit Code | Output Summary |
|---------|-----------|----------------|
| `python3 -m json.tool .lazytrae/config.json > /dev/null` | `0` | Valid JSON |
| `ls -la .lazytrae/state/` | `0` | 3 files exist |

### Full Output

```
$ python3 -m json.tool .lazytrae/config.json > /dev/null && echo "VALID"
VALID
$ ls -la .lazytrae/state/
boulder.json    active-loop.json    sessions.json
```

### Changed Files

```
.lazytrae/config.json
.lazytrae/state/boulder.json
.lazytrae/state/active-loop.json
.lazytrae/state/sessions.json
```

### Verdict

- **Overall**: PASS
- **Tests**: N/A (no test suite — config and state files)
- **Lint**: N/A
- **Typecheck**: N/A
- **Build**: N/A

### Evidence Artifacts

- `.lazytrae/config.json`
- `.lazytrae/state/boulder.json`
- `.lazytrae/state/active-loop.json`
- `.lazytrae/state/sessions.json`
