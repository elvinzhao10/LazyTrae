const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  assertSafeRoot,
  listOwnedEntries,
  readReceipt,
  readToolingRoot,
  removeReceiptOwnedRoot,
  ownedRuntimeEnvironment,
  prepareOwnedRuntime,
  validateReceipt,
  writeReceipt,
} = require('../lib/tooling-root');
const { detectCapabilities, formatCapabilities, missingCapabilities, packageDependencies } = require('../lib/tooling-capabilities');
const { runVerification } = require('../lib/tooling-verify');
const {
  doctor: lspDoctor,
  formatStatus: formatLspStatus,
  install: lspInstall,
  parseLspArgs,
  status: lspStatus,
  uninstall: lspUninstall,
} = require('../lib/lsp-lifecycle');
const {
  disable: disableCodeGraph,
  enable: enableCodeGraph,
  formatStatus: formatCodeGraphStatus,
  initialize: initializeCodeGraph,
  install: installCodeGraph,
  parseCodeGraphArgs,
  status: codeGraphStatus,
  uninstall: uninstallCodeGraph,
} = require('../lib/codegraph-lifecycle');
const {
  REMOTE_CAPABILITIES,
  mergeMcpTemplate,
  readToolingState,
  setRemoteCapability,
} = require('../lib/tooling-state');

const TOOLING_PACKAGE = path.resolve(__dirname, '..', '..', 'tooling');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function printUsage() {
  console.log(`Usage: lazytrae tooling <command> --tooling-root <absolute-path>

Manage the LazyTrae-owned tooling root. The root must be explicit and empty for install.

Commands:
  detect      Report the lifecycle shell and registered capabilities
  install     Provision only missing compatible local search providers
  status      Report whether the receipt-owned root is ready
  doctor      Validate the receipt and owned files without mutation
  uninstall   Remove only unmodified receipt-owned files
  verify      Discover declared native checks; use --dry-run or --run <selection>
  lsp-status  Inspect a managed LSP provider without changing the target
  lsp-install Provision the matching managed LSP provider when missing
  lsp-doctor  Validate the matching LSP provider without mutation
  lsp-uninstall Remove only an unmodified receipt-owned LSP tooling root
  codegraph-status Inspect optional CodeGraph readiness without mutation
  codegraph-doctor Recommend CodeGraph only for large supported projects
  codegraph-install Provision the pinned CodeGraph package into an empty owned root
  codegraph-init Explicitly build or refresh a caller-managed CodeGraph index
  codegraph-enable Enable the managed MCP only after a caller-created .codegraph index exists
  codegraph-disable Disable the managed CodeGraph MCP without deleting an index
  codegraph-uninstall Remove only an unmodified receipt-owned CodeGraph tooling root
  enable <remote> Enable Context7 or grep_app in this initialized project
  disable <remote> Disable Context7 or grep_app in this initialized project
  remote-status Report optional remote capability state without network access
`);
}

function detectRepoRoot() {
  let directory = process.cwd();
  while (directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, '.git'))) return directory;
    directory = path.dirname(directory);
  }
  return process.cwd();
}

function remoteStatus(repoRoot) {
  const capabilities = readToolingState(repoRoot).capabilities;
  return Object.entries(REMOTE_CAPABILITIES).map(([name, remote]) => {
    const state = capabilities[name]?.enabled === true ? 'enabled' : 'disabled';
    return `${name}: ${state} (optional, offline; ${remote.description})`;
  }).join('\n');
}

function runRemote(command, args) {
  const credentialArgument = args.slice(1).some(argument => /(?:api[_-]?key|credential|secret|token|password)/i.test(argument));
  if (credentialArgument) throw new Error('credentials are not accepted or stored; configure them only in the MCP host environment.');
  if (args.length !== 1 || !Object.hasOwn(REMOTE_CAPABILITIES, args[0])) {
    throw new Error('remote capability must be context7 or grep_app.');
  }
  const repoRoot = detectRepoRoot();
  const statePath = path.join(repoRoot, '.lazytrae', 'state', 'tooling.json');
  const mcpPath = path.join(repoRoot, '.trae', 'mcp.json');
  if (!fs.existsSync(statePath) || !fs.existsSync(mcpPath)) {
    throw new Error('initialize this project before changing remote capability state.');
  }
  setRemoteCapability(repoRoot, args[0], command === 'enable');
  mergeMcpTemplate(repoRoot, path.join(__dirname, '..', '..', 'templates', 'mcp.json'), mcpPath);
  console.log(`${args[0]}: ${command}d`);
  return 0;
}

function runCodeGraph(command, args) {
  const { target, toolingRoot } = parseCodeGraphArgs(args);
  if (command === 'codegraph-install') {
    console.log(formatCodeGraphStatus(installCodeGraph(target, toolingRoot)));
    return 0;
  }
  if (command === 'codegraph-init') {
    console.log(formatCodeGraphStatus(initializeCodeGraph(target, toolingRoot)));
    return 0;
  }
  if (command === 'codegraph-uninstall') {
    uninstallCodeGraph(target, toolingRoot);
    mergeMcpTemplate(target, path.join(__dirname, '..', '..', 'templates', 'mcp.json'), path.join(target, '.trae', 'mcp.json'));
    console.log('STATE: removed');
    return 0;
  }
  if (command === 'codegraph-enable') {
    console.log(formatCodeGraphStatus(enableCodeGraph(target, toolingRoot)));
    mergeMcpTemplate(target, path.join(__dirname, '..', '..', 'templates', 'mcp.json'), path.join(target, '.trae', 'mcp.json'));
    return 0;
  }
  if (command === 'codegraph-disable') {
    disableCodeGraph(target);
    mergeMcpTemplate(target, path.join(__dirname, '..', '..', 'templates', 'mcp.json'), path.join(target, '.trae', 'mcp.json'));
    console.log('STATE: disabled');
    return 0;
  }
  console.log(formatCodeGraphStatus(codeGraphStatus(target, toolingRoot)));
  return 0;
}

function runLsp(command, args) {
  const { target, toolingRoot } = parseLspArgs(args);
  if (command === 'lsp-install') {
    console.log(formatLspStatus(lspInstall(target, toolingRoot)));
    return 0;
  }
  if (command === 'lsp-uninstall') {
    console.log(formatLspStatus(lspUninstall(target, toolingRoot)));
    return 0;
  }
  const state = command === 'lsp-doctor' ? lspDoctor(target, toolingRoot) : lspStatus(target, toolingRoot);
  console.log(formatLspStatus(state));
  return 0;
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
  if (fs.existsSync(root)) assertSafeRoot(root, true);
  const missing = missingCapabilities(root);
  if (missing.length === 0) {
    console.log('No provisioning required: compatible host providers are ready.');
    return 0;
  }
  assertSafeRoot(root, true);
  prepareOwnedRuntime(root);
  const dependencies = packageDependencies(missing);
  const manifest = JSON.parse(fs.readFileSync(path.join(TOOLING_PACKAGE, 'package.json'), 'utf8'));
  manifest.optionalDependencies = dependencies;
  const lock = JSON.parse(fs.readFileSync(path.join(TOOLING_PACKAGE, 'package-lock.json'), 'utf8'));
  lock.packages[''].optionalDependencies = dependencies;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  const result = spawnSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    env: ownedRuntimeEnvironment(root),
  });
  if (result.error) throw new Error(`tooling npm ci failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`tooling npm ci failed: ${result.stderr || result.stdout}`.trim());
  writeReceipt(root, listOwnedEntries(root), missing);
  console.log(`Tooling installed in ${root}.`);
  return 0;
}

function runCommand(args) {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    return args.length === 0 ? 1 : 0;
  }
  const command = args[0];
  if (!['detect', 'install', 'status', 'doctor', 'uninstall', 'verify', 'lsp-status', 'lsp-install', 'lsp-doctor', 'lsp-uninstall', 'codegraph-status', 'codegraph-doctor', 'codegraph-install', 'codegraph-init', 'codegraph-enable', 'codegraph-disable', 'codegraph-uninstall', 'enable', 'disable', 'remote-status'].includes(command)) {
    throw new Error(`unknown tooling command: ${command}`);
  }
  if (command === 'enable' || command === 'disable') return runRemote(command, args.slice(1));
  if (command === 'remote-status') {
    if (args.length !== 1) throw new Error('remote-status does not accept arguments.');
    console.log(remoteStatus(detectRepoRoot()));
    return 0;
  }
  if (command.startsWith('lsp-')) return runLsp(command, args.slice(1));
  if (command.startsWith('codegraph-')) return runCodeGraph(command, args.slice(1));
  if (command === 'verify') return runVerification(process.cwd(), args.slice(1));
  const root = readToolingRoot(args);
  if (command === 'install') return install(root);
  if (command === 'uninstall') {
    removeReceiptOwnedRoot(root);
    console.log(`Tooling root removed: ${root}`);
    return 0;
  }
  if (command === 'detect') {
    const state = checkRoot(root);
    const capabilities = detectCapabilities(root);
    console.log(`Tooling lifecycle shell: ${state.ready ? 'ready' : 'missing'} (${state.detail})`);
    console.log(formatCapabilities(capabilities));
    return capabilities.every(capability => capability.state === 'ready') ? 0 : 1;
  }
  const state = checkRoot(root);
  const capabilities = detectCapabilities(root);
  console.log(`Tooling root: ${state.ready ? 'ready' : 'missing'} (${state.detail})`);
  console.log(formatCapabilities(capabilities));
  return capabilities.every(capability => capability.state === 'ready') ? 0 : 1;
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
