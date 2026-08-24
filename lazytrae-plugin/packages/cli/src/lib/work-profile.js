'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ALLOWED_ARGV, probeHost } = require('./host-probe');

const CLIENTS = new Set(['desktop', 'web', 'mobile']);
const EXECUTIONS = new Set(['local', 'cloud']);
const VALUE_FLAGS = new Set(['--client', '--execution', '--skills-dir', '--worktree', '--executable', '--expected-sha256', '--output']);
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
  if (options['--expected-sha256'] && !/^[0-9a-f]{64}$/i.test(options['--expected-sha256'])) {
    throw new Error('--expected-sha256 must be a 64-character hexadecimal digest.');
  }
  return options;
}

function explicitDirectory(value, flag) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${flag} must be an explicit absolute path.`);
  const resolved = fs.realpathSync(value);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`${flag} must identify a directory.`);
  return resolved;
}

function verifyWorktree(options) {
  if (!options['--worktree']) {
    if (options['--executable'] || options['--expected-sha256']) {
      throw new Error('Work probe arguments require an explicit --worktree.');
    }
    return null;
  }
  if (fs.lstatSync(options['--worktree']).isSymbolicLink()) throw new Error('--worktree must not be a symlink.');
  const worktree = explicitDirectory(options['--worktree'], '--worktree');
  const git = spawnSync('git', [
    '-C', worktree, 'rev-parse', '--is-inside-work-tree', '--show-toplevel',
    '--git-common-dir', '--verify', 'HEAD',
  ], {
    encoding: 'utf8',
    env: {
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_OPTIONAL_LOCKS: '0',
      HOME: '/nonexistent',
      LANG: 'C',
      LC_ALL: 'C',
      PATH: '/usr/bin:/bin',
    },
    input: '',
    maxBuffer: 64 * 1024,
    timeout: 5_000,
  });
  const lines = (git.stdout || '').trim().split('\n');
  if (git.error || git.status !== 0 || lines.length !== 4 || lines[0] !== 'true') {
    throw new Error('--worktree must identify a real Git worktree with a current HEAD.');
  }
  const topLevel = fs.realpathSync(lines[1]);
  const commonDir = fs.realpathSync(path.isAbsolute(lines[2]) ? lines[2] : path.resolve(worktree, lines[2]));
  if (topLevel !== worktree || !/^[0-9a-f]{40}$/.test(lines[3])) {
    throw new Error('--worktree must be the explicit top level of a real Git worktree.');
  }
  const report = probeHost({
    host: 'work',
    executable: options['--executable'],
    expectedSha256: options['--expected-sha256']?.toLowerCase(),
  });
  if (report.status !== 'accessible' || !report.binary
    || JSON.stringify(report.observed_argv) !== JSON.stringify(ALLOWED_ARGV)) {
    throw new Error(`Bounded Work probe refused the local worktree: ${report.detail}`);
  }
  return {
    worktree: { mode: 'local-probe-verified', path: worktree, head_sha: lines[3], git_common_dir: commonDir },
    probe: { mode: 'bounded-host-introspection', binary_sha256: report.binary.sha256, observed_argv: report.observed_argv },
  };
}

function buildProfile(options) {
  const client = options['--client'];
  const execution = options['--execution'];
  const localDesktop = client === 'desktop' && execution === 'local';
  if (!localDesktop && (options['--skills-dir'] || options['--worktree'] || options['--executable'] || options['--expected-sha256'])) {
    throw new Error('Skills paths, probes, and worktrees are available only for the desktop/local profile.');
  }
  const skillsDir = localDesktop ? explicitDirectory(options['--skills-dir'], '--skills-dir') : null;
  const verification = localDesktop ? verifyWorktree(options) : null;
  return {
    schema_version: 1,
    host: 'trae-work',
    client_context: client,
    execution_context: execution,
    native_mode: localDesktop ? 'invoke-documented' : 'descriptor-only',
    skills: localDesktop ? { route: 'local-copy', directory: skillsDir } : { route: 'descriptor-only', directory: null },
    bundle: localDesktop ? { mode: 'deterministic-artifact', upload_invoked: false } : { mode: 'descriptor-only', upload_invoked: false },
    worktree: verification ? verification.worktree : { mode: localDesktop ? 'local-disabled' : 'unavailable', path: null },
    probe: verification ? verification.probe : null,
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
