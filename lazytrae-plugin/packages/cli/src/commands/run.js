const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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

function checkTraeAgent() {
  return spawnSync('trae-agent', ['--help'], { stdio: 'ignore' }).status === 0;
}

function recordTrajectory(repoRoot, entry) {
  const logsDir = path.join(repoRoot, '.lazytrae', 'logs');
  assertSafeRepoWritePath(repoRoot, logsDir);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logPath = path.join(logsDir, 'trajectory.ndjson');
  const line = JSON.stringify(entry) + '\n';
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
  ║  trae-agent CLI is not installed.                       ║
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

  To install trae-agent for direct CLI routing:
    npm install -g trae-agent
    # or: npx trae-agent

  Documentation: docs/lazytrae-model-routing.md
  `);
}

function printUsage() {
  console.log(`Usage: lazytrae run [options] "<prompt>"

Options:
  --agent <name>       Agent to use (e.g., atlas, oracle, explorer)
  --category <name>    Routing category: quick, deep, ultrabrain, visual-engineering, writing, review
  --loop active        Run the active loop using trae-agent
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
  const hasTraeAgent = checkTraeAgent();

  if (useLoop) {
    const activeLoopPath = path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json');
    if (!fs.existsSync(activeLoopPath)) {
      console.error('lazytrae run: No active loop found. Start a loop first.');
      process.exit(1);
    }

    if (!hasTraeAgent) {
      console.log(`\ntrae-agent is not installed. Cannot run loop directly.\n`);
      console.log('Use the Trae IDE with the ulw-loop command to continue the active loop.');
      console.log('See .lazytrae/state/active-loop.json for current loop state.\n');
      process.exit(0);
    }

    try {
      console.log('Running active loop with trae-agent...');
      const result = spawnSync('trae-agent', ['run', '--trajectory', '.lazytrae/logs/active-loop.json'], { cwd: repoRoot, stdio: 'inherit' });
      process.exit(result.status || 0);
    } catch (e) {
      console.error('trae-agent failed:', e.message);
      process.exit(1);
    }
    return;
  }

  const trajectoryEntry = {
    timestamp: new Date().toISOString(),
    agent: agent || 'default',
    category: category || 'quick',
    prompt,
    runner_used: hasTraeAgent,
  };

  if (!hasTraeAgent) {
    recordTrajectory(repoRoot, { ...trajectoryEntry, status: 'guidance_only' });
    printRoutingGuidance(agent, category, prompt);
    process.exit(0);
  }

  const config = loadConfig(repoRoot);
  const resolved = resolveCategory(config, agent);
  const effectiveCategory = category || resolved.category;
  const effectiveMode = resolved.traeMode || 'auto';

  const runArgs = ['run'];
  if (effectiveMode === 'max') runArgs.push('--reasoning', 'xhigh');
  runArgs.push('--trajectory', '.lazytrae/logs/', '--input', prompt);

  try {
    console.log(`Running with trae-agent: agent=${agent}, category=${effectiveCategory}, mode=${effectiveMode}`);
    const result = spawnSync('trae-agent', runArgs, { cwd: repoRoot, stdio: 'inherit' });
    recordTrajectory(repoRoot, {
      ...trajectoryEntry,
      category: effectiveCategory,
      mode: effectiveMode,
      status: 'success',
      exit_code: result.status || 0,
    });
    process.exit(result.status || 0);
  } catch (e) {
    recordTrajectory(repoRoot, {
      ...trajectoryEntry,
      category: effectiveCategory,
      mode: effectiveMode,
      status: 'error',
      error: e.message,
    });
    console.error('trae-agent execution failed:', e.message);
    process.exit(1);
  }
}

module.exports = { run };
