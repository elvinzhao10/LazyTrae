# LazyTrae Team Mode

> v0.11 — Trae-native adaptation of LazyCodex teammode parallel orchestration.
> Canonical source: `lazycodex/plugins/omo/components/teammode/`

## Overview

LazyTrae team mode enables parallel, coordinated work through Trae subagents (custom agents with independent context). The main session is ALWAYS the team leader — it orchestrates, verifies, integrates, but NEVER writes product code while the team runs.

## Team vs Subagent Decision Matrix

Use a **TEAM** when EITHER holds:
- The work does NOT split into perfectly isolated pieces, but parallelizing is clearly more convenient — members must see and react to each other's findings
- One task needs exploration, yet its GOAL is already clear — parallel investigation under a fixed objective

Use **plain subagents** when EITHER holds:
- The work IS perfectly isolated, so there is no coordination cost worth paying
- The GOAL is still ambiguous, where one mind should resolve direction before any fan-out

**MIN_MEMBERS = 2.** A single-member "team" is a subagent, not a team. Split off a second distinct slice or drop the team.

## Leader Protocol

The main session is ALWAYS the leader. Your job:
1. **Split**: Divide work into clear, non-overlapping responsibilities — one per member
2. **Assign**: Delegate each slice to a member subagent
3. **Monitor**: Hold situational awareness; read member reports as they arrive
4. **Verify**: Review each deliverable against acceptance criteria
5. **Synthesize**: Collect all member reports and produce the integrated result
6. **Disband**: Archive members, collect evidence, delete team state when done

**Never write product code while the team runs** — every edit belongs to a member.

## Compose by Part, Ownership, or Perspective

Compose the team by what you actually KNOW about the work. Ground the split in real knowledge, then divide into non-overlapping responsibilities. Each member's `focus` names a concrete slice; the `lens` is one of:

| Lens | Meaning |
|------|---------|
| `area` | A specific part of the codebase (e.g., "auth flow", "database layer") |
| `ownership` | An ownership concern (e.g., "test coverage", "error handling") |
| `perspective` | A distinct viewpoint/lens on the work (e.g., "security audit", "performance review") |

No two members may share a focus, name, or threadTitle (case/whitespace-insensitive).
Never assign vague roles ("backend dev", "the tester") — that invites overlap with no real boundary.

## Read-Only Default: Explorer, Reviewer, Librarian

These agent roles are read-only by default and are suitable for parallel team membership:

| Agent | Role | Team Use |
|-------|------|----------|
| Explorer ([.trae/agents/explorer.md](file:///Users/Admin/Desktop/lazytrae/.trae/agents/explorer.md)) | Codebase search specialist | Parallel codebase exploration |
| Oracle/Reviewer ([.trae/agents/oracle.md](file:///Users/Admin/Desktop/lazytrae/.trae/agents/oracle.md)) | Verification gate enforcer | Parallel review of deliverables |
| Librarian ([.trae/agents/librarian.md](file:///Users/Admin/Desktop/lazytrae/.trae/agents/librarian.md)) | Docs/memory maintainer | Parallel documentation research |

## Trae Subagent Delegation Pattern

Trae subagents are **ephemeral** — they have independent context but no durable thread persistence. Durability lives in files:

```
.lazytraework/team/
  team.json              ← Durable team state (schema version 2)
  members/<id>/
    report.md            ← Member's deliverable report
    status.json          ← Member status snapshot
  mailbox/<id>/
    inbox.md             ← Messages to this member
    outbox.md            ← Messages from this member (WORKING: / BLOCKED: heartbeat markers)
  tasklist.jsonl         ← Append-only task assignments
  worktrees/             ← Optional git worktrees for write-colliding members
```

When invoking a team member:
1. The leader creates a team with `lazytrae team create`
2. Members are spawned with `lazytrae team spawn`
3. Each member writes its deliverable to `.lazytraework/team/members/<id>/report.md`
4. Heartbeat markers go in `.lazytraework/team/mailbox/<id>/outbox.md`
5. The leader runs `lazytrae team collect` to synthesize all reports

## Parent Synthesis Procedure

After all members report:
1. Run `lazytrae team collect <team-id>` to read all member reports
2. Resolve any conflicts between member findings
3. Integrate results into the final deliverable
4. Archive the team with `lazytrae team archive <team-id>`
5. Clean up with `lazytrae team delete <team-id> --force`

## Worktree Isolation

When two members would edit the same files, give each a separate git worktree via `lazytrae team spawn --branch <branch>`. The team.json `worktree.enabled` flag flips to `true` on the first worktree assignment. Worktrees are created under `.lazytraework/team/worktrees/<id>/`.

Decide mid-run when a file collision appears, not only at init.

## Communication Rules

- Member-to-member and member-to-leader traffic is in **English**
- When the END user addresses a member, that member replies in the **user's language**
- Members heartbeat via `WORKING:` / `BLOCKED:` markers in mailbox outbox
- Members hand off files through the team working directory and reference by path

## CLI Commands

```bash
lazytrae team create --name "<team>" [--session <id>] [--worktree] [--base-branch <branch>]
lazytrae team spawn <team-id> --id <id> --name "<role>" --focus "<slice>" --lens area|ownership|perspective --deliverable "<...>" [--branch <branch>]
lazytrae team status [<team-id>]
lazytrae team collect <team-id>
lazytrae team archive <team-id> [--note "<...>"]
lazytrae team delete <team-id> [--force]
```

## Archive and Delete Rules

1. **Archive first**: Before deleting, archive the team
2. **Delete refuses** while unarchived or any member is active unless `--force`
3. A finished team that is never disbanded is a leak — clean up

## Trae Adaptation Notes

| LazyCodex (Codex) | LazyTrae (Trae-native) |
|---|---|
| `codex_app.create_thread` (durable threads) | Subagent invocation (ephemeral, independent context) |
| `codex_app.send_message_to_thread` | Mailbox file: `.lazytraework/team/mailbox/<id>/outbox.md` |
| `codex_app.read_thread` | Member report: `.lazytraework/team/members/<id>/report.md` |
| `codex_app.set_thread_title` | N/A — title lives in team.json `threadTitle` field as a record |
| `codex_app.set_thread_archived` | Mark member status: `"archived"` in team.json |
| Thread durability across sessions | Durable team.json + member report files |
