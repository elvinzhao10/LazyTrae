const fs = require('fs');
const path = require('path');
const { formatReadinessSummary, readinessReport } = require('../lib/lazyseries-capability-readiness');

const V015_ARTIFACT_CONTRACT = Object.freeze({
  skills: [
    'lazy-ast-grep', 'lazy-coding-agent-sessions', 'lazy-debugging', 'lazy-frontend', 'lazy-git-master',
    'lazy-init-deep', 'lazy-lcx-report-bug', 'lazy-librarian', 'lazy-migration-planner', 'lazy-programming',
    'lazy-refactor', 'lazy-remove-ai-slops', 'lazy-reviewer', 'lazy-start-work', 'lazy-ulw-loop', 'lazy-ulw-plan',
    'lazy-verifier',
  ],
  commands: [
    'lazy-handoff.md', 'lazy-init-deep.md', 'lazy-ralph-loop.md', 'lazy-remove-ai-slops.md', 'lazy-review-work.md',
    'lazy-start-work.md', 'lazy-stop-continuation.md', 'lazy-ulw-loop.md', 'lazy-ulw-plan.md',
  ],
  agents: [
    'atlas.md', 'cleaner.md', 'explorer.md', 'hephaestus.md', 'librarian.md', 'metis.md', 'migration-planner.md',
    'momus.md', 'oracle.md', 'prometheus.md', 'sisyphus.md',
  ],
  rules: ['css.md', 'lazytrae.md', 'python.md', 'typescript.md'],
  hooks: [
    'context-recovery.sh', 'dynamic-rules.sh', 'post-tool-use.sh', 'pre-tool-use.sh', 'recover-context.sh',
    'session-start.sh', 'stop.sh', 'user-prompt-submit.sh',
  ],
  hookEvents: {
    SessionStart: 'session-start.sh',
    UserPromptSubmit: 'user-prompt-submit.sh',
    PreToolUse: 'pre-tool-use.sh',
    PostToolUse: 'post-tool-use.sh',
    Stop: 'stop.sh',
  },
  mcp: { command: 'lazytrae', args: ['mcp'] },
});

function detectRepoRoot() {
  let directory = process.cwd();
  while (directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, '.git'))) return directory;
    directory = path.dirname(directory);
  }
  return process.cwd();
}

function missingArtifacts(repoRoot, directory, names, nestedFile) {
  return names.filter(name => {
    const target = path.join(repoRoot, '.trae', directory, name);
    try {
      if (nestedFile) {
        return !fs.statSync(target).isDirectory() || !fs.statSync(path.join(target, nestedFile)).isFile();
      }
      return !fs.statSync(target).isFile();
    } catch (_) {
      return true;
    }
  });
}

function hookMappingFailures(repoRoot) {
  const hooksPath = path.join(repoRoot, '.trae', 'hooks.json');
  if (!fs.existsSync(hooksPath)) return { failures: ['missing .trae/hooks.json'], ready: 0 };

  let hooks;
  try {
    hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8')).hooks;
  } catch (error) {
    return { failures: [`invalid JSON: ${error.message}`], ready: 0 };
  }
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return { failures: ['missing hooks object'], ready: 0 };
  }

  const failures = Object.entries(V015_ARTIFACT_CONTRACT.hookEvents).flatMap(([event, script]) => {
    const expectedCommand = `bash "\${PROJECT_DIR}/.trae/hooks/${script}"`;
    const entries = hooks[event];
    const valid = Array.isArray(entries) && entries.some(entry => (
      entry && entry.type === 'command' && entry.command === expectedCommand
    ));
    return valid ? [] : [`${event} must invoke ${script}`];
  });
  return { failures, ready: Object.keys(V015_ARTIFACT_CONTRACT.hookEvents).length - failures.length };
}

function nonExecutableHooks(repoRoot) {
  return V015_ARTIFACT_CONTRACT.hooks.filter(name => {
    const hookPath = path.join(repoRoot, '.trae', 'hooks', name);
    try {
      if (!fs.statSync(hookPath).isFile()) return true;
      fs.accessSync(hookPath, fs.constants.X_OK);
      return false;
    } catch (_) {
      return true;
    }
  });
}

function mcpDeclarationError(repoRoot, host) {
  if (host === 'work') return '';
  const mcpPath = path.join(repoRoot, '.trae', 'mcp.json');
  try {
    const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const server = config && config.mcpServers && config.mcpServers.lazytrae;
    const { command, args } = V015_ARTIFACT_CONTRACT.mcp;
    if (!server || server.command !== command || !Array.isArray(server.args)
      || server.args.length !== args.length || server.args.some((arg, index) => arg !== args[index])) {
      return 'expected command "lazytrae" args ["mcp"]';
    }
  } catch (error) {
    return `invalid .trae/mcp.json: ${error.message}`;
  }
  return '';
}

function printHostRegistrationStatus(host) {
  if (host === 'ide') {
    console.log('IDE registration: NOT VERIFIED. Package files are ready; reopen Trae IDE to scan them.');
  } else if (host === 'cli') {
    console.log('CLI registration: NOT VERIFIED. Package declaration is ready; register it with trae-cli mcp add-json.');
  } else {
    console.log('Work registration: MANUAL REQUIRED. Add lazytrae mcp in Settings → MCP; package readiness cannot confirm it.');
  }
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae load-check [--host ide|work|cli]

Check v0.18.0 package readiness after initialization. This validates local files and
configuration only; it does not claim that a host has registered or loaded them.
`);
    return 0;
  }

  const hostIndex = args.indexOf('--host');
  const host = hostIndex === -1 ? 'ide' : args[hostIndex + 1];
  if (!['ide', 'work', 'cli'].includes(host)) throw new Error('--host must be ide, work, or cli.');

  const repoRoot = detectRepoRoot();
  const checks = [
    { label: 'skills', missing: missingArtifacts(repoRoot, 'skills', V015_ARTIFACT_CONTRACT.skills, 'SKILL.md') },
    { label: 'commands', missing: missingArtifacts(repoRoot, 'commands', V015_ARTIFACT_CONTRACT.commands) },
    { label: 'agents', missing: missingArtifacts(repoRoot, 'agents', V015_ARTIFACT_CONTRACT.agents) },
    { label: 'rules', missing: missingArtifacts(repoRoot, 'rules', V015_ARTIFACT_CONTRACT.rules) },
    { label: 'hooks', missing: missingArtifacts(repoRoot, 'hooks', V015_ARTIFACT_CONTRACT.hooks) },
  ];
  const hookMappings = hookMappingFailures(repoRoot);
  const hookPermissions = nonExecutableHooks(repoRoot);
  const mcpError = mcpDeclarationError(repoRoot, host);

  console.log('=== LazyTrae Tool Load Check — v0.18.0 Package Readiness ===');
  console.log(`Host: ${host}`);
  for (const result of checks) {
    const expected = V015_ARTIFACT_CONTRACT[result.label].length;
    const ready = expected - result.missing.length;
    console.log(`${result.missing.length ? 'FAIL' : 'PASS'} ${result.label}: ${ready}/${expected}${result.missing.length ? ` (missing: ${result.missing.join(', ')})` : ''}`);
  }
  const eventCount = Object.keys(V015_ARTIFACT_CONTRACT.hookEvents).length;
  console.log(`${hookMappings.failures.length ? 'FAIL' : 'PASS'} hooks.json event mappings: ${hookMappings.ready}/${eventCount}${hookMappings.failures.length ? ` (${hookMappings.failures.join('; ')})` : ''}`);
  const hookCount = V015_ARTIFACT_CONTRACT.hooks.length;
  console.log(`${hookPermissions.length ? 'FAIL' : 'PASS'} hook executability: ${hookCount - hookPermissions.length}/${hookCount}${hookPermissions.length ? ` (not executable: ${hookPermissions.join(', ')})` : ''}`);
  console.log(host === 'work'
    ? 'SKIP LazyTrae MCP declaration: Trae Work requires manual Settings → MCP registration'
    : `${mcpError ? 'FAIL' : 'PASS'} LazyTrae MCP declaration: ${mcpError || 'command "lazytrae" args ["mcp"]'}`);
  const readiness = readinessReport(repoRoot);
  console.log(formatReadinessSummary(readiness));

  let workSkillsFailed = false;
  if (host === 'work') {
    const work = require('./work');
    const skillsDir = work.readSkillsDir([]);
    const states = work.listSkills().map(name => work.skillState(skillsDir, name));
    const current = states.filter(state => state === 'current').length;
    workSkillsFailed = current !== states.length;
    console.log(`${workSkillsFailed ? 'FAIL' : 'PASS'} global Trae Work skills: ${current}/${states.length} current`);
  }

  printHostRegistrationStatus(host);
  const readinessStateInvalid = readiness.some(record => record.reason_code === 'STATE_INVALID');
  const failed = checks.some(result => result.missing.length) || hookMappings.failures.length > 0 || hookPermissions.length > 0 || Boolean(mcpError) || workSkillsFailed || readinessStateInvalid;
  console.log(failed
    ? 'Package readiness failed. Run lazytrae sync, then re-run this check.'
    : 'Package readiness passed. Load check passed for package readiness; complete the host registration step shown above.');
  return failed ? 1 : 0;
}

module.exports = { V015_ARTIFACT_CONTRACT, run };
