'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { inspectHostProfile, inspectHostProfiles } = require('../lib/host-adapter-lifecycle');
const { canonicalDigest } = require('../lib/host-adapter-fingerprint');
const { CURRENT_VERSION, MACHINE_STATUS_CONTRACT_VERSION } = require('../lib/version');

const HOST_IDENTITIES = Object.freeze({
  'trae-cli': Object.freeze(['TRAE CLI', 'terminal', 'local']),
  'trae-ide': Object.freeze(['TRAE IDE', 'desktop', 'local']),
  'trae-work': Object.freeze(['TRAE Work', 'unspecified', 'unspecified']),
});
const EXPECTED_HOSTS = Object.freeze(Object.keys(HOST_IDENTITIES));

function detectRepoRoot() {
  let current = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function statusInvalid(code = 'STATUS_INVALID') {
  const error = new Error('machine status does not match the v2 contract');
  error.code = code;
  return error;
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function validCapabilityMatrix(matrix, host) {
  const statuses = new Set(['host-executed', 'host-observed', 'descriptor-only', 'unavailable']);
  const matrixKeys = ['schema_version', 'contract_version', 'host', 'client', 'execution', 'descriptor_sha256', 'capabilities', 'matrix_sha256'];
  if (!exactKeys(matrix, matrixKeys) || matrix.schema_version !== 1 || matrix.contract_version !== '1.2.0'
    || matrix.host !== host || !/^[0-9a-f]{64}$/.test(matrix.descriptor_sha256)
    || !Array.isArray(matrix.capabilities) || matrix.capabilities.length === 0) return false;
  const { matrix_sha256: matrixSha256, ...material } = matrix;
  if (matrixSha256 !== canonicalDigest(material)
    || new Set(matrix.capabilities.map(item => item?.capability_id)).size !== matrix.capabilities.length) return false;
  return matrix.capabilities.every(item => exactKeys(item, ['capability_id', 'status', 'evidence'])
    && typeof item.capability_id === 'string' && statuses.has(item.status)
    && exactKeys(item.evidence, ['fingerprint', 'observed_at', 'expires_at', 'session_id', 'build_version', 'build_sha256'])
    && /^[0-9a-f]{64}$/.test(item.evidence.fingerprint)
    && ['observed_at', 'expires_at', 'session_id', 'build_version'].every(key => item.evidence[key] === null || typeof item.evidence[key] === 'string')
    && (item.evidence.build_sha256 === null || /^[0-9a-f]{64}$/.test(item.evidence.build_sha256)));
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
      'evidence_fingerprint', 'host_fingerprint', 'capability_matrix', 'package_assets', 'generated_assets',
      'config', 'probe', 'discovery', 'registration', 'session', 'mcp', 'observation',
      'support', 'package_readiness', 'host_readiness',
    ];
    const identity = HOST_IDENTITIES[profile.host];
    if (!exactKeys(profile, required) || profile.contract_version !== MACHINE_STATUS_CONTRACT_VERSION
      || !identity || profile.host_label !== identity[0]
      || profile.client_context !== identity[1] || profile.execution_context !== identity[2]
      || !validCapabilityMatrix(profile.capability_matrix, profile.host)
      || !['ready', 'failed'].includes(profile.package_readiness)
      || !['pending', 'observed'].includes(profile.probe.status)
      || !['pending', 'observed'].includes(profile.discovery.status)
      || !['pending', 'observed'].includes(profile.host_readiness)) throw statusInvalid();
    const { host_fingerprint: hostFingerprint, ...profileMaterial } = profile;
    if (hostFingerprint !== canonicalDigest(profileMaterial)) throw statusInvalid('STATUS_HOST_FINGERPRINT_STALE');
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
    console.log('Usage: lazytrae status [--host ide|work|cli] [--skills-dir <absolute-path>] [--capability-probe <absolute-json>] [--capability-receipt <absolute-json>] [--client desktop|web|mobile] [--execution local|cloud] [--session-id <id>] [--now <RFC3339>] [--json]\n       lazytrae status --validate <absolute-json-path>');
    return 0;
  }
  const validateIndex = args.indexOf('--validate');
  if (validateIndex !== -1) {
    try {
      if (args.length !== 2 || validateIndex !== 0 || !path.isAbsolute(args[1])) throw statusInvalid();
      const report = validateStatusReport(JSON.parse(fs.readFileSync(args[1], 'utf8')));
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    } catch (error) {
      const code = error?.code === 'STATUS_HOST_FINGERPRINT_STALE' ? error.code : 'STATUS_INVALID';
      process.stderr.write(`${JSON.stringify({ error: code })}\n`);
      return 1;
    }
  }
  const valueFlags = new Set([
    '--host', '--skills-dir', '--capability-probe', '--capability-receipt',
    '--client', '--execution', '--session-id', '--now',
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') continue;
    if (!valueFlags.has(argument) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`unsupported status argument: ${argument}`);
    index += 1;
  }
  const hostIndex = args.indexOf('--host');
  const host = hostIndex === -1 ? null : args[hostIndex + 1];
  if (hostIndex !== -1 && !['ide', 'work', 'cli'].includes(host)) throw new Error('--host must be ide, work, or cli');
  const capabilityFlags = ['--capability-probe', '--capability-receipt', '--client', '--execution', '--session-id', '--now'];
  if (!host && capabilityFlags.some(flag => args.includes(flag))) throw new Error('capability evidence requires --host');
  const repoRoot = detectRepoRoot();
  const skillsIndex = args.indexOf('--skills-dir');
  const workSkillsDir = skillsIndex === -1 ? null : path.resolve(args[skillsIndex + 1]);
  function value(flag) {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  }
  for (const flag of ['--capability-probe', '--capability-receipt']) {
    if (value(flag) && !path.isAbsolute(value(flag))) throw new Error(`${flag} must be an absolute path`);
  }
  const capabilityClient = value('--client');
  const capabilityExecution = value('--execution');
  if ((capabilityClient || capabilityExecution) && host !== 'work') throw new Error('--client and --execution require --host work');
  const options = {
    workSkillsDir,
    capabilityClient,
    capabilityExecution,
    capabilityProbePath: value('--capability-probe'),
    capabilityReceiptPath: value('--capability-receipt'),
    capabilitySessionId: value('--session-id'),
    capabilityNow: value('--now'),
  };
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
