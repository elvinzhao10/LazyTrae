const fs = require('fs');
const path = require('path');
const { sha256Digest } = require('../lib/adaptive-decision');
const { formatAdaptiveDirective, processAdaptivePrompt } = require('../lib/adaptive-runtime');
const { assertSafeRepoWritePath } = require('../lib/path-boundary');

const CATEGORIES = ['quick', 'deep', 'ultrabrain', 'visual-engineering', 'writing', 'review'];

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function loadConfig(repoRoot) {
  const configPath = path.join(repoRoot, '.lazytrae', 'config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function resolveCategory(config, agent) {
  if (config && config.routing) {
    for (const [catName, catConfig] of Object.entries(config.routing)) {
      if (catConfig.agents && catConfig.agents.includes(agent)) {
        return { category: catName, ...catConfig };
      }
    }
  }
  return { category: 'quick', traeMode: 'auto', description: 'Default routing' };
}

function recordTrajectory(repoRoot, entry) {
  const logsDir = path.join(repoRoot, '.lazytrae', 'logs');
  assertSafeRepoWritePath(repoRoot, logsDir);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logPath = path.join(logsDir, 'trajectory.ndjson');
  const { prompt, ...metadata } = entry;
  const line = JSON.stringify({ ...metadata, prompt_digest: sha256Digest(prompt) }) + '\n';
  fs.appendFileSync(logPath, line, 'utf-8');
}

function printRoutingGuidance(agent, category, prompt) {
  const repoRoot = detectRepoRoot();
  const config = loadConfig(repoRoot);
  const resolved = config ? resolveCategory(config, agent) : { category: 'quick', traeMode: 'auto' };
  const effectiveCategory = category || resolved.category;
  const effectiveMode = resolved.traeMode || 'auto';

  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  Direct product CLI execution is disabled.              ║
  ║  Use the routing guidance below to run this task        ║
  ║  manually in Trae IDE.                                  ║
  ╚══════════════════════════════════════════════════════════╝

  Task: ${prompt}

  Routing Recommendation:
    Agent:       ${agent || '(unspecified)'}
    Category:    ${effectiveCategory}
    Trae Mode:   ${effectiveMode === 'max' ? 'Max' : 'Auto'}
    Description: ${resolved.description || 'Standard execution'}

  How to apply:
    1. Open Trae IDE in this project.
    2. Switch to ${effectiveMode === 'max' ? 'Max' : 'Auto'} mode.
    3. Select the "${agent}" agent (or run the task in the main session).
    4. Paste: ${prompt}

  No open-source trae-agent or PATH-discovered binary is used as a Trae product CLI.
  Continue with the project-local Trae IDE route above.

  Routing guidance is included in this command and .lazytrae/config.json
  `);
}

function printUsage() {
  console.log(`Usage: lazytrae run [options] "<prompt>"

Options:
  --agent <name>       Agent to use (e.g., atlas, oracle, explorer)
  --category <name>    Routing category: quick, deep, ultrabrain, visual-engineering, writing, review
  --loop active        Present the active loop for continuation in Trae IDE
  --help, -h           Show this help message

Categories:
  quick              Auto mode — fast, efficient execution
  deep               Max mode — complex reasoning and debugging
  ultrabrain         Max mode — strongest reasoning for critical judgment
  visual-engineering Max mode — visual/frontend-capable model
  writing            Auto mode — documentation and research
  review             Max mode — read-only review stance

Examples:
  lazytrae run --agent atlas --category quick "Run the auth tests"
  lazytrae run --agent oracle --category ultrabrain "Review the current diff"
  lazytrae run --agent explorer --category quick "Find all API route handlers"
  lazytrae run --loop active
`);
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  let agent = null;
  let category = null;
  let prompt = '';
  let useLoop = false;
  let runtimeFreshness = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && i + 1 < args.length) {
      agent = args[i + 1];
      i++;
    } else if (args[i] === '--category' && i + 1 < args.length) {
      category = args[i + 1];
      i++;
    } else if (args[i] === '--loop' && i + 1 < args.length) {
      if (args[i + 1] === 'active') {
        useLoop = true;
        i++;
      }
    } else if (args[i] === '--runtime-context' && i + 1 < args.length) {
      const contextPath = path.resolve(args[i + 1]);
      runtimeFreshness = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
      i++;
    } else if (!args[i].startsWith('--')) {
      prompt = args[i];
    }
  }

  if (!useLoop && !prompt) {
    console.error('lazytrae run: No prompt provided.');
    console.error('Usage: lazytrae run --agent <name> --category <name> "<prompt>"');
    process.exit(1);
  }

  if (category && !CATEGORIES.includes(category)) {
    console.error(`lazytrae run: Unknown category '${category}'.`);
    console.error(`Valid categories: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  const repoRoot = detectRepoRoot();
  if (!useLoop) {
    const adaptive = processAdaptivePrompt({ repoRoot, prompt, context: { runtimeFreshness } });
    process.stdout.write(formatAdaptiveDirective(adaptive.directive));
    if (adaptive.warning) process.stderr.write(`[LazyTrae run warning] ${adaptive.warning}\n`);
    if (adaptive.directive.dispatch !== 'presented-to-host') return;
  }
  if (useLoop) {
    const activeLoopPath = path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json');
    if (!fs.existsSync(activeLoopPath)) {
      console.error('lazytrae run: No active loop found. Start a loop first.');
      process.exit(1);
    }

    console.log('\nDirect product CLI execution is disabled.\n');
    console.log('Use Trae IDE with the ulw-loop command to continue the active loop.');
    console.log('See .lazytrae/state/active-loop.json for current loop state.\n');
    process.exit(0);
    return;
  }

  const trajectoryEntry = {
    timestamp: new Date().toISOString(),
    agent: agent || 'default',
    category: category || 'quick',
    prompt,
    runner_used: false,
  };

  recordTrajectory(repoRoot, { ...trajectoryEntry, status: 'guidance_only' });
  printRoutingGuidance(agent, category, prompt);
  process.exit(0);
}

module.exports = { run };
