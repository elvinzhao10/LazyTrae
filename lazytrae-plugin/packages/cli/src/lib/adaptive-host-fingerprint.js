'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { stableDigest } = require('./adaptive-identity');
const { jsonMaterial } = require('./host-adapter-fingerprint');
const { inspectHostProfile } = require('./host-adapter-lifecycle');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const MARKETPLACE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function availableMaterial(value) {
  return { status: 'available', digest: stableDigest(value) };
}

function unavailableMaterial() {
  return { status: 'unavailable', digest: null };
}

function marketplaceMaterial(context, selectedHost) {
  const packageRecord = jsonMaterial(path.join(PACKAGE_ROOT, 'package.json'));
  const version = context.marketplace_version ?? packageRecord.value?.version;
  const route = context.marketplace_route ?? 'unavailable';
  if (packageRecord.status !== 'ready' || route !== 'unavailable'
    || typeof version !== 'string' || !MARKETPLACE_VERSION.test(version)) {
    return unavailableMaterial();
  }
  return availableMaterial({ host: selectedHost, route, version });
}

function runtimeFingerprints(repoRoot, context) {
  const selectedHost = context.selected_host || 'trae-ide';
  try {
    const profile = inspectHostProfile(repoRoot, selectedHost, {
      workSkillsDir: context.work_skills_dir,
    });
    const probe = jsonMaterial(path.join(
      repoRoot, '.lazytrae', 'state', 'host-probes', `${selectedHost}.json`,
    ));
    const probeAvailable = profile.probe.status === 'observed' && probe.status === 'ready';
    const sessions = jsonMaterial(path.join(repoRoot, '.lazytrae', 'state', 'sessions.json'));
    const worktree = fs.realpathSync.native(repoRoot);
    return {
      selected_host: selectedHost,
      runtime_fingerprints: {
        [selectedHost]: {
          host: selectedHost,
          profile: availableMaterial({
            contract_version: profile.contract_version,
            host_fingerprint: profile.host_fingerprint,
            support: profile.support,
          }),
          probe: probeAvailable ? availableMaterial(probe) : unavailableMaterial(),
          binary: probeAvailable ? availableMaterial(probe.value.binary) : unavailableMaterial(),
          session: availableMaterial(sessions),
          worktree: availableMaterial({ path: worktree }),
          mcp: availableMaterial(profile.mcp),
          generated_asset: availableMaterial(profile.generated_assets),
          marketplace: marketplaceMaterial(context, selectedHost),
        },
      },
    };
  } catch (_) {
    const unavailable = unavailableMaterial();
    return {
      selected_host: selectedHost,
      runtime_fingerprints: {
        [selectedHost]: {
          host: selectedHost,
          profile: unavailable,
          probe: unavailable,
          binary: unavailable,
          session: unavailable,
          worktree: unavailable,
          mcp: unavailable,
          generated_asset: unavailable,
          marketplace: unavailable,
        },
      },
    };
  }
}

module.exports = { runtimeFingerprints };
