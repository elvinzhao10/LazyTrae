const fs = require('fs');
const path = require('path');
const {
  listOwnedEntries,
  ownedRuntimeEnvironment,
  prepareOwnedRuntime,
  readReceipt,
  removeReceiptOwnedRoot,
  validateReceipt,
  writeReceipt,
} = require('./tooling-root');
const { createStagingRoot, discardStagingRoot, promoteStagingRoot } = require('./tooling-staging');
const { runOwnedCommand } = require('./owned-process-runner');
const { PROVIDERS, assertTarget, providerFor, readinessProviderFor } = require('./lsp-provider');

const SOURCE_ROOT = path.resolve(__dirname, '..', '..', 'tooling', 'lsp');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function parseLspArgs(args) {
  const targetIndex = args.indexOf('--target');
  const rootIndex = args.indexOf('--tooling-root');
  if (targetIndex === -1 || !args[targetIndex + 1]) throw new Error('--target requires an absolute path.');
  if (rootIndex === -1 || !args[rootIndex + 1]) throw new Error('--tooling-root requires an absolute path.');
  if (args.length !== 4 || targetIndex % 2 !== 0 || rootIndex % 2 !== 0) throw new Error('LSP commands accept only --target and --tooling-root.');
  const toolingRoot = path.resolve(args[rootIndex + 1]);
  if (!path.isAbsolute(args[rootIndex + 1]) || path.parse(toolingRoot).root === toolingRoot) {
    throw new Error('--tooling-root must be a non-root absolute path.');
  }
  return { target: assertTarget(args[targetIndex + 1]), toolingRoot };
}

function ownedCapability(language) {
  return `lsp-${language}`;
}

function ownsRoot(root, language) {
  try {
    const receipt = readReceipt(root);
    validateReceipt(root, receipt);
    return Array.isArray(receipt.provisioned_capabilities) && receipt.provisioned_capabilities.includes(ownedCapability(language));
  } catch (_) {
    return false;
  }
}

function status(target, toolingRoot) {
  return providerFor(target, toolingRoot, ownsRoot);
}

function readinessStatus(target, toolingRoot) {
  return readinessProviderFor(target, toolingRoot, ownsRoot);
}

function formatStatus(result) {
  const lines = [`STATE: ${result.state}`];
  if (result.language) lines.push(`LANGUAGE: ${result.language}`);
  if (result.source && result.command) lines.push(`PROVIDER: ${result.source} ${result.command}`);
  if (result.reason) lines.push(`REASON: ${result.reason}`);
  return lines.join('\n');
}

function install(target, toolingRoot, options = {}) {
  const initial = status(target, toolingRoot);
  if (initial.state !== 'missing') return initial;
  const provider = PROVIDERS[initial.language];
  if (!provider) throw new Error('no supported provider can be provisioned for this target.');
  const staging = createStagingRoot(toolingRoot);
  const source = path.join(SOURCE_ROOT, provider.packageDirectory);
  const destination = path.join(staging, 'lsp', provider.packageDirectory);
  try {
    prepareOwnedRuntime(staging);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.cpSync(source, destination, { recursive: true, dereference: false });
    const result = runOwnedCommand(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: destination,
      encoding: 'utf8',
      timeout: options.timeout ?? 120000,
      env: ownedRuntimeEnvironment(staging),
      timeoutCode: 'LSP_INSTALL_TIMEOUT',
    });
    if (result.error || result.status !== 0) {
      throw new Error(`LSP provider install failed: ${(result.error && result.error.message) || result.stderr || result.stdout}`.trim());
    }
    writeReceipt(staging, listOwnedEntries(staging), [ownedCapability(initial.language)], toolingRoot);
    promoteStagingRoot(staging, toolingRoot);
  } catch (error) {
    try {
      discardStagingRoot(staging);
    } catch (cleanupError) {
      throw new Error(`${error.message}; staging cleanup refused: ${cleanupError.message}`);
    }
    throw new Error(`${error.message}; caller tooling root preserved and no receipt was created.`);
  }
  const installed = status(target, toolingRoot);
  if (installed.state !== 'ready' || installed.source !== 'owned') throw new Error('LSP provisioning did not produce a verified owned provider.');
  return installed;
}

function doctor(target, toolingRoot) {
  return status(target, toolingRoot);
}

function uninstall(_target, toolingRoot) {
  let receipt;
  try {
    receipt = readReceipt(toolingRoot);
    validateReceipt(toolingRoot, receipt);
  } catch (_) {
    throw new Error('refusing LSP uninstall: root is not an unmodified receipt-owned LSP installation.');
  }
  const capabilities = receipt.provisioned_capabilities.filter(capability => capability.startsWith('lsp-'));
  if (capabilities.length !== 1) throw new Error('refusing LSP uninstall: root does not own exactly one LSP provider.');
  const language = capabilities[0].slice('lsp-'.length);
  removeReceiptOwnedRoot(toolingRoot);
  return { state: 'removed', language };
}

module.exports = { doctor, formatStatus, install, parseLspArgs, readinessStatus, status, uninstall };
