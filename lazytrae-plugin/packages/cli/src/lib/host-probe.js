'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOSTS = new Set(['ide', 'work', 'cli']);
const OUTCOMES = new Set([
  'accessible', 'enterprise-only', 'region-blocked', 'coming-soon', 'absent',
  'malformed', 'timeout', 'changed-binary', 'unsupported',
]);
const REGIONS = new Set(['china', 'global', 'unknown']);
const EDITIONS = new Set(['enterprise', 'individual', 'unknown']);
const ALLOWED_ARGV = Object.freeze([Object.freeze(['--version']), Object.freeze(['--help'])]);
const CLEAN_ENVIRONMENT = Object.freeze({
  HOME: '/nonexistent',
  LANG: 'C',
  LC_ALL: 'C',
  PATH: '/usr/bin:/bin',
});
const MAX_OUTPUT_BYTES = 64 * 1024;
const TIMEOUT_MS = 3000;

function outcome(host, status, detail, extra = {}) {
  return {
    schema_version: 2,
    contract_version: '2.0.0',
    product: 'trae',
    host,
    status,
    detail,
    region: 'unknown',
    edition: 'unknown',
    binary: null,
    capabilities: [],
    observed_argv: [],
    host_readiness: 'pending',
    ...extra,
  };
}

function sha256(executable) {
  return crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
}

function parseFixture(fixturePath, host) {
  if (!fixturePath) return { kind: 'ok', fixture: null };
  if (!path.isAbsolute(fixturePath)) return { kind: 'error', detail: 'fixture path must be absolute' };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  } catch (error) {
    return { kind: 'error', detail: `fixture is malformed: ${error.message}` };
  }
  const baseValid = parsed && parsed.schema_version === 2 && parsed.contract_version === '2.0.0' && parsed.product === 'trae'
    && parsed.host === host && REGIONS.has(parsed.region) && EDITIONS.has(parsed.edition)
    && Array.isArray(parsed.capabilities);
  const capabilitiesValid = baseValid && parsed.capabilities.every(capability => (
    capability && typeof capability.name === 'string' && capability.name.length > 0
    && OUTCOMES.has(capability.status)
    && (capability.detail === undefined || typeof capability.detail === 'string')
  ));
  if (!capabilitiesValid) return { kind: 'error', detail: 'fixture does not match the host probe contract' };
  return { kind: 'ok', fixture: parsed };
}

function resolveExecutable(executable, host) {
  if (!executable) return { kind: 'error', status: 'absent', detail: 'no host executable was supplied' };
  if (!path.isAbsolute(executable)) {
    return { kind: 'error', status: 'unsupported', detail: 'executable path must be absolute; PATH lookup is disabled' };
  }
  let resolved;
  try {
    resolved = fs.realpathSync(executable);
    fs.accessSync(resolved, fs.constants.R_OK | fs.constants.X_OK);
    if (!fs.statSync(resolved).isFile()) throw new Error('not a regular file');
  } catch (error) {
    return { kind: 'error', status: 'absent', detail: `executable is unavailable: ${error.message}` };
  }
  const basename = path.basename(resolved).toLowerCase();
  if (basename === 'trae-agent' || basename === 'trae-agent.exe') {
    return { kind: 'error', status: 'unsupported', detail: 'open-source trae-agent is not a Trae product CLI' };
  }
  if (host === 'cli' && !/^trae(?:-?cli)?(?:[.-].*)?(?:\.exe)?$/i.test(path.basename(resolved))) {
    return { kind: 'error', status: 'unsupported', detail: 'binary name is not a closed-source Trae CLI identity' };
  }
  const prefix = fs.readFileSync(resolved).subarray(0, MAX_OUTPUT_BYTES).toString('utf8');
  if (prefix.startsWith('#!') && /(?:https?:\/\/|(?:^|[\s/])(curl|wget|nc|ssh)(?:\s|$))/m.test(prefix)) {
    return { kind: 'error', status: 'unsupported', detail: 'script-shaped network access is forbidden during probes' };
  }
  return { kind: 'ok', executable: resolved };
}

function runIntrospection(executable, argv) {
  const result = spawnSync(executable, argv, {
    encoding: 'utf8',
    env: CLEAN_ENVIRONMENT,
    input: '',
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error?.code === 'ETIMEDOUT') return { kind: 'error', status: 'timeout', detail: 'host probe timed out' };
  if (result.error?.code === 'ENOBUFS') return { kind: 'error', status: 'malformed', detail: 'host probe exceeded the output limit' };
  if (result.error) return { kind: 'error', status: 'malformed', detail: `host probe failed: ${result.error.message}` };
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) {
    return { kind: 'error', status: 'malformed', detail: 'host probe exceeded the output limit' };
  }
  if (result.status !== 0) return { kind: 'error', status: 'unsupported', detail: `host probe exited ${result.status}` };
  return { kind: 'ok', output: `${stdout}\n${stderr}`.trim() };
}

function classifyIdentity(host, output) {
  if (/\btrae-agent\b|open[\s-]*source/i.test(output)) return false;
  if (host === 'ide') return /^\s*trae\s+ide\b/im.test(output);
  if (host === 'work') return /^\s*trae\s+work\b/im.test(output);
  return /^\s*trae\s+cli\b/im.test(output);
}

function classifyRegion(output) {
  if (/\bregion\s*[:=]\s*(?:cn|china|mainland)\b/i.test(output)) return 'china';
  if (/\bregion\s*[:=]\s*(?:global|international)\b/i.test(output)) return 'global';
  return 'unknown';
}

function classifyEdition(output) {
  if (/\bedition\s*[:=]\s*enterprise\b/i.test(output)) return 'enterprise';
  if (/\bedition\s*[:=]\s*(?:individual|consumer|personal)\b/i.test(output)) return 'individual';
  return 'unknown';
}

function classifyVersion(output) {
  const match = /\bTrae(?:\s+(?:CLI|IDE|Work))?\s+v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i.exec(output);
  return match?.[1] || 'unknown';
}

function probeHost({ host, executable, expectedSha256, fixturePath }) {
  if (!HOSTS.has(host)) return outcome(host || 'unknown', 'unsupported', 'host must be ide, work, or cli');
  const fixtureResult = parseFixture(fixturePath, host);
  if (fixtureResult.kind === 'error') return outcome(host, 'malformed', fixtureResult.detail);
  const resolved = resolveExecutable(executable, host);
  if (resolved.kind === 'error') return outcome(host, resolved.status, resolved.detail);
  const fingerprint = sha256(resolved.executable);
  if (!expectedSha256) {
    return outcome(host, 'changed-binary', 'expected sha256 is required before executing a host binary', {
      binary: { path: resolved.executable, sha256: fingerprint },
    });
  }
  if (expectedSha256 && expectedSha256 !== fingerprint) {
    return outcome(host, 'changed-binary', 'binary fingerprint differs from the expected sha256', {
      binary: { path: resolved.executable, sha256: fingerprint },
    });
  }
  const outputs = [];
  for (const argv of ALLOWED_ARGV) {
    const execution = runIntrospection(resolved.executable, argv);
    if (execution.kind === 'error') {
      return outcome(host, execution.status, execution.detail, {
        binary: { path: resolved.executable, sha256: fingerprint },
        observed_argv: ALLOWED_ARGV.slice(0, outputs.length + 1),
      });
    }
    outputs.push(execution.output);
    if (sha256(resolved.executable) !== fingerprint) {
      return outcome(host, 'changed-binary', 'binary changed while the probe was running', {
        binary: { path: resolved.executable, sha256: fingerprint },
        observed_argv: ALLOWED_ARGV.slice(0, outputs.length),
      });
    }
  }
  const combined = outputs.join('\n');
  if (!classifyIdentity(host, combined)) {
    return outcome(host, 'unsupported', 'probe output does not identify the selected Trae host', {
      binary: { path: resolved.executable, sha256: fingerprint },
      observed_argv: ALLOWED_ARGV,
    });
  }
  const fixture = fixtureResult.fixture;
  const capabilities = (fixture?.capabilities || [{ name: 'host-introspection', status: 'accessible' }])
    .filter(capability => capability.name !== 'config-read');
  if (host === 'cli' && /(?:^|\n)\s*config\s+(?:get|list|show)(?:\s|$)/i.test(outputs[1])) {
    capabilities.push({ name: 'config-read', status: 'accessible' });
  }
  return outcome(host, 'accessible', 'read-only host introspection completed', {
    region: fixture?.region || classifyRegion(combined),
    edition: fixture?.edition || classifyEdition(combined),
    binary: { path: resolved.executable, sha256: fingerprint, version: classifyVersion(combined) },
    capabilities,
    observed_argv: ALLOWED_ARGV,
  });
}

module.exports = { ALLOWED_ARGV, OUTCOMES, probeHost };
