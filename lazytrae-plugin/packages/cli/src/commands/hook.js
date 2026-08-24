const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { TextDecoder } = require('node:util');
const {
  formatAdaptiveDirective,
  malformedAdaptiveDirective,
  processAdaptivePrompt,
} = require('../lib/adaptive-runtime');
const { localCommand } = require('../lib/local-command');
const { assertSafeRepoWritePath } = require('../lib/path-boundary');

const MAX_HOOK_INPUT_BYTES = 1024 * 1024;
const CONTEXT_MARKERS = /context compacted|context_length_exceeded|skill descriptions were shortened|context_too_large|codex ran out of room|your input exceeds the context window|long threads and multiple compactions/i;

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const VALID_EVENTS = ['session-start', 'user-prompt-submit', 'pre-tool-use', 'post-tool-use', 'notification', 'stop', 'recover-context'];

async function readBoundedStdin() {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (totalBytes > MAX_HOOK_INPUT_BYTES - bytes.length) {
      return { ok: false, data: '', reason: 'too-large' };
    }
    chunks.push(bytes);
    totalBytes += bytes.length;
  }
  try {
    const data = new TextDecoder('utf-8', { fatal: true })
      .decode(Buffer.concat(chunks, totalBytes));
    return { ok: true, data, reason: null };
  } catch (_) {
    return { ok: false, data: '', reason: 'invalid-utf8' };
  }
}

function parsePrompt(stdinData, args) {
  if (stdinData.trim()) {
    try {
      const event = JSON.parse(stdinData);
      const prompt = event && typeof event === 'object' && !Array.isArray(event)
        ? event.prompt ?? event.user_prompt
        : null;
      return typeof prompt === 'string' && prompt.trim()
        ? { ok: true, prompt }
        : { ok: false, prompt: null };
    } catch (_) {
      return { ok: false, prompt: null };
    }
  }
  const prompt = args.slice(1).join(' ');
  return prompt.trim() ? { ok: true, prompt } : { ok: false, prompt: null };
}

function markContextRecovery(repoRoot) {
  const recoveryPath = path.join(repoRoot, '.trae', 'hooks', 'context-recovery.sh');
  if (!fs.existsSync(recoveryPath)) return;
  const result = spawnSync('bash', [recoveryPath, 'mark', 'context-pressure marker in UserPromptSubmit'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
  if (result.stderr && result.stderr.trim()) process.stderr.write(result.stderr);
}

async function run(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae hook <event-name>

Dispatch a LazyTrae hook event. Reads the corresponding hook script from
.trae/hooks/ and executes it, passing stdin through.

Events:
  session-start        Read active plan/loop/blockers/next action
  user-prompt-submit    Detect ulw/ultrawork keywords, context-pressure markers
  pre-tool-use          Warn on write-before-read and destructive git commands
  post-tool-use         Record changed files, run comment-checker
  notification          Ingest advisory status without completion authority
  recover-context       Manually emit and clear post-compact recovery context
  stop                  Emit continuation reminder if work is incomplete

Options:
  --help, -h           Show this help message

Examples:
  lazytrae hook session-start
  echo '{"prompt":"ulw: fix this"}' | lazytrae hook user-prompt-submit
  lazytrae hook recover-context
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
  if (['post-tool-use', 'recover-context'].includes(eventName)) {
    try {
      assertSafeRepoWritePath(repoRoot, path.join(repoRoot, '.lazytrae', 'state', 'sessions.json'));
    } catch (error) {
      process.stderr.write(`[LazyTrae hook warning] ${error.message}\n`);
      return;
    }
  }
  const scriptPath = path.join(repoRoot, '.trae', 'hooks', `${eventName}.sh`);

  if (!fs.existsSync(scriptPath)) {
    console.error(`lazytrae hook: Hook script not found: ${scriptPath}`);
    console.error(`Run "${localCommand(repoRoot)} init" to install hook scripts.`);
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
    let input;
    try {
      input = await readBoundedStdin();
    } catch (_) {
      if (eventName === 'user-prompt-submit') {
        process.stdout.write(formatAdaptiveDirective(malformedAdaptiveDirective()));
      }
      process.stderr.write('[LazyTrae hook warning] Hook input could not be read safely.\n');
      return;
    }
    if (!input.ok) {
      if (eventName === 'user-prompt-submit') {
        process.stdout.write(formatAdaptiveDirective(malformedAdaptiveDirective()));
      }
      const warning = input.reason === 'invalid-utf8'
        ? 'Hook input is not valid UTF-8.'
        : 'Hook input exceeds the safe size limit.';
      process.stderr.write(`[LazyTrae hook warning] ${warning}\n`);
      return;
    }
    stdinData = input.data;
  }

  if (eventName === 'user-prompt-submit') {
    const parsed = parsePrompt(stdinData, args);
    const adaptive = parsed.ok
      ? processAdaptivePrompt({ repoRoot, prompt: parsed.prompt })
      : { directive: malformedAdaptiveDirective(), warning: null };
    process.stdout.write(formatAdaptiveDirective(adaptive.directive));
    if (adaptive.warning) process.stderr.write(`[LazyTrae hook warning] ${adaptive.warning}\n`);
    if (parsed.ok
      && CONTEXT_MARKERS.test(parsed.prompt)
      && process.env.LAZYTRAE_ADAPTIVE_ONLY !== '1') {
      markContextRecovery(repoRoot);
    }
    return;
  }

  try {
    const result = spawnSync('bash', [scriptPath], {
      cwd: repoRoot,
      input: stdinData || undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
      encoding: 'utf-8',
      env: eventName === 'user-prompt-submit'
        ? {
          ...process.env,
          LAZYTRAE_ADAPTIVE_EMITTED: '1',
          LAZYTRAE_ADAPTIVE_SUPPRESS_LEGACY: '1',
        }
        : process.env,
    });

    const stdout = result.stdout || '';
    if (stdout.trim()) {
      process.stdout.write(stdout);
    }

    const stderr = result.stderr;
    if (stderr && stderr.trim()) {
      process.stderr.write(stderr);
    }
    if (result.status && result.status !== 0) {
      process.stderr.write(`[LazyTrae hook warning] Hook exited with code ${result.status}\n`);
      process.exit(0);
    }
    if (result.error) {
      process.stderr.write(`[LazyTrae hook warning] ${result.error.message}\n`);
      process.exit(0);
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

module.exports = { MAX_HOOK_INPUT_BYTES, run };
