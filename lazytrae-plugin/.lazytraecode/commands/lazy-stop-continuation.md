# stop-continuation

## Usage

`/lazy-stop-continuation`

Triggers: `stop-continuation`, `stop now`, `cancel loop`, `halt execution`

## Inputs

None — stops the current execution immediately.

## Outputs

- Halted state recorded in `.lazytraework/state/active-loop.json` or `.omo/boulder.json`.
- Summary of what was completed and what was interrupted.
- Cleanup request for any running resources.

## Success Criteria

- Current loop/execution state is paused and recorded.
- All running resources (servers, tmux, browsers, containers) are stopped and cleaned up.
- User is notified that execution is stopped.
- State can be resumed with `continue` or `resume` command.

## Linked Skill

(Uses the active loop/start-work state from `.lazytraework/state/` and `.omo/`)

## Workflow Phase

Control — stop the current execution loop.