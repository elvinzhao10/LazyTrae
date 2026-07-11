# Manual-QA Evidence (Verifier)

> **Gate 3: Manual-QA** — Real-surface proof through channels.

## Template

### Plan Under Verification

- **Plan file**: `.lazytrae/plans/<plan-name>.md`
- **Task ID**: `<task-id>`
- **Task description**: `<description>`

### Manual-QA Scenarios

For each QA scenario in the plan, execute through the specified channel and capture evidence.

#### Scenario 1: `<scenario name>`

| Field | Value |
|-------|-------|
| **Channel** | `cli` / `http` / `tmux` / `browser` / `data` |
| **Invocation** | `<exact command or action>` |
| **Expected** | `<expected output or behavior>` |
| **Actual** | `<actual output or behavior>` |
| **Verdict** | PASS / FAIL |

**Evidence**:
```
<full captured output>
```

#### Scenario 2: `<scenario name>`

...

### Channel Reference

| Channel | Tool | Artifact |
|---------|------|----------|
| HTTP | `curl -i` against live endpoint | Status line + headers + body |
| Terminal | `RunCommand` with exact command | Terminal output |
| Browser | Trae Preview or browser automation | Screenshot + action log |
| CLI | CLI command with arguments | Exit code + stdout/stderr |
| Data | DB query, config dump, file read | Diff or parsed output |

### Overall Verdict

- **Overall**: PASS / FAIL / BLOCKED
- **Scenarios passed**: `<N>/<M>`
- **Scenarios failed**: `<list of failed scenarios>`

---

## Example (filled)

### Plan Under Verification

- **Plan file**: `.lazytrae/plans/v0.5-state-machine.md`
- **Task ID**: `task-1`
- **Task description**: Create `.lazytrae/config.json`

### Manual-QA Scenarios

#### Scenario 1: Config file is valid JSON

| Field | Value |
|-------|-------|
| **Channel** | `cli` |
| **Invocation** | `python3 -m json.tool .lazytrae/config.json` |
| **Expected** | Valid JSON output, no errors |
| **Actual** | Valid JSON output, no errors |
| **Verdict** | PASS |

**Evidence**:
```
{
    "version": "0.5.0",
    "schema_version": 1,
    "enabled": true,
    ...
}
```

#### Scenario 2: All state files exist

| Field | Value |
|-------|-------|
| **Channel** | `cli` |
| **Invocation** | `ls .lazytrae/state/` |
| **Expected** | boulder.json, active-loop.json, sessions.json |
| **Actual** | boulder.json, active-loop.json, sessions.json |
| **Verdict** | PASS |

**Evidence**:
```
boulder.json    active-loop.json    sessions.json
```

### Overall Verdict

- **Overall**: PASS
- **Scenarios passed**: 2/2
- **Scenarios failed**: None
