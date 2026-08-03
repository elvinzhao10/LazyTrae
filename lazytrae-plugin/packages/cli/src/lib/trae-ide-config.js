'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { mergeBytes, safeDestination, safeFile } = require('./asset-ownership-core');
const { transactionalWrite } = require('./asset-ownership');

const EVENTS = Object.freeze([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification',
]);
const RECEIPT_PATH = '.lazytrae/trae-ide-config-receipt.v1.json';

function verifiedHookProbe(probePath) {
  if (!probePath) return false;
  if (!path.isAbsolute(probePath)) throw new Error('--ide-probe must be an absolute path');
  const probe = JSON.parse(fs.readFileSync(probePath, 'utf8'));
  const capability = Array.isArray(probe.capabilities)
    ? probe.capabilities.find((entry) => entry?.name === 'ide-hook-configuration-v1')
    : null;
  return probe.schema_version === 1 && probe.product === 'trae' && probe.host === 'ide'
    && probe.status === 'accessible' && probe.host_readiness === 'pending'
    && capability?.status === 'accessible' && capability.schema_version === 1
    && capability.execution === 'sandbox'
    && JSON.stringify(capability.events) === JSON.stringify(EVENTS)
    && JSON.stringify(capability.scopes) === JSON.stringify(['project', 'global']);
}

function readReceipt(repoRoot) {
  const target = safeDestination(repoRoot, RECEIPT_PATH);
  const file = safeFile(target, 'TRAE IDE configuration receipt');
  if (!file) return { target, entries: {} };
  const receipt = JSON.parse(file.bytes.toString('utf8'));
  if (receipt?.schema_version !== 1 || !receipt.entries || typeof receipt.entries !== 'object'
    || Array.isArray(receipt.entries)) throw new Error('TRAE IDE configuration receipt is malformed');
  return { target, entries: receipt.entries };
}

function hookConfiguration(templatePath) {
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  return {
    ...template,
    hooks: {
      ...template.hooks,
      Notification: [{
        type: 'command',
        command: 'bash "${PROJECT_DIR}/.trae/hooks/notification.sh"',
        timeout: 10,
      }],
    },
    lazytrae: {
      ...template.lazytrae,
      notification: 'Advisory status ingestion only; never completion authority.',
    },
  };
}

function targetFor(repoRoot, targetPath, label) {
  if (!targetPath) return null;
  if (!path.isAbsolute(targetPath)) throw new Error(`${label} must be an absolute path`);
  if (targetPath === path.join(repoRoot, '.trae', 'hooks.json')) {
    return safeDestination(repoRoot, '.trae/hooks.json');
  }
  const parent = path.dirname(targetPath);
  if (fs.realpathSync.native(parent) !== parent) throw new Error(`${label} has a linked parent`);
  safeFile(targetPath, label);
  return targetPath;
}

function planVerifiedHookConfiguration(options) {
  if (!verifiedHookProbe(options.probePath)) return { status: 'unsupported', written: [] };
  const repoRoot = path.resolve(options.repoRoot);
  const projectPath = path.join(repoRoot, '.trae', 'hooks.json');
  const targets = [
    {
      id: 'project',
      path: targetFor(repoRoot, projectPath, 'project hooks configuration'),
      receiptPath: '.trae/hooks.json',
    },
  ];
  if (options.globalHooksPath) {
    targets.push({
      id: 'global',
      path: targetFor(repoRoot, options.globalHooksPath, 'global hooks configuration'),
      receiptPath: options.globalHooksPath,
    });
  }
  const incoming = Buffer.from(`${JSON.stringify(hookConfiguration(options.templatePath), null, 2)}\n`);
  const receipt = readReceipt(repoRoot);
  const planned = targets.map((target) => {
    const file = safeFile(target.path, `${target.id} hooks configuration`);
    const caller = file?.bytes || Buffer.from('{}\n');
    const prior = receipt.entries[target.id];
    if (prior && prior.path !== target.receiptPath) throw new Error(`${target.id} hooks configuration path changed`);
    const base = prior ? Buffer.from(prior.base_base64, 'base64') : Buffer.from('{}\n');
    return {
      target: target.path,
      bytes: mergeBytes('json', base, caller, incoming),
      mode: file?.mode || 0o600,
      id: target.id,
      receiptPath: target.receiptPath,
    };
  });
  const nextEntries = Object.fromEntries(planned.map((item) => [item.id, {
    path: item.receiptPath,
    base_base64: incoming.toString('base64'),
  }]));
  const receiptBytes = Buffer.from(`${JSON.stringify({ schema_version: 1, entries: nextEntries }, null, 2)}\n`);
  return { status: 'verified', planned, receipt, receiptBytes };
}

function preflightVerifiedHookConfiguration(options) {
  return planVerifiedHookConfiguration(options).status;
}

function installVerifiedHookConfiguration(options) {
  const plan = planVerifiedHookConfiguration(options);
  if (plan.status === 'unsupported') return { status: 'unsupported', written: [] };
  transactionalWrite([
    ...plan.planned,
    { target: plan.receipt.target, bytes: plan.receiptBytes, mode: 0o600 },
  ], fs.renameSync);
  return { status: 'updated', written: plan.planned.map((item) => item.target) };
}

module.exports = {
  EVENTS, RECEIPT_PATH, installVerifiedHookConfiguration, preflightVerifiedHookConfiguration, verifiedHookProbe,
};
