'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  LifecycleError,
  LAUNCHER,
  acquireLock,
  bootstrapRelease,
  offboardProduct,
  parseOfficialSource,
  prepareProductRoot,
  productPaths,
  readActive,
  recoveryReport,
} = require('../lib/lifecycle');
const { receiptFor } = require('../lib/lifecycle/receipt');
const PRODUCT = 'LazyTrae';
const SUBCOMMANDS = new Set(['onboard', 'update', 'status', 'offboard']);
const VALUE_FLAGS = new Set(['--install-root', '--project', '--source', '--confirm-revision']);
const BOOLEAN_FLAGS = new Set(['--json', '--yes']);
function usage() {
  console.log(`Usage: lazytrae lifecycle <subcommand> [options]
Durable package lifecycle, separate from project init/sync/uninstall.
Subcommands:
  onboard   Install a verified official release into the durable root
  update    Verify and promote an official release; retain one rollback
  status    Report package readiness separately from host readiness
  offboard  Print a removal plan; --yes removes exact receipt-owned state
Common: --install-root <absolute-path> --project <absolute-path> --json
Onboard/update: --source <canonical-official-url>
Update: --confirm-revision <full-sha>
Offboard: --yes
`);
}
function invalid(message) {
  return new LifecycleError('INVALID_ARGUMENT', message);
}
function parseArgs(args) {
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  const command = args[0];
  if (!SUBCOMMANDS.has(command)) throw invalid('expected lifecycle onboard, update, status, or offboard');
  const values = {};
  const booleans = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index];
    if (BOOLEAN_FLAGS.has(flag)) {
      if (booleans.has(flag)) throw invalid(`${flag} may be provided only once`);
      booleans.add(flag);
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) throw invalid(`unknown lifecycle option: ${flag}`);
    if (Object.hasOwn(values, flag)) throw invalid(`${flag} may be provided only once`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw invalid(`${flag} requires a value`);
    values[flag] = value;
    index += 1;
  }
  if (!values['--project']) throw invalid('--project is required');
  if ((command === 'onboard' || command === 'update') !== Object.hasOwn(values, '--source')) {
    throw invalid('--source is required for onboard/update and forbidden otherwise');
  }
  if (command !== 'update' && Object.hasOwn(values, '--confirm-revision')) {
    throw invalid('--confirm-revision is valid only for update');
  }
  if (command !== 'offboard' && booleans.has('--yes')) throw invalid('--yes is valid only for offboard');
  return {
    command,
    confirmRevision: values['--confirm-revision'],
    installRoot: values['--install-root'],
    json: booleans.has('--json'),
    projectRoot: resolveProject(values['--project']),
    sourceUrl: values['--source'],
    yes: booleans.has('--yes'),
  };
}
function resolveProject(value) {
  if (!path.isAbsolute(value) || path.parse(path.resolve(value)).root === path.resolve(value)) {
    throw invalid('--project must be a non-root absolute path');
  }
  let stat;
  try {
    stat = fs.lstatSync(value);
  } catch (error) {
    throw new LifecycleError('INVALID_PROJECT', '--project must identify an existing directory', error);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw invalid('--project must identify a real directory');
  return fs.realpathSync(value);
}
function envelope(parsed, paths, status) {
  return {
    schema_version: 1,
    product: PRODUCT,
    command: parsed.command,
    status,
    package_readiness: { status: 'absent' },
    host_readiness: { status: 'pending' },
    install_root: paths.installRoot,
    project_root: parsed.projectRoot,
  };
}
function inspect(parsed, paths) {
  const report = envelope(parsed, paths, 'absent');
  if (!fs.existsSync(paths.productRoot)) return report;
  try {
    const issues = recoveryReport(paths).issues;
    const active = readActive(paths);
    if (!active) issues.push({ code: 'ACTIVE_ABSENT', path: paths.active });
    let verified = null;
    if (active) {
      try {
        verified = receiptFor(paths, active.active_release);
      } catch (error) {
        issues.push({ code: error.code || 'INVALID_BUNDLE', path: paths.releases });
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
      return {
        ...report,
        status: 'blocked',
        package_readiness: { status: 'blocked', issues },
      };
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
function install(parsed) {
  parseOfficialSource(parsed.sourceUrl, PRODUCT);
  let paths;
  if (parsed.command === 'update') {
    paths = productPaths({ installRoot: parsed.installRoot, product: PRODUCT });
    if (!fs.existsSync(paths.active)) throw new LifecycleError('NOT_INSTALLED', 'run lifecycle onboard before update');
  }
  paths = prepareProductRoot({ installRoot: parsed.installRoot, product: PRODUCT });
  const lock = acquireLock(paths, parsed.command);
  let result;
  try {
    result = bootstrapRelease(paths, {
      sourceUrl: parsed.sourceUrl,
      confirmRevision: parsed.confirmRevision,
    });
  } finally {
    lock.release();
  }
  const report = {
    ...envelope(parsed, paths, result.status),
    release_id: result.release_id,
    commit_sha: result.commit_sha,
    package_readiness: { status: 'ready' },
    host_readiness: { status: 'pending' },
  };
  if (result.required_confirmation) report.required_confirmation = result.required_confirmation;
  if (result.status === 'revision_confirmation_required') {
    report.action = 'rerun lifecycle update with --confirm-revision <full-sha>';
    return { code: 2, report };
  }
  return { code: 0, report };
}
function offboard(parsed, paths) {
  const report = envelope(parsed, paths, 'absent');
  if (!fs.existsSync(paths.productRoot)) return { code: 0, report };
  if (!parsed.yes) {
    return {
      code: 2,
      report: {
        ...report,
        status: 'confirmation_required',
        package_readiness: { status: 'ready' },
        action: `remove exact receipt-owned LazyTrae state at ${paths.productRoot}; preserve project and host settings; rerun with --yes`,
      },
    };
  }
  offboardProduct(paths, 'offboard-product');
  return { code: 0, report: { ...report, status: 'removed' } };
}
function print(report, json) {
  if (json) {
    console.log(JSON.stringify(report));
    return;
  }
  console.log(`LazyTrae lifecycle ${report.command}: ${report.status}`);
  console.log(`PACKAGE READINESS: ${report.package_readiness.status.toUpperCase()}`);
  console.log(`HOST READINESS: ${report.host_readiness.status.toUpperCase()}`);
  if (report.action) console.log(`Action: ${report.action}`);
}
function run(args) {
  const json = args.includes('--json');
  try {
    const parsed = parseArgs(args);
    if (parsed.help) {
      usage();
      return 0;
    }
    const paths = productPaths({ installRoot: parsed.installRoot, product: PRODUCT });
    let outcome;
    if (parsed.command === 'status') {
      const report = inspect(parsed, paths);
      outcome = { code: report.status === 'blocked' ? 1 : 0, report };
    } else if (parsed.command === 'offboard') {
      outcome = offboard(parsed, paths);
    } else {
      outcome = install(parsed);
    }
    print(outcome.report, parsed.json);
    return outcome.code;
  } catch (error) {
    const report = {
      schema_version: 1,
      product: PRODUCT,
      command: args[0] || null,
      status: 'error',
      error: { code: error.code || 'LIFECYCLE_FAILED', message: error.message },
    };
    if (json) console.log(JSON.stringify(report));
    else console.error(`lazytrae lifecycle: ${report.error.code}: ${report.error.message}`);
    return 1;
  }
}
module.exports = { parseArgs, run };
