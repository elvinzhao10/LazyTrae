const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const VALID_EVENTS = ['session-start', 'user-prompt-submit', 'pre-tool-use', 'post-tool-use', 'stop'];

function run(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae hook <event-name>

Dispatch a LazyTrae hook event. Reads the corresponding hook script from
.trae/hooks/ and executes it, passing stdin through.

Events:
  session-start        Read active plan/loop/blockers/next action
  user-prompt-submit    Detect ulw/ultrawork keywords, context-pressure markers
  pre-tool-use          Warn on write-before-read and destructive git commands
  post-tool-use         Record changed files, run comment-checker
  stop                  Emit continuation reminder if work is incomplete

Options:
  --help, -h           Show this help message

Examples:
  lazytrae hook session-start
  echo '{"prompt":"ulw: fix this"}' | lazytrae hook user-prompt-submit
  echo '{"tool_name":"Write","tool_input":{"filePath":"src/a.ts"}}' | lazytrae hook post-tool-use
`);
    return;
  }

  const eventName = args[0];

  if (!VALID_EVENTS.includes(eventName)) {
    console.error(`lazytrae hook: Unknown event '${eventName}'`);
    console.error(`Valid events: ${VALID_EVENTS.join(', ')}`);
    process.exit(1);
  }

  const repoRoot = detectRepoRoot();
  const scriptPath = path.join(repoRoot, '.trae', 'hooks', `${eventName}.sh`);

  if (!fs.existsSync(scriptPath)) {
    console.error(`lazytrae hook: Hook script not found: ${scriptPath}`);
    console.error('Run "lazytrae init" to install hook scripts.');
    process.exit(1);
  }

  // Check executability
  try {
    fs.accessSync(scriptPath, fs.constants.X_OK);
  } catch (_) {
    console.error(`lazytrae hook: Hook script is not executable: ${scriptPath}`);
    console.error('Run "chmod +x .trae/hooks/*.sh" to fix.');
    process.exit(1);
  }

  // Read stdin (Trae passes hook event JSON on stdin)
  let stdinData = '';
  if (!process.stdin.isTTY) {
    stdinData = fs.readFileSync(0, 'utf-8');
  }

  try {
    const result = execSync(`bash "${scriptPath}"`, {
      cwd: repoRoot,
      input: stdinData || undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
      encoding: 'utf-8',
    });

    const stdout = result.stdout || result.toString() || '';
    if (stdout.trim()) {
      process.stdout.write(stdout);
    }

    const stderr = result.stderr;
    if (stderr && stderr.trim()) {
      process.stderr.write(stderr);
    }
  } catch (err) {
    // Hook scripts should always exit 0, but if they somehow fail, log and continue
    if (err.stdout && err.stdout.trim()) {
      process.stdout.write(err.stdout);
    }
    if (err.stderr && err.stderr.trim()) {
      process.stderr.write(`[LazyTrae hook warning] ${err.stderr}`);
    }
    // Do not exit with error — hooks must not block
    process.exit(0);
  }
}

module.exports = { run };