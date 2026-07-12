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

function ensureToolingState(repoRoot) {
  const target = toolingStatePath(repoRoot);
  if (fs.existsSync(target)) return false;
  writeRepoFile(repoRoot, target, JSON.stringify(defaultToolingState(), null, 2) + '\n');
  return true;
}

function mergeMcpTemplate(repoRoot, templatePath, destinationPath) {
  const existingFile = readExistingFile(repoRoot, destinationPath, 'utf8');
  if (!existingFile.exists) {
    writeRepoFile(repoRoot, destinationPath, fs.readFileSync(templatePath, 'utf8'));
    return true;
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const existing = JSON.parse(existingFile.content);
  const templateServers = template.mcpServers || {};
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
  mergeMcpTemplate,
  toolingStatePath,
};
