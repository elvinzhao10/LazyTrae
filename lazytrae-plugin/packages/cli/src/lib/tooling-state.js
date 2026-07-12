const fs = require('fs');
const path = require('path');
const { writeRepoFile } = require('./templates');
const { readExistingFile } = require('./safe-write');

const TOOLING_STATE_PATH = path.join('.lazytrae', 'state', 'tooling.json');

function defaultToolingState() {
  return {
    schema_version: 1,
    capabilities: {},
  };
}

function toolingStatePath(repoRoot) {
  return path.join(repoRoot, TOOLING_STATE_PATH);
}

function readToolingState(repoRoot) {
  const target = toolingStatePath(repoRoot);
  if (!fs.existsSync(target)) return defaultToolingState();
  const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.capabilities || typeof parsed.capabilities !== 'object' || Array.isArray(parsed.capabilities)) {
    throw new Error('tooling state must contain an object capabilities map');
  }
  return parsed;
}

function ensureToolingState(repoRoot) {
  const target = toolingStatePath(repoRoot);
  if (fs.existsSync(target)) return false;
  writeRepoFile(repoRoot, target, JSON.stringify(defaultToolingState(), null, 2) + '\n');
  return true;
}

function setCodeGraphCapability(repoRoot, capability) {
  const state = readToolingState(repoRoot);
  state.capabilities.codegraph = capability;
  writeRepoFile(repoRoot, toolingStatePath(repoRoot), JSON.stringify(state, null, 2) + '\n');
}

function managedCodeGraphServer(repoRoot) {
  const capability = readToolingState(repoRoot).capabilities.codegraph;
  if (!capability || capability.enabled !== true || typeof capability.tooling_root !== 'string') return null;
  return {
    command: 'lazytrae',
    args: ['codegraph', '--target', repoRoot, '--tooling-root', capability.tooling_root],
    required: false,
    description: 'Optional receipt-owned CodeGraph MCP bridge. Enable only after you create the project-local .codegraph index.',
  };
}

function mergeMcpTemplate(repoRoot, templatePath, destinationPath) {
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const templateServers = { ...(template.mcpServers || {}) };
  const codeGraph = managedCodeGraphServer(repoRoot);
  if (codeGraph) templateServers.codegraph = codeGraph;
  const existingFile = readExistingFile(repoRoot, destinationPath, 'utf8');
  if (!existingFile.exists) {
    const content = codeGraph
      ? JSON.stringify({ ...template, mcpServers: templateServers }, null, 2) + '\n'
      : fs.readFileSync(templatePath, 'utf8');
    writeRepoFile(repoRoot, destinationPath, content);
    return true;
  }

  const existing = JSON.parse(existingFile.content);
  const existingServers = existing.mcpServers || {};
  const userServers = Object.fromEntries(
    Object.entries(existingServers).filter(([name]) => !Object.hasOwn(templateServers, name)),
  );
  const merged = {
    ...existing,
    ...template,
    mcpServers: {
      ...templateServers,
      ...userServers,
    },
  };
  const next = JSON.stringify(merged, null, 2) + '\n';
  if (next === existingFile.content) return false;
  writeRepoFile(repoRoot, destinationPath, next);
  return true;
}

module.exports = {
  TOOLING_STATE_PATH,
  defaultToolingState,
  ensureToolingState,
  managedCodeGraphServer,
  mergeMcpTemplate,
  readToolingState,
  setCodeGraphCapability,
  toolingStatePath,
};
