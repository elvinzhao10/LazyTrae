const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ALLOWED = new Set(['lint', 'typecheck', 'test', 'build']);

function command(command, args, source) {
  return { command, args, source, display: [command, ...args].join(' ') };
}

function readFile(root, name) {
  const target = path.join(root, name);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

function packageManager(root) {
  const managers = [
    ['package-lock.json', process.platform === 'win32' ? 'npm.cmd' : 'npm'],
    ['pnpm-lock.yaml', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'],
    ['yarn.lock', process.platform === 'win32' ? 'yarn.cmd' : 'yarn'],
    ['bun.lock', process.platform === 'win32' ? 'bun.exe' : 'bun'],
    ['bun.lockb', process.platform === 'win32' ? 'bun.exe' : 'bun'],
  ];
  const found = managers.find(([lockfile]) => fs.existsSync(path.join(root, lockfile)));
  return found ? found[1] : null;
}

function packageCommands(root) {
  const text = readFile(root, 'package.json');
  const manager = packageManager(root);
  if (!text || !manager) return [];
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (_) {
    return [];
  }
  const scripts = manifest.scripts && typeof manifest.scripts === 'object' ? manifest.scripts : {};
  return [...ALLOWED].filter(name => typeof scripts[name] === 'string' && scripts[name].trim())
    .map(name => ({ name, ...command(manager, ['run', name], 'package.json') }));
}

function pythonCommands(root) {
  const text = readFile(root, 'pyproject.toml');
  if (!text) return [];
  const commands = [];
  if (/^\[tool\.ruff\]/m.test(text)) commands.push({ name: 'lint', ...command('python', ['-m', 'ruff', 'check', '.'], 'pyproject.toml') });
  if (/^\[tool\.(?:basedpyright|pyright)\]/m.test(text)) commands.push({ name: 'typecheck', ...command('python', ['-m', 'basedpyright'], 'pyproject.toml') });
  if (/^\[tool\.pytest(?:\.ini_options)?\]/m.test(text)) commands.push({ name: 'test', ...command('python', ['-m', 'pytest'], 'pyproject.toml') });
  if (/^\[build-system\]/m.test(text)) commands.push({ name: 'build', ...command('python', ['-m', 'build'], 'pyproject.toml') });
  return commands;
}

function makeCommands(root) {
  const text = readFile(root, 'Makefile');
  if (!text) return [];
  return [...ALLOWED].filter(name => new RegExp(`^${name}\\s*:(?![=])`, 'm').test(text))
    .map(name => ({ name, ...command('make', [name], 'Makefile') }));
}

function uniqueCommands(commands) {
  const seen = new Set();
  return commands.filter(item => {
    const key = `${item.name}\u0000${item.display}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function discoverVerification(root) {
  return uniqueCommands([...packageCommands(root), ...pythonCommands(root), ...makeCommands(root)]);
}

function parseVerifyArgs(args) {
  const dryRun = args.includes('--dry-run');
  const run = args.includes('--run');
  if (dryRun === run) throw new Error('verify requires exactly one of --dry-run or --run');
  if (dryRun && args.length !== 1) throw new Error('verify --dry-run accepts no selections');
  const marker = args.indexOf('--run');
  const selected = run ? args.slice(marker + 1) : [];
  if (run && marker !== 0) throw new Error('verify --run must appear before its selections');
  if (selected.some(value => !ALLOWED.has(value))) throw new Error('verify selections must be lint, typecheck, test, or build');
  if (run && selected.length === 0) throw new Error('verify --run requires an explicit selection');
  if (new Set(selected).size !== selected.length) throw new Error('verify selections must not be repeated');
  return { dryRun, selected };
}

function npmRuntimeEnvironment() {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-npm-verify-'));
  const home = path.join(runtime, 'home');
  const cache = path.join(runtime, 'npm-cache');
  const logs = path.join(runtime, 'npm-logs');
  const config = path.join(runtime, 'config');
  const data = path.join(runtime, 'data');
  const state = path.join(runtime, 'state');
  for (const directory of [home, cache, logs, config, data, state]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return {
    runtime,
    environment: {
      ...process.env,
      HOME: home,
      XDG_CACHE_HOME: cache,
      XDG_CONFIG_HOME: config,
      XDG_DATA_HOME: data,
      XDG_STATE_HOME: state,
      npm_config_cache: cache,
      npm_config_logs_dir: logs,
      npm_config_update_notifier: 'false',
      npm_config_userconfig: path.join(config, 'npmrc'),
    },
  };
}

function isNpm(commandName) {
  return path.basename(commandName).toLowerCase() === (process.platform === 'win32' ? 'npm.cmd' : 'npm');
}

function runVerification(root, args) {
  const options = parseVerifyArgs(args);
  const discovered = discoverVerification(root);
  const selected = options.selected.length === 0 ? discovered : discovered.filter(item => options.selected.includes(item.name));
  if (selected.length === 0) {
    console.log('Verification: unsupported (no declared supported commands found).');
    return 1;
  }
  console.log(`Verification plan (${options.dryRun ? 'dry-run' : 'run'}):`);
  for (const item of selected) console.log(`- ${item.display} (${item.source})`);
  if (options.dryRun) return 0;
  for (const item of selected) {
    const npmRuntime = isNpm(item.command) ? npmRuntimeEnvironment() : null;
    let result;
    try {
      result = spawnSync(item.command, item.args, {
        cwd: root,
        stdio: 'inherit',
        timeout: 120000,
        env: npmRuntime ? npmRuntime.environment : process.env,
      });
    } finally {
      if (npmRuntime) fs.rmSync(npmRuntime.runtime, { recursive: true, force: true });
    }
    if (result.error) {
      console.error(`Verification command unavailable: ${item.display}: ${result.error.message}`);
      return 1;
    }
    if (typeof result.status === 'number' && result.status !== 0) return result.status;
  }
  return 0;
}

module.exports = { discoverVerification, runVerification };
