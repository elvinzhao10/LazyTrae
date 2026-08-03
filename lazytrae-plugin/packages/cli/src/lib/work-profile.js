'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CLIENTS = new Set(['desktop', 'web', 'mobile']);
const EXECUTIONS = new Set(['local', 'cloud']);
const VALUE_FLAGS = new Set(['--client', '--execution', '--skills-dir', '--worktree', '--probe', '--output']);
const FORBIDDEN_FLAGS = new Set(['--upload', '--login', '--account', '--token', '--credential', '--api-key', '--password']);

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (FORBIDDEN_FLAGS.has(flag)) throw new Error('Upload, login, account, and credential actions are not supported.');
    if (!VALUE_FLAGS.has(flag)) throw new Error(`Unsupported Work profile option '${flag}'.`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
    if (options[flag]) throw new Error(`${flag} must be supplied exactly once.`);
    options[flag] = value;
    index++;
  }
  if (!options['--client'] || !options['--execution']) throw new Error('--client and --execution are required.');
  if (!CLIENTS.has(options['--client'])) throw new Error('--client must be desktop, web, or mobile.');
  if (!EXECUTIONS.has(options['--execution'])) throw new Error('--execution must be local or cloud.');
  return options;
}

function explicitDirectory(value, flag) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${flag} must be an explicit absolute path.`);
  const resolved = fs.realpathSync(value);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`${flag} must identify a directory.`);
  return resolved;
}

function verifyWorktree(options) {
  if (!options['--worktree']) return null;
  const worktree = explicitDirectory(options['--worktree'], '--worktree');
  if (!fs.existsSync(path.join(worktree, '.git'))) throw new Error('--worktree must identify an explicit Git worktree.');
  if (!options['--probe'] || !path.isAbsolute(options['--probe'])) {
    throw new Error('Local worktrees require an absolute --probe report path.');
  }
  const report = JSON.parse(fs.readFileSync(options['--probe'], 'utf8'));
  const verified = report.schema_version === 1 && report.product === 'trae'
    && report.host === 'work' && report.status === 'accessible'
    && report.capabilities?.some(capability => capability.name === 'local-worktree' && capability.status === 'accessible');
  if (!verified) throw new Error('Local worktree capability is not verified by the supplied probe.');
  return worktree;
}

function buildProfile(options) {
  const client = options['--client'];
  const execution = options['--execution'];
  const localDesktop = client === 'desktop' && execution === 'local';
  if (!localDesktop && (options['--skills-dir'] || options['--worktree'] || options['--probe'])) {
    throw new Error('Skills paths, probes, and worktrees are available only for the desktop/local profile.');
  }
  const skillsDir = localDesktop ? explicitDirectory(options['--skills-dir'], '--skills-dir') : null;
  const worktree = localDesktop ? verifyWorktree(options) : null;
  return {
    schema_version: 1,
    host: 'trae-work',
    client_context: client,
    execution_context: execution,
    native_mode: localDesktop ? 'invoke-documented' : 'descriptor-only',
    skills: localDesktop ? { route: 'local-copy', directory: skillsDir } : { route: 'descriptor-only', directory: null },
    bundle: localDesktop ? { mode: 'deterministic-artifact', upload_invoked: false } : { mode: 'descriptor-only', upload_invoked: false },
    worktree: worktree ? { mode: 'local-probe-verified', path: worktree } : { mode: localDesktop ? 'local-disabled' : 'unavailable', path: null },
    host_actions: { upload: false, login: false, account: false },
  };
}

function writeDescriptor(profile, outputPath) {
  const serialized = `${JSON.stringify(profile, null, 2)}\n`;
  if (!outputPath) return serialized;
  if (!path.isAbsolute(outputPath)) throw new Error('--output must be an absolute path.');
  const parent = path.dirname(outputPath);
  if (!fs.existsSync(parent)) throw new Error('Descriptor output directory must already exist.');
  if (fs.existsSync(outputPath) && fs.lstatSync(outputPath).isSymbolicLink()) throw new Error('Refusing to replace a symlinked descriptor output.');
  const temporary = path.join(parent, `.${path.basename(outputPath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(temporary, serialized, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, outputPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return serialized;
}

module.exports = { buildProfile, parseOptions, writeDescriptor };
