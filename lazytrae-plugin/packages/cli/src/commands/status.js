'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { inspectHostProfile, inspectHostProfiles } = require('../lib/host-adapter-lifecycle');
const { CURRENT_VERSION, MACHINE_STATUS_CONTRACT_VERSION } = require('../lib/version');

const EXPECTED_HOSTS = Object.freeze(['trae-cli', 'trae-ide', 'trae-work']);

function detectRepoRoot() {
  let current = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function statusInvalid() {
  const error = new Error('machine status does not match the v2 contract');
  error.code = 'STATUS_INVALID';
  return error;
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function validateStatusReport(report) {
  if (!exactKeys(report, ['schema_version', 'contract_version', 'product', 'version', 'profiles'])
    || report.schema_version !== 2 || report.contract_version !== MACHINE_STATUS_CONTRACT_VERSION
    || report.product !== 'LazyTrae' || report.version !== CURRENT_VERSION
    || !Array.isArray(report.profiles) || report.profiles.length < 1 || report.profiles.length > 3) throw statusInvalid();
  const hosts = report.profiles.map(profile => profile.host);
  if (new Set(hosts).size !== hosts.length || !hosts.every(host => EXPECTED_HOSTS.includes(host))) throw statusInvalid();
  for (const profile of report.profiles) {
    const required = [
      'host', 'host_label', 'client_context', 'execution_context', 'contract_version',
      'evidence_fingerprint', 'host_fingerprint', 'package_assets', 'generated_assets',
      'config', 'probe', 'discovery', 'registration', 'session', 'mcp', 'observation',
      'support', 'package_readiness', 'host_readiness',
    ];
    if (!exactKeys(profile, required) || profile.contract_version !== MACHINE_STATUS_CONTRACT_VERSION
      || !['ready', 'failed'].includes(profile.package_readiness)
      || !['pending', 'observed'].includes(profile.probe.status)
      || !['pending', 'observed'].includes(profile.discovery.status)
      || !['pending', 'observed'].includes(profile.host_readiness)) throw statusInvalid();
  }
  return report;
}

function buildStatusReport(repoRoot, host, options = {}) {
  const profiles = host ? [inspectHostProfile(repoRoot, host, options)] : inspectHostProfiles(repoRoot, options);
  return validateStatusReport({
    schema_version: 2,
    contract_version: MACHINE_STATUS_CONTRACT_VERSION,
    product: 'LazyTrae',
    version: CURRENT_VERSION,
    profiles,
  });
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: lazytrae status [--host ide|work|cli] [--skills-dir <absolute-path>] [--json]\n       lazytrae status --validate <absolute-json-path>');
    return 0;
  }
  const validateIndex = args.indexOf('--validate');
  if (validateIndex !== -1) {
    try {
      if (args.length !== 2 || validateIndex !== 0 || !path.isAbsolute(args[1])) throw statusInvalid();
      const report = validateStatusReport(JSON.parse(fs.readFileSync(args[1], 'utf8')));
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    } catch (_) {
      process.stderr.write(`${JSON.stringify({ error: 'STATUS_INVALID' })}\n`);
      return 1;
    }
  }
  const valueFlags = new Set(['--host', '--skills-dir']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') continue;
    if (!valueFlags.has(argument) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`unsupported status argument: ${argument}`);
    index += 1;
  }
  const hostIndex = args.indexOf('--host');
  const host = hostIndex === -1 ? null : args[hostIndex + 1];
  if (hostIndex !== -1 && !['ide', 'work', 'cli'].includes(host)) throw new Error('--host must be ide, work, or cli');
  const repoRoot = detectRepoRoot();
  const skillsIndex = args.indexOf('--skills-dir');
  const workSkillsDir = skillsIndex === -1 ? null : path.resolve(args[skillsIndex + 1]);
  const options = { workSkillsDir };
  const report = buildStatusReport(repoRoot, host, options);
  const profiles = report.profiles;
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else for (const profile of profiles) {
    console.log(`${profile.host}: PACKAGE ${profile.package_readiness.toUpperCase()}; HOST ${profile.host_readiness.toUpperCase()}`);
    console.log(`  assets=${profile.package_assets.status} generated=${profile.generated_assets.status} config=${profile.config.status} probe=${profile.probe.status} registration=${profile.registration.status} session=${profile.session.status} mcp=${profile.mcp.status} observation=${profile.observation.status} support=${profile.support}`);
  }
  return profiles.some(profile => profile.package_readiness === 'failed') ? 1 : 0;
}

module.exports = { buildStatusReport, run, validateStatusReport };
