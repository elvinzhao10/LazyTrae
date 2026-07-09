const fs = require('fs');
const path = require('path');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, '.lazytrae'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function safeReadJSON(filePath) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : null; }
  catch (e) { return null; }
}

function safeWriteJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function loadLoop(repoRoot) {
  return safeReadJSON(path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json'));
}

function saveLoop(repoRoot, data) {
  safeWriteJSON(path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json'), data);
}

function appendEvent(repoRoot, event) {
  const logPath = path.join(repoRoot, '.lazytrae', 'logs', 'loop-events.ndjson');
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
}

function makeEvent(runId, eventType, loopState, taskIndex, details) {
  return { timestamp: new Date().toISOString(), run_id: runId, event_type: eventType, loop_state: loopState, task_index: taskIndex, details };
}

function loopStatus(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) {
    console.log('No active loop found. Run `lazytrae loop --help` for usage.');
    return;
  }

  const goals = loop.goals || [];
  const completed = goals.filter(g => g.status === 'complete').length;
  const pending = goals.filter(g => g.status === 'pending').length;
  const inProgress = goals.filter(g => g.status === 'in_progress').length;
  const blocked = goals.filter(g => g.status === 'blocked' || g.status === 'review_blocked').length;

  console.log(`Loop State: ${loop.loop_state || 'idle'}`);
  console.log(`Run ID:     ${loop.run_id || 'N/A'}`);
  console.log(`Mode:       ${loop.loop_mode || 'N/A'}`);
  console.log(`Iteration:  ${loop.iteration || 0}/${loop.max_iterations || 500}`);
  console.log(`Task:       ${loop.current_task_index != null ? `#${loop.current_task_index + 1}` : 'N/A'}`);
  console.log(`Retries:    ${loop.retry_count || 0}/${loop.max_retries || 3}`);
  console.log(`Verdict:    ${loop.reviewer_verdict || 'N/A'}`);
  console.log(`Promise:    ${loop.completion_promise || 'N/A'}`);
  console.log(`Started:    ${loop.started_at || 'N/A'}`);
  console.log(`Completed:  ${loop.completed_at || 'N/A'}`);
  console.log(`Goals:      ${completed} complete, ${inProgress} in_progress, ${pending} pending, ${blocked} blocked (${goals.length} total)`);
}

function loopCancel(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) {
    console.error('No active loop to cancel.');
    process.exit(1);
  }

  const cancellable = ['idle', 'initializing', 'planning', 'active', 'verifying', 'reviewing', 'blocked', 'paused'];
  if (!cancellable.includes(loop.loop_state)) {
    console.error(`Cannot cancel loop in state '${loop.loop_state}'.`);
    process.exit(1);
  }

  loop.loop_state = 'cancelled';
  loop.cancelled_at = new Date().toISOString();
  loop.updated_at = new Date().toISOString();
  saveLoop(repoRoot, loop);

  appendEvent(repoRoot, makeEvent(loop.run_id, 'loop_cancelled', 'cancelled', loop.current_task_index || 0, 'Loop cancelled by user via CLI.'));
  console.log('Loop cancelled.');
}

function loopPause(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) {
    console.error('No active loop to pause.');
    process.exit(1);
  }

  const pausable = ['active', 'verifying', 'blocked'];
  if (!pausable.includes(loop.loop_state)) {
    console.error(`Cannot pause loop in state '${loop.loop_state}'.`);
    process.exit(1);
  }

  loop.loop_state = 'paused';
  loop.updated_at = new Date().toISOString();
  saveLoop(repoRoot, loop);

  appendEvent(repoRoot, makeEvent(loop.run_id, 'loop_paused', 'paused', loop.current_task_index || 0, 'Loop paused by user via CLI.'));
  console.log('Loop paused. Use `lazytrae loop resume` to continue.');
}

function loopResume(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) {
    console.error('No active loop to resume.');
    process.exit(1);
  }

  if (loop.loop_state !== 'paused') {
    console.error(`Cannot resume loop in state '${loop.loop_state}'. Use 'paused' state only.`);
    process.exit(1);
  }

  loop.loop_state = 'active';
  loop.updated_at = new Date().toISOString();
  saveLoop(repoRoot, loop);

  appendEvent(repoRoot, makeEvent(loop.run_id, 'loop_resumed', 'active', loop.current_task_index || 0, 'Loop resumed by user via CLI.'));
  console.log('Loop resumed.');
}

function loopLog(repoRoot, args) {
  const logPath = path.join(repoRoot, '.lazytrae', 'logs', 'loop-events.ndjson');
  if (!fs.existsSync(logPath)) {
    console.log('No event log found at .lazytrae/logs/loop-events.ndjson');
    return;
  }

  const raw = fs.readFileSync(logPath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);

  const nIndex = args.indexOf('-n');
  const count = nIndex !== -1 && nIndex + 1 < args.length ? parseInt(args[nIndex + 1], 10) : 20;
  const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null;

  let events = lines.map(line => {
    try { return JSON.parse(line); } catch (e) { return null; }
  }).filter(Boolean);

  if (filter) {
    events = events.filter(e => e.event_type === filter);
  }

  const recent = events.slice(-count);

  if (recent.length === 0) {
    console.log('No events found.');
    return;
  }

  console.log(`Last ${recent.length} events${filter ? ` (filter: ${filter})` : ''}:`);
  console.log('');

  for (const event of recent) {
    const time = event.timestamp ? event.timestamp.substring(11, 19) : '--:--:--';
    const type = event.event_type.padEnd(22);
    const state = (event.loop_state || 'N/A').padEnd(14);
    console.log(`${time}  ${type}  ${state}  ${event.details || ''}`);
  }
}

function loopCheckpoint(repoRoot) {
  const loop = loadLoop(repoRoot);
  if (!loop) { console.error('No active loop. Cannot checkpoint.'); process.exit(1); }

  const id = `cp-${String((loop.checkpoints || []).length + 1).padStart(3, '0')}`;
  const checkpoint = {
    id, iteration: (loop.iteration || 0) + 1, created_at: new Date().toISOString(),
    goal_id: loop.active_goal_id || 'N/A', status: 'checkpointed',
    summary: `Manual checkpoint at task ${(loop.current_task_index || 0) + 1}. State: ${loop.loop_state}.`,
    evidence_paths: [],
  };

  if (!loop.checkpoints) loop.checkpoints = [];
  loop.checkpoints.push(checkpoint);
  loop.updated_at = new Date().toISOString();
  saveLoop(repoRoot, loop);

  appendEvent(repoRoot, makeEvent(loop.run_id, 'checkpoint_saved', loop.loop_state, loop.current_task_index || 0, `Manual checkpoint ${id} saved.`));
  console.log(`Checkpoint ${id} saved.`);
}

function printHelp() {
  console.log(`Usage: lazytrae loop <subcommand> [options]

Subcommands:
  status      Print current loop state, iteration, task, completion promise
  cancel      Cancel the active loop
  pause       Pause the active loop
  resume      Resume a paused loop
  log         Print last N events from loop-events.ndjson
  checkpoint  Save a manual checkpoint

Options:
  --help, -h             Show this help message
  -n <N>                 Show last N events (for 'log', default: 20)
  --filter <event_type>  Filter events by type (for 'log')`);
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const repoRoot = detectRepoRoot();
  const subcommand = args[0];

  switch (subcommand) {
    case 'status':
      loopStatus(repoRoot);
      break;
    case 'cancel':
      loopCancel(repoRoot);
      break;
    case 'pause':
      loopPause(repoRoot);
      break;
    case 'resume':
      loopResume(repoRoot);
      break;
    case 'log':
      loopLog(repoRoot, args.slice(1));
      break;
    case 'checkpoint':
      loopCheckpoint(repoRoot);
      break;
    default:
      printHelp();
      if (subcommand) process.exit(1);
      break;
  }
}

module.exports = { run };
