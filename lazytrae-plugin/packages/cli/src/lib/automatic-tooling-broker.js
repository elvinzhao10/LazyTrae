const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { readConfig, resolveApproval, resolveCapability } = require('./automatic-tooling-policy');
const { assertSafeRoot, listOwnedEntries, ownedRuntimeEnvironment, prepareOwnedRuntime, readReceipt, writeReceipt } = require('./tooling-root');
const { detectCapabilities, packageDependencies } = require('./tooling-capabilities');
const { install: installLsp, status: lspStatus } = require('./lsp-lifecycle');
const { execute: executeLsp } = require('./lsp-bridge');

const TOOLING_PACKAGE = path.resolve(__dirname, '..', '..', 'tooling');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function parseArgs(args) {
  if (args[0] !== 'run' || !args[1]) throw new Error('usage: lazytrae tooling capability run <canonical-capability> --query <text> --toolpack <empty-absolute-path>');
  const names = new Set(['--query', '--toolpack', '--timeout-ms']);
  const values = {};
  for (let index = 2; index < args.length; index += 2) {
    if (!names.has(args[index]) || !args[index + 1] || Object.hasOwn(values, args[index])) throw new Error('invalid capability run arguments');
    values[args[index]] = args[index + 1];
  }
  if (!values['--query'] || !values['--toolpack'] || !path.isAbsolute(values['--toolpack'])) throw new Error('capability run requires --query and an absolute --toolpack');
  if (values['--query'].length > 1000 || /\0/.test(values['--query'])) throw new Error('capability query is invalid');
  const timeout = values['--timeout-ms'] === undefined ? 10000 : Number(values['--timeout-ms']);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 10000) throw new Error('capability timeout must be an integer from 1 to 10000');
  return { capability: args[1], query: values['--query'], toolpack: path.resolve(values['--toolpack']), timeout };
}

function provisionSearch(toolpack, capability) {
  const name = capability === 'local_search' ? 'ripgrep' : 'ast-grep';
  const ready = detectCapabilities(toolpack).find(item => item.name === name);
  if (ready?.state === 'ready') return ready;
  const manifest = JSON.parse(fs.readFileSync(path.join(TOOLING_PACKAGE, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(TOOLING_PACKAGE, 'package-lock.json'), 'utf8'));
  const dependencies = packageDependencies([name]);
  manifest.optionalDependencies = dependencies;
  lock.packages[''].optionalDependencies = dependencies;
  fs.writeFileSync(path.join(toolpack, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(path.join(toolpack, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`, { mode: 0o600 });
  const result = spawnSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: toolpack, encoding: 'utf8', timeout: 120000, env: ownedRuntimeEnvironment(toolpack) });
  if (result.error || result.status !== 0) throw new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE');
  const installed = detectCapabilities(toolpack).find(item => item.name === name);
  if (!installed || installed.state !== 'ready') throw new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE');
  return installed;
}

function searchArguments(capability, query, workspace) {
  if (capability === 'local_search') return ['--json', '--fixed-strings', '--', query, workspace];
  return ['run', '--json=stream', '--pattern', query, workspace];
}

function runSearch(command, capability, query, workspace, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, searchArguments(capability, query, workspace), { cwd: workspace, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let failure;
    let settled = false;
    let stdinCloseActive = false;
    const killTree = () => {
      if (process.platform !== 'win32' && child.pid) { try { process.kill(-child.pid, 'SIGKILL'); return; } catch (_) {} }
      child.kill('SIGKILL');
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(stdinGrace);
      process.removeListener('SIGINT', cancel);
      process.removeListener('SIGTERM', cancel);
      process.stdin.removeListener('close', stdinClosed);
      error ? reject(error) : resolve(value);
    };
    const cancel = () => { failure ||= new Error('AUTOMATIC_TOOLING_CANCELLED'); killTree(); };
    const stdinClosed = () => { if (stdinCloseActive) cancel(); };
    const timer = setTimeout(() => { failure = new Error('AUTOMATIC_TOOLING_TIMEOUT'); killTree(); }, timeout);
    const stdinGrace = setTimeout(() => { stdinCloseActive = true; process.stdin.resume(); }, 100);
    const append = chunk => {
      output += chunk;
      if (output.length > 1024 * 1024) { failure = new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE'); killTree(); }
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', () => finish(new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE')));
    child.on('close', code => {
      if (failure) finish(failure);
      else if (code === 0 || (capability === 'local_search' && code === 1)) finish(null, output);
      else finish(new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE'));
    });
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    process.stdin.once('close', stdinClosed);
  });
}

function navigationTarget(workspace, language, query) {
  const extensions = language === 'typescript'
    ? new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
    : new Set(['.py']);
  const pending = [workspace];
  let inspected = 0;
  while (pending.length > 0 && inspected < 200) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.lazytrae') continue;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        pending.push(candidate);
        continue;
      }
      if (!entry.isFile() || !extensions.has(path.extname(entry.name))) continue;
      inspected += 1;
      if (fs.statSync(candidate).size > 1024 * 1024) continue;
      const text = fs.readFileSync(candidate, 'utf8');
      const index = text.indexOf(query);
      if (index === -1) continue;
      const line = text.slice(0, index).split('\n').length - 1;
      const character = index - text.lastIndexOf('\n', index - 1) - 1;
      return { path: path.relative(workspace, candidate), line, character };
    }
  }
  return null;
}

function unavailableNavigation() {
  return { kind: 'unavailable', code: 'AUTOMATIC_TOOLING_NAVIGATION_UNAVAILABLE' };
}

function hasNavigationResult(result) {
  return Array.isArray(result) ? result.length > 0 : result !== null && result !== undefined;
}

async function execute(request, workspace) {
  assertSafeRoot(request.toolpack, false);
  const config = readConfig({ environment: process.env });
  const resolution = resolveCapability(request.capability, { config, environment: process.env, toolpackPath: request.toolpack });
  const approval = resolveApproval({ workspace, ...resolution }, { mode: 'automatic', environment: process.env });
  if (approval.kind !== 'allowed') throw new Error('AUTOMATIC_TOOLING_PERMISSION_DENIED');
  assertSafeRoot(request.toolpack, true);
  let provider;
  let result = '';
  if (request.capability === 'local_search' || request.capability === 'structural_search') {
    prepareOwnedRuntime(request.toolpack);
    provider = provisionSearch(request.toolpack, request.capability);
    result = await runSearch(provider.command, request.capability, request.query, workspace, request.timeout);
  } else if (request.capability === 'code_navigation') {
    const state = lspStatus(workspace, request.toolpack);
    const ready = state.state === 'ready' ? state : installLsp(workspace, request.toolpack);
    if (ready.state !== 'ready') throw new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE');
    provider = { command: ready.command, source: ready.source };
    if (ready.source !== 'owned') prepareOwnedRuntime(request.toolpack);
    const target = navigationTarget(workspace, ready.language, request.query);
    if (!target) result = unavailableNavigation();
    else {
      const environment = ready.source === 'owned' ? ownedRuntimeEnvironment(request.toolpack) : undefined;
      const navigation = await executeLsp('definition', target, ready, workspace, environment, request.timeout);
      result = hasNavigationResult(navigation)
        ? { kind: 'navigation', operation: 'definition', result: navigation }
        : unavailableNavigation();
    }
  } else {
    throw new Error('AUTOMATIC_TOOLING_PROVIDER_UNAVAILABLE');
  }
  writeReceipt(request.toolpack, listOwnedEntries(request.toolpack), [request.capability]);
  return { capability: request.capability, provider: resolution.provider, result, receipt: readReceipt(request.toolpack) };
}

async function runCapability(args, workspace) {
  const request = parseArgs(args);
  let created = false;
  const cleanup = () => {
    if (created && fs.existsSync(request.toolpack)) fs.rmSync(request.toolpack, { recursive: true, force: true });
  };
  try {
    if (fs.existsSync(request.toolpack)) {
      assertSafeRoot(request.toolpack, false);
      if (fs.readdirSync(request.toolpack).length > 0) throw new Error('--toolpack must be empty before capability run');
    }
    created = true;
    return await execute(request, workspace);
  } finally {
    cleanup();
  }
}

module.exports = { parseArgs, runCapability };
