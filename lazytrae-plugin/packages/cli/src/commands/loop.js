const { detectRepoRoot } = require('../lib/loop-store');
const runtime = require('../lib/loop-runtime');

function printHelp() {
  console.log(`Usage: lazytrae loop <subcommand> [options]

Subcommands:
  status                         Print current loop state
  cancel                         Cancel the active loop
  pause                          Pause the active loop
  resume                         Resume a paused loop
  log [-n N] [--filter type]      Print loop-events.ndjson entries
  create-goals --brief <text|file> --goal-id <id> --criterion-id <id>
  complete-goals                 Start or resume the next pending goal
  criteria <goal>                Print success criteria for a goal
  record-evidence <goal> <criterion> <artifact> [--status pass|fail|blocked] [--reason text]
  record-review-blockers <goal> --title <title> --objective <text> --evidence <text>
  steer --kind <mutation> [...]   Apply a canonical LazyCodex steering mutation
  checkpoint --quality-gate-json <file>

Canonical steering mutations:
  add_subgoal, split_subgoal, reorder_pending, revise_pending_wording,
  revise_criterion, annotate_ledger, mark_blocked_superseded

Options:
  --help, -h                     Show this help message`);
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const repoRoot = detectRepoRoot();
  const subcommand = args[0];
  const rest = args.slice(1);
  const commands = {
    status: runtime.status,
    cancel: runtime.cancel,
    pause: runtime.pause,
    resume: runtime.resume,
    log: runtime.log,
    'create-goals': runtime.createGoals,
    'complete-goals': runtime.completeGoals,
    criteria: runtime.criteria,
    'record-evidence': runtime.recordEvidence,
    'record-review-blockers': runtime.recordReviewBlockers,
    steer: runtime.steer,
    checkpoint: runtime.checkpoint,
  };

  const handler = commands[subcommand];
  if (!handler) {
    printHelp();
    if (subcommand) process.exit(1);
    return;
  }
  try {
    handler(repoRoot, rest);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { run };
