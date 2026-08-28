const fs = require('fs');
const path = require('path');
const { formatReadinessSummary, readinessReport } = require('../lib/lazyseries-capability-readiness');
const { inspectInitializeReceipt } = require('../lib/initialize-receipt');
const { inspectHostProfile } = require('../lib/host-adapter-lifecycle');
const { buildStatusReport } = require('./status');
const { CURRENT_VERSION } = require('../lib/version');
const { readHost } = require('../lib/host-route');
const {
  formatHostMcpConfiguration,
  inspectCoreDeclaration,
  localCommand,
  MCP_JSON_BEGIN,
  MCP_JSON_END,
  shellQuote,
} = require('../lib/local-launcher');

const ARTIFACT_CONTRACT = Object.freeze({
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
    'session-start.sh', 'notification.sh', 'stop.sh', 'user-prompt-submit.sh',
  ],
  hookEvents: {
    SessionStart: 'session-start.sh',
    UserPromptSubmit: 'user-prompt-submit.sh',
    PreToolUse: 'pre-tool-use.sh',
    PostToolUse: 'post-tool-use.sh',
    Notification: 'notification.sh',
    Stop: 'stop.sh',
  },
  mcp: { command: 'node', launcher: 'absolute release-owned bin/lazytrae.js' },
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
  if (!fs.existsSync(hooksPath)) {
    const probeGated = fs.existsSync(path.join(repoRoot, '.lazytrae', 'asset-receipt.v1.json'))
      && !fs.existsSync(path.join(repoRoot, '.lazytrae', 'trae-ide-config-receipt.v1.json'));
    return { failures: probeGated ? [] : ['missing .trae/hooks.json'], ready: 0, pending: probeGated };
  }

  let hooks;
  try {
    hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8')).hooks;
  } catch (error) {
    return { failures: [`invalid JSON: ${error.message}`], ready: 0 };
  }
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return { failures: ['missing hooks object'], ready: 0 };
  }

  const failures = Object.entries(ARTIFACT_CONTRACT.hookEvents).flatMap(([event, script]) => {
    const expectedCommand = `bash "\${PROJECT_DIR}/.trae/hooks/${script}"`;
    const entries = hooks[event];
    const valid = Array.isArray(entries) && entries.some(entry => (
      entry && entry.type === 'command' && entry.command === expectedCommand
    ));
    return valid ? [] : [`${event} must invoke ${script}`];
  });
  return { failures, ready: Object.keys(ARTIFACT_CONTRACT.hookEvents).length - failures.length };
}

function nonExecutableHooks(repoRoot) {
  return ARTIFACT_CONTRACT.hooks.filter(name => {
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

function mcpDeclarationResult(repoRoot, host) {
  if (host === 'work') return { error: '', detail: '' };
  const mcpPath = path.join(repoRoot, '.trae', 'mcp.json');
  try {
    const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const inspection = inspectCoreDeclaration(repoRoot, config);
    return { error: inspection.ready ? '' : inspection.detail, detail: inspection.detail };
  } catch (error) {
    const detail = `invalid .trae/mcp.json: ${error.message}`;
    return { error: detail, detail };
  }
}

function printHostRegistrationStatus(host, repoRoot) {
  if (host === 'ide') {
    console.log('IDE registration: NOT VERIFIED. Package files are ready; reopen TraeCode to scan them.');
  } else if (host === 'cli') {
    console.log('CLI MCP ROUTE: CONFIGURATION JSON ONLY. No public TraeCode CLI MCP registration command is assumed; use the selected build\'s MCP settings flow.');
  } else {
    console.log('WORK MCP ROUTE: OBSERVED PRERELEASE. After approval, paste the complete configuration into Settings → MCP; this is not a documented universal host contract.');
  }
  if (host === 'ide') return;
  console.log(MCP_JSON_BEGIN);
  console.log(formatHostMcpConfiguration(repoRoot));
  console.log(MCP_JSON_END);
}

function printInitializeReceiptStatus(repoRoot) {
  const observation = inspectInitializeReceipt(repoRoot);
  if (observation.state === 'valid') {
    console.log(`MCP initialize evidence: previously observed at ${observation.receipt.last_initialized_at}; HOST PENDING — host readiness remains PENDING.`);
  } else if (observation.state === 'stale') {
    console.log(`MCP initialize evidence: WARN ${observation.detail}; HOST PENDING — host readiness remains PENDING.`);
  } else if (observation.state === 'invalid') {
    console.log(`MCP initialize evidence: WARN ${observation.detail}; HOST PENDING — host readiness remains PENDING.`);
  } else {
    console.log('MCP initialize evidence: not previously observed; HOST PENDING — host readiness remains PENDING.');
  }
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae load-check [--host ide|work|cli]

Check v${CURRENT_VERSION} package readiness after initialization. This validates local files and
configuration only; it does not claim that a host has registered or loaded them.
`);
    return 0;
  }

  const host = readHost(args);

  const repoRoot = detectRepoRoot();
  const checks = [
    { label: 'skills', missing: missingArtifacts(repoRoot, 'skills', ARTIFACT_CONTRACT.skills, 'SKILL.md') },
    { label: 'commands', missing: missingArtifacts(repoRoot, 'commands', ARTIFACT_CONTRACT.commands) },
    { label: 'agents', missing: missingArtifacts(repoRoot, 'agents', ARTIFACT_CONTRACT.agents) },
    { label: 'rules', missing: missingArtifacts(repoRoot, 'rules', ARTIFACT_CONTRACT.rules) },
    { label: 'hooks', missing: missingArtifacts(repoRoot, 'hooks', ARTIFACT_CONTRACT.hooks) },
  ];
  const hookMappings = hookMappingFailures(repoRoot);
  const hookPermissions = nonExecutableHooks(repoRoot);
  const mcpResult = mcpDeclarationResult(repoRoot, host);
  const mcpError = mcpResult.error;

  console.log(`=== LazyTrae Tool Load Check — v${CURRENT_VERSION} Package Readiness ===`);
  console.log(`Host: ${host}`);
  for (const result of checks) {
    const expected = ARTIFACT_CONTRACT[result.label].length;
    const ready = expected - result.missing.length;
    console.log(`${result.missing.length ? 'FAIL' : 'PASS'} ${result.label}: ${ready}/${expected}${result.missing.length ? ` (missing: ${result.missing.join(', ')})` : ''}`);
  }
  const eventCount = Object.keys(ARTIFACT_CONTRACT.hookEvents).length;
  const hookMappingLabel = hookMappings.pending ? 'PENDING' : hookMappings.failures.length ? 'FAIL' : 'PASS';
  const hookMappingDetail = hookMappings.pending
    ? ' (probe has not verified the IDE event/config schema; no config written)'
    : hookMappings.failures.length ? ` (${hookMappings.failures.join('; ')})` : '';
  console.log(`${hookMappingLabel} hooks.json event mappings: ${hookMappings.ready}/${eventCount}${hookMappingDetail}`);
  const hookCount = ARTIFACT_CONTRACT.hooks.length;
  console.log(`${hookPermissions.length ? 'FAIL' : 'PASS'} hook executability: ${hookCount - hookPermissions.length}/${hookCount}${hookPermissions.length ? ` (not executable: ${hookPermissions.join(', ')})` : ''}`);
  console.log(host === 'work'
    ? 'SKIP LazyTrae MCP declaration: TraeWork requires manual Settings → MCP registration'
    : `${mcpError ? 'FAIL' : 'PASS'} LazyTrae MCP declaration: ${mcpResult.detail}`);
  const readiness = readinessReport(repoRoot);
  console.log(formatReadinessSummary(readiness));

  let workSkillsDir = null;
  let workSkillsFailed = false;
  if (host === 'work') {
    const work = require('./work');
    workSkillsDir = work.readSkillsDir([]);
    const states = work.listSkills().map(name => work.skillState(workSkillsDir, name));
    const current = states.filter(state => state === 'current').length;
    workSkillsFailed = current !== states.length;
    console.log(`${workSkillsFailed ? 'FAIL' : 'PASS'} global TraeWork skills: ${current}/${states.length} current`);
  }
  const hostProfile = inspectHostProfile(repoRoot, host, { workSkillsDir });
  console.log(`Host adapter profile: package=${hostProfile.package_readiness}; generated=${hostProfile.generated_assets.status}; config=${hostProfile.config.status}; probe=${hostProfile.probe.status}; registration=${hostProfile.registration.status}; session=${hostProfile.session.status}; mcp=${hostProfile.mcp.status}; observation=${hostProfile.observation.status}; support=${hostProfile.support}; host=${hostProfile.host_readiness}`);
  const machineStatus = buildStatusReport(repoRoot, host, { workSkillsDir });
  const machineProfile = machineStatus.profiles[0];
  console.log(`PASS Machine status v2: version=${machineStatus.version}; adapter=${machineProfile.host}; package=${machineProfile.package_readiness}; probe=${machineProfile.probe.status}; host=${machineProfile.host_readiness}`);

  printHostRegistrationStatus(host, repoRoot);
  printInitializeReceiptStatus(repoRoot);
  const readinessStateInvalid = readiness.some(record => record.reason_code === 'STATE_INVALID');
  const projectFailed = checks.some(result => result.missing.length) || hookMappings.failures.length > 0
    || hookPermissions.length > 0 || Boolean(mcpError) || readinessStateInvalid;
  const failed = projectFailed || workSkillsFailed;
  if (!failed) {
    console.log('Package readiness passed. Load check passed for package readiness; complete the host registration step shown above.');
  } else {
    if (projectFailed) console.log(`Package readiness failed. Run ${localCommand(repoRoot)} sync, then re-run this check.`);
    if (workSkillsFailed) {
      console.log(`WORK SKILLS ACTION: APPROVAL REQUIRED. Ask before running ${localCommand(repoRoot)} work install --skills-dir ${shellQuote(workSkillsDir)}; sync does not install Work-global Skills.`);
    }
  }
  return failed ? 1 : 0;
}

module.exports = { ARTIFACT_CONTRACT, run };
