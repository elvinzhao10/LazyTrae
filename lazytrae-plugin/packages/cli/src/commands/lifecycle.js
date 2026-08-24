'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  LifecycleError,
  acquireLock,
  bootstrapProduct,
  offboardProduct,
  parseOfficialSource,
  pruneRollback,
  productPaths,
  rollbackRelease,
} = require('../lib/lifecycle');
const LIFECYCLE_HELP = require('./lifecycle-help');
const { createStatus } = require('./lifecycle-status');
const PRODUCT = 'LazyTrae';
const SUBCOMMANDS = new Set([
  'onboard',
  'update',
  'status',
  'rollback',
  'prune',
  'offboard',
  'recover-bootstrap-lock',
]);
const VALUE_FLAGS = new Set(['--install-root', '--project', '--source', '--confirm-revision']);
const BOOLEAN_FLAGS = new Set(['--json', '--yes']);
function usage() {
  console.log(LIFECYCLE_HELP);
}
function invalid(message) {
  return new LifecycleError('INVALID_ARGUMENT', message);
}
function parseArgs(args) {
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  const command = args[0];
  if (!SUBCOMMANDS.has(command)) {
    throw invalid('expected lifecycle onboard, update, status, rollback, prune, offboard, or recover-bootstrap-lock');
  }
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
  if (!['rollback', 'prune', 'offboard', 'recover-bootstrap-lock'].includes(command) && booleans.has('--yes')) {
    throw invalid('--yes is valid only for rollback, prune, offboard, or recover-bootstrap-lock');
  }
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
    schema_version: 2,
    product: PRODUCT,
    command: parsed.command,
    status,
    package_readiness: { status: 'absent' },
    host_readiness: { status: 'pending' },
    install_root: paths.installRoot,
    project_root: parsed.projectRoot,
  };
}
const { inspect, recoverBootstrap } = createStatus({ envelope });
function install(parsed) {
  parseOfficialSource(parsed.sourceUrl, PRODUCT);
  const paths = productPaths({ installRoot: parsed.installRoot, product: PRODUCT });
  if (parsed.command === 'update') {
    if (!fs.existsSync(paths.active)) throw new LifecycleError('NOT_INSTALLED', 'run lifecycle onboard before update');
  }
  const result = bootstrapProduct(paths, parsed.command, {
    sourceUrl: parsed.sourceUrl,
    confirmRevision: parsed.confirmRevision,
  });
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
function confirmedOperation(parsed, paths, operation) {
  if (!fs.existsSync(paths.active)) throw new LifecycleError('NOT_INSTALLED', 'no active LazyTrae release is installed');
  if (!parsed.yes) {
    return {
      code: 2,
      report: {
        ...envelope(parsed, paths, 'confirmation_required'),
        package_readiness: { status: 'ready' },
        action: `${operation} the exact receipt-owned LazyTrae release state; rerun with --yes`,
      },
    };
  }
  const lock = acquireLock(paths, operation);
  try {
    if (operation === 'rollback') {
      const active = rollbackRelease(paths);
      return {
        code: 0,
        report: {
          ...envelope(parsed, paths, 'rolled_back'),
          release_id: active.active_release,
          package_readiness: { status: 'ready' },
        },
      };
    }
    pruneRollback(paths, 'prune-rollback');
    return {
      code: 0,
      report: {
        ...envelope(parsed, paths, 'pruned'),
        package_readiness: { status: 'ready' },
      },
    };
  } finally {
    lock.release();
  }
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
function failureEnvelope(args, error) {
  const installIndex = args.indexOf('--install-root');
  const projectIndex = args.indexOf('--project');
  const rawInstallRoot = installIndex >= 0 ? args[installIndex + 1] : undefined;
  const rawProjectRoot = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
  const installRoot = rawInstallRoot && path.isAbsolute(rawInstallRoot)
    && path.parse(path.resolve(rawInstallRoot)).root !== path.resolve(rawInstallRoot)
    ? path.resolve(rawInstallRoot) : null;
  return {
    schema_version: 2,
    product: PRODUCT,
    command: args[0] || null,
    status: 'error',
    package_readiness: {
      status: 'blocked',
      issues: [{ code: error.code || 'LIFECYCLE_FAILED', path: installRoot ? path.join(installRoot, PRODUCT) : null }],
    },
    host_readiness: { status: 'pending' },
    install_root: installRoot,
    project_root: rawProjectRoot || null,
    ...(error.preservation ? { preservation: error.preservation } : {}),
    error: { code: error.code || 'LIFECYCLE_FAILED', message: error.message },
  };
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
    } else if (parsed.command === 'recover-bootstrap-lock') {
      outcome = recoverBootstrap(parsed, paths);
    } else if (parsed.command === 'rollback' || parsed.command === 'prune') {
      outcome = confirmedOperation(parsed, paths, parsed.command);
    } else if (parsed.command === 'offboard') {
      outcome = offboard(parsed, paths);
    } else {
      outcome = install(parsed);
    }
    print(outcome.report, parsed.json);
    return outcome.code;
  } catch (error) {
    const report = failureEnvelope(args, error);
    if (json) console.log(JSON.stringify(report));
    else console.error(`lazytrae lifecycle: ${report.error.code}: ${report.error.message}`);
    return 1;
  }
}
module.exports = { parseArgs, run };
