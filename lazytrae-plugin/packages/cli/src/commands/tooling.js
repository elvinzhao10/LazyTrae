const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  assertSafeRoot,
  listOwnedEntries,
  readReceipt,
  readToolingRoot,
  removeReceiptOwnedRoot,
  validateReceipt,
  writeReceipt,
} = require('../lib/tooling-root');

const TOOLING_PACKAGE = path.resolve(__dirname, '..', '..', 'tooling');
const PACKAGE_FILES = ['package.json', 'package-lock.json'];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function printUsage() {
  console.log(`Usage: lazytrae tooling <command> --tooling-root <absolute-path>

Manage the LazyTrae-owned tooling root. The root must be explicit and empty for install.

Commands:
  detect      Report the lifecycle shell and registered capabilities
  install     Copy the locked package and run npm ci in the owned root
  status      Report whether the receipt-owned root is ready
  doctor      Validate the receipt and owned files without mutation
  uninstall   Remove only unmodified receipt-owned files
`);
}

function checkRoot(root) {
  try {
    assertSafeRoot(root, false);
    const receipt = readReceipt(root);
    validateReceipt(root, receipt);
    return { ready: true, detail: `${receipt.files.length} receipt-owned file(s)` };
  } catch (error) {
    return { ready: false, detail: error.message };
  }
}

function install(root) {
  assertSafeRoot(root, true);
  for (const file of PACKAGE_FILES) {
    fs.copyFileSync(path.join(TOOLING_PACKAGE, file), path.join(root, file));
  }
  const result = spawnSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  if (result.error) throw new Error(`tooling npm ci failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`tooling npm ci failed: ${result.stderr || result.stdout}`.trim());
  writeReceipt(root, listOwnedEntries(root));
  console.log(`Tooling installed in ${root}.`);
  return 0;
}

function runCommand(args) {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    return args.length === 0 ? 1 : 0;
  }
  const command = args[0];
  if (!['detect', 'install', 'status', 'doctor', 'uninstall'].includes(command)) {
    throw new Error(`unknown tooling command: ${command}`);
  }
  const root = readToolingRoot(args);
  if (command === 'install') return install(root);
  if (command === 'uninstall') {
    removeReceiptOwnedRoot(root);
    console.log(`Tooling root removed: ${root}`);
    return 0;
  }
  if (command === 'detect') {
    const state = checkRoot(root);
    console.log(`Tooling lifecycle shell: ${state.ready ? 'ready' : 'missing'} (${state.detail})`);
    console.log('Registered capabilities: none in this lifecycle shell.');
    return state.ready ? 0 : 1;
  }
  const state = checkRoot(root);
  console.log(`Tooling root: ${state.ready ? 'ready' : 'missing'} (${state.detail})`);
  return state.ready ? 0 : 1;
}

function run(args) {
  try {
    return runCommand(args);
  } catch (error) {
    console.error(`lazytrae tooling: ${error.message}`);
    return 1;
  }
}

module.exports = { run };
