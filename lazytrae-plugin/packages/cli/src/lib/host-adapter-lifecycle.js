'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { checkProjectAssets } = require('./project-assets');
const { checkCandidate } = require('./traecli-candidate');
const {
  canonicalDigest, fileMaterial, generatedMaterial, jsonMaterial, packageMaterial, sha256,
} = require('./host-adapter-fingerprint');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'host-adapter-manifest.v2.json');
const HOST_IDS = Object.freeze({ cli: 'trae-cli', ide: 'trae-ide', work: 'trae-work' });
const HOST_CONTEXTS = Object.freeze({
  'trae-cli': Object.freeze({ host_label: 'TRAE CLI', client_context: 'terminal', execution_context: 'local' }),
  'trae-ide': Object.freeze({ host_label: 'TRAE IDE', client_context: 'desktop', execution_context: 'local' }),
  'trae-work': Object.freeze({ host_label: 'TRAE Work', client_context: 'unspecified', execution_context: 'unspecified' }),
});

function readManifest() {
  const bytes = fs.readFileSync(MANIFEST_PATH);
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest?.schema_version !== 2 || manifest.contract_version !== '2.0.0'
    || manifest.owner !== 'lazytrae-host-adapters'
    || !Array.isArray(manifest.hosts) || manifest.hosts.length !== 3) {
    throw new Error('host adapter manifest is malformed');
  }
  const hosts = manifest.hosts.map(route => route.host);
  if (new Set(hosts).size !== 3 || !Object.values(HOST_IDS).every(host => hosts.includes(host))) {
    throw new Error('host adapter manifest must declare each Trae host exactly once');
  }
  return { manifest, sha256: sha256(bytes) };
}

function routeFor(host) {
  const id = HOST_IDS[host] || host;
  const loaded = readManifest();
  const route = loaded.manifest.hosts.find(candidate => candidate.host === id);
  if (!route) throw new Error(`unsupported host adapter: ${host}`);
  return { route, manifestSha256: loaded.sha256 };
}

function existingPathStatus(target) {
  try {
    const stat = fs.lstatSync(target);
    return !stat.isSymbolicLink() && (stat.isFile() || stat.isDirectory()) ? 'ready' : 'conflict';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    return 'conflict';
  }
}

function generatedStatus(repoRoot, route) {
  if (route.host === 'trae-cli') {
    const issues = checkCandidate(repoRoot).issues;
    const status = issues.length === 0 ? 'ready'
      : issues.some(issue => /modified|stale|orphan|owner/i.test(issue)) ? 'conflict' : 'missing';
    return { status, issues };
  }
  if (route.host === 'trae-ide') {
    const issues = checkProjectAssets(repoRoot).issues;
    const status = issues.length === 0 ? 'ready'
      : issues.some(issue => /modified|stale|orphan|owner/i.test(issue)) ? 'conflict' : 'missing';
    return { status, issues };
  }
  return { status: 'missing', issues: ['global Work skills require an explicit skills directory'] };
}

function pendingEvidence(status = 'pending', detail = 'no current host evidence') {
  return { status, detail };
}

function inspectProbe(repoRoot, route) {
  const target = path.join(repoRoot, '.lazytrae', 'state', 'host-probes', `${route.host}.json`);
  const material = jsonMaterial(target);
  const value = material.value;
  let stat;
  try { stat = fs.statSync(target); } catch (_) { return { valid: false, material }; }
  const expectedHost = route.host.slice('trae-'.length);
  const keys = ['binary', 'capabilities', 'contract_version', 'detail', 'edition', 'host', 'host_readiness', 'observed_argv', 'product', 'region', 'schema_version', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== 2 || value.contract_version !== '2.0.0'
    || value.product !== 'trae' || value.host !== expectedHost
    || value.status !== 'accessible' || Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000
    || value.host_readiness !== 'pending' || typeof value.detail !== 'string'
    || !['china', 'global', 'unknown'].includes(value.region)
    || !['enterprise', 'individual', 'unknown'].includes(value.edition)
    || !Array.isArray(value.capabilities) || !Array.isArray(value.observed_argv)
    || !value.binary || !/^[0-9a-f]{64}$/.test(value.binary.sha256)) return { valid: false, material };
  return { valid: true, value, sha256: sha256(fs.readFileSync(target)), material };
}

function exactKeys(value, expected) {
  return value && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
}

function inspectObservation(repoRoot, route, evidenceFingerprint, probe) {
  const target = path.join(repoRoot, '.lazytrae', 'state', 'host-observations', `${route.host}.json`);
  const material = jsonMaterial(target);
  const value = material.value;
  const exact = ['contract_version', 'evidence_fingerprint', 'expires_at', 'host', 'mcp', 'observation', 'probe_sha256', 'registration', 'schema_version', 'session_id'];
  if (!exactKeys(value, exact) || value.schema_version !== 2 || value.contract_version !== '2.0.0'
    || value.host !== route.host || value.evidence_fingerprint !== evidenceFingerprint
    || value.probe_sha256 !== (probe.valid ? probe.sha256 : null)
    || typeof value.session_id !== 'string'
    || Date.parse(value.expires_at) <= Date.now()
    || !exactKeys(value.registration, ['status']) || !['observed', 'pending'].includes(value.registration.status)
    || !exactKeys(value.mcp, ['status']) || !['connected', 'registered', 'pending'].includes(value.mcp.status)
    || !exactKeys(value.observation, ['status']) || !['observed', 'pending'].includes(value.observation.status)) {
    return { valid: false, material };
  }
  return { valid: true, value, material };
}

function workGeneratedStatus(skillsDir) {
  if (!skillsDir) return { status: 'missing', issues: ['global Work skills require an explicit skills directory'] };
  const source = path.join(PACKAGE_ROOT, 'templates', 'skills');
  const names = fs.readdirSync(source, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('lazy-'))
    .map(entry => entry.name);
  const missing = [];
  const conflicts = [];
  for (const name of names) {
    const sourceFile = path.join(source, name, 'SKILL.md');
    const target = path.join(skillsDir, name, 'SKILL.md');
    try {
      if (!fs.readFileSync(sourceFile).equals(fs.readFileSync(target))) conflicts.push(name);
    } catch (_) { missing.push(name); }
  }
  const status = conflicts.length > 0 ? 'conflict' : missing.length > 0 ? 'missing' : 'ready';
  return { status, issues: [...conflicts.map(name => `modified output ${name}`), ...missing.map(name => `missing output ${name}`)] };
}

function inspectHostProfile(repoRoot, host, options = {}) {
  const { route, manifestSha256 } = routeFor(host);
  const generatedAssets = route.host === 'trae-work'
    ? workGeneratedStatus(options.workSkillsDir) : generatedStatus(repoRoot, route);
  const configStatus = route.config_path
    ? existingPathStatus(path.join(repoRoot, route.config_path))
    : 'pending';
  const packages = packageMaterial(PACKAGE_ROOT, route);
  const generated = generatedMaterial(repoRoot, route, generatedAssets, options.workSkillsDir);
  const config = route.config_path ? fileMaterial(path.join(repoRoot, route.config_path)) : { status: 'pending', sha256: canonicalDigest('manual') };
  const sessionMaterial = jsonMaterial(path.join(repoRoot, '.lazytrae', 'state', 'sessions.json'));
  const sessionState = sessionMaterial.value;
  const probeReport = inspectProbe(repoRoot, route);
  const evidenceFingerprint = canonicalDigest({ manifestSha256, route, packages, generated, config, probe: probeReport.material, session: sessionMaterial });
  const observationReport = inspectObservation(repoRoot, route, evidenceFingerprint, probeReport);
  const hostFingerprint = canonicalDigest({ evidenceFingerprint, observation: observationReport.material });
  const observation = observationReport.valid ? observationReport.value : null;
  const probe = probeReport.valid ? pendingEvidence('observed', 'bounded fingerprinted host probe') : pendingEvidence();
  const sessionCurrent = observation && sessionState?.current_session_id === observation.session_id;
  const registration = observation?.registration.status === 'observed'
    ? pendingEvidence('observed', 'current host registration observation') : pendingEvidence();
  const session = sessionCurrent ? pendingEvidence('observed', 'current session matches host observation') : pendingEvidence();
  const mcp = observation?.mcp?.status === 'connected' && sessionCurrent
    ? pendingEvidence('observed', 'current session observed an MCP connection') : pendingEvidence();
  const observed = observation?.observation?.status === 'observed' && sessionCurrent
    ? pendingEvidence('observed', 'fresh fingerprint-bound host observation') : pendingEvidence();
  const missingPackagePaths = packages.paths.filter(item => item.status !== 'ready').map(item => item.relative);
  const packageAssets = {
    status: missingPackagePaths.length === 0 ? 'ready' : 'missing',
    manifest_sha256: manifestSha256,
    content_sha256: packages.sha256,
    missing: missingPackagePaths,
  };
  const packageReadiness = packageAssets.status === 'ready'
    && !['conflict'].includes(generatedAssets.status) && configStatus !== 'conflict' ? 'ready' : 'failed';
  const hostReadiness = packageReadiness === 'ready' && generatedAssets.status === 'ready'
    && [probe, registration, session, mcp, observed].every(item => item.status === 'observed')
    ? 'observed' : 'pending';
  const context = HOST_CONTEXTS[route.host];
  return {
    host: route.host,
    host_label: context.host_label,
    client_context: context.client_context,
    execution_context: context.execution_context,
    contract_version: '2.0.0',
    evidence_fingerprint: evidenceFingerprint,
    host_fingerprint: hostFingerprint,
    package_assets: packageAssets,
    generated_assets: generatedAssets,
    config: pendingEvidence(configStatus, route.config_path || 'manual host configuration'),
    probe,
    discovery: probe.status === 'observed'
      ? pendingEvidence('observed', 'bounded native host discovery')
      : pendingEvidence('pending', 'generated package assets are inert and do not prove host discovery'),
    registration,
    session,
    mcp,
    observation: observed,
    support: route.support,
    package_readiness: packageReadiness,
    host_readiness: hostReadiness,
  };
}

function inspectHostProfiles(repoRoot, options = {}) {
  return readManifest().manifest.hosts
    .map(route => inspectHostProfile(repoRoot, route.host, options))
    .sort((left, right) => left.host.localeCompare(right.host));
}

module.exports = { HOST_CONTEXTS, HOST_IDS, inspectHostProfile, inspectHostProfiles, readManifest, routeFor };
