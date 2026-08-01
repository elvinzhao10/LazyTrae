'use strict';

const fs = require('node:fs');
const {
  LAUNCHER,
  readActive,
  recoverBootstrapLock,
  recoveryReport,
} = require('../lib/lifecycle');
const { verifiedActiveReceipt } = require('../lib/lifecycle/receipt');

function createStatus({ envelope }) {
  function inspect(parsed, paths) {
    const report = envelope(parsed, paths, 'absent');
    const recovery = recoveryReport(paths);
    if (!fs.existsSync(paths.productRoot)) {
      const bootstrapIssues = recovery.issues.filter((issue) => issue.code === 'BOOTSTRAP_LOCK_PRESENT');
      return bootstrapIssues.length === 0 ? report : {
        ...report,
        status: 'blocked',
        package_readiness: { status: 'blocked', issues: bootstrapIssues },
      };
    }
    try {
      const issues = recovery.issues;
      const active = readActive(paths);
      if (!active) issues.push({ code: 'ACTIVE_ABSENT', path: paths.active });
      let verified = null;
      if (active) {
        try {
          verified = verifiedActiveReceipt(paths, active);
        } catch (error) {
          issues.push({ code: error.code || 'INVALID_BUNDLE', path: error.code === 'STALE_RUNTIME' ? active.runtime_path : paths.releases });
        }
      }
      try {
        const launcher = fs.lstatSync(paths.launcher);
        if (!launcher.isFile() || launcher.isSymbolicLink() || launcher.nlink !== 1
          || !fs.readFileSync(paths.launcher).equals(Buffer.from(LAUNCHER))) {
          issues.push({ code: 'MODIFIED_LAUNCHER', path: paths.launcher });
        }
      } catch (_) {
        issues.push({ code: 'INVALID_LAUNCHER', path: paths.launcher });
      }
      if (issues.length > 0) {
        return { ...report, status: 'blocked', package_readiness: { status: 'blocked', issues } };
      }
      return {
        ...report,
        status: 'ready',
        release_id: active.active_release,
        commit_sha: verified.receipt.commit_sha,
        package_readiness: {
          status: 'ready',
          bundle: {
            release_id: active.active_release,
            version: verified.receipt.manifest.version,
            launcher: paths.launcher,
          },
        },
        host_readiness: { status: verified.receipt.host_evidence.status },
      };
    } catch (error) {
      return {
        ...report,
        status: 'blocked',
        package_readiness: {
          status: 'blocked',
          issues: [{ code: error.code || 'INVALID_STATE', path: paths.productRoot }],
        },
      };
    }
  }

  function recoverBootstrap(parsed, paths) {
    if (!parsed.yes) {
      return {
        code: 2,
        report: {
          ...envelope(parsed, paths, 'confirmation_required'),
          package_readiness: { status: 'blocked' },
          action: 'recover only a verified stale sibling bootstrap lock; rerun with --yes',
        },
      };
    }
    recoverBootstrapLock(paths, 'recover-stale-bootstrap-lock');
    const current = inspect(parsed, paths);
    return {
      code: 0,
      report: {
        ...envelope(parsed, paths, 'bootstrap_lock_recovered'),
        package_readiness: current.package_readiness,
        host_readiness: current.host_readiness,
      },
    };
  }

  return { inspect, recoverBootstrap };
}

module.exports = { createStatus };
