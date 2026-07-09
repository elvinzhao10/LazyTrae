# Sample Plan: v0.5 State Machine

> This is a sample plan demonstrating the plan format used by LazyTrae.
> Plans use Markdown checkboxes that LazyTrae parses into boulder state tasks.

## Objective

Implement LazyTrae v0.5 — Runtime State Machine with durable state, evidence, and schemas.

## Deliverables

- [ ] Create `.lazytrae/config.json` — LazyTrae configuration
- [ ] Create `.lazytrae/state/boulder.json` — Boulder state tracking
- [ ] Create `.lazytrae/state/active-loop.json` — Loop state tracking
- [ ] Create `.lazytrae/state/sessions.json` — Session tracking
- [ ] Create `.lazytrae/evidence/` templates (6 files)
- [ ] Create `.lazytrae/schemas/` JSON schemas (3 files)
- [ ] Create `.omo/` compatibility mirror directories
- [ ] Create `docs/lazytrae-state-machine.md` — behavior documentation
- [ ] Update `docs/lazytrae-parity-ledger.md` — DESIGN → COMPLETE
- [ ] Update `docs/lazytrae-command-index.md` — DESIGN → COMPLETE
- [ ] Update `AGENTS.md` — DESIGN → COMPLETE

## Acceptance Criteria

### Criterion 1: All state files are valid JSON
- **Scenario**: Run `python3 -m json.tool` on each state file
- **Expected evidence**: All files parse without errors

### Criterion 2: Schemas validate sample data
- **Scenario**: Run JSON Schema validator against sample state files
- **Expected evidence**: All sample state files pass schema validation

### Criterion 3: Completion gate logic is documented
- **Scenario**: Read `docs/lazytrae-state-machine.md`
- **Expected evidence**: Document describes the 5 conditions for completion

### Criterion 4: All LazyCodex statuses appear in schemas
- **Scenario**: Verify active-loop schema contains all 7 goal statuses
- **Expected evidence**: pending, in_progress, complete, failed, blocked, review_blocked, needs_user_decision

### Criterion 5: All 7 steering mutations appear in schemas
- **Scenario**: Verify active-loop schema contains all 7 steering mutation types
- **Expected evidence**: add_subgoal, split_subgoal, reorder_pending, revise_pending_wording, revise_criterion, annotate_ledger, mark_blocked_superseded

### Criterion 6: Iteration cap matches constants.ts
- **Scenario**: Verify active-loop schema max_iterations is 500
- **Expected evidence**: max_iterations: 500 (matching lazycodex constants.ts)

## Verification

```bash
# Verify all state files are valid JSON
python3 -m json.tool .lazytrae/config.json > /dev/null && echo "config.json: VALID"
python3 -m json.tool .lazytrae/state/boulder.json > /dev/null && echo "boulder.json: VALID"
python3 -m json.tool .lazytrae/state/active-loop.json > /dev/null && echo "active-loop.json: VALID"
python3 -m json.tool .lazytrae/state/sessions.json > /dev/null && echo "sessions.json: VALID"
python3 -m json.tool .lazytrae/schemas/boulder.schema.json > /dev/null && echo "boulder.schema.json: VALID"
python3 -m json.tool .lazytrae/schemas/active-loop.schema.json > /dev/null && echo "active-loop.schema.json: VALID"
python3 -m json.tool .lazytrae/schemas/evidence.schema.json > /dev/null && echo "evidence.schema.json: VALID"

# Verify all deliverable files exist
ls -la .lazytrae/config.json .lazytrae/state/boulder.json .lazytrae/state/active-loop.json .lazytrae/state/sessions.json .lazytrae/evidence/test-runs.md .lazytrae/evidence/verifier.md .lazytrae/evidence/reviewer.md .lazytrae/evidence/oracle-review.md .lazytrae/evidence/completion.md .lazytrae/evidence/handoff.md .lazytrae/schemas/boulder.schema.json .lazytrae/schemas/active-loop.schema.json .lazytrae/schemas/evidence.schema.json .omo/plans/.gitkeep .omo/ulw-loop/.gitkeep .omo/plans/sample-plan.md docs/lazytrae-state-machine.md
```

## Rollback

Remove `.lazytrae/state` and `.lazytrae/schemas`, preserving docs.