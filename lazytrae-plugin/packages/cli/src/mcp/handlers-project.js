'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tool = { name: 'lazytrae.project', description: 'Read the opt-in persistent project record or submit one typed project command through the same native CLI route. Never initializes a project; a not-initialized repository answers with a typed hint. Does not schedule, execute or verify work.',
  inputSchema: { type: 'object', required: ['action'], additionalProperties: false,
    properties: { action: { type: 'string', enum: ['read', 'command'] },
      command: { type: 'object' } } } };
function cliEntry() {
  const embedded = path.resolve(__dirname, '../index.js');
  const embeddedPackage = path.resolve(__dirname, '../../package.json');
  if (fs.existsSync(embeddedPackage) && JSON.parse(fs.readFileSync(embeddedPackage)).name === 'lazytrae-ai') return embedded;
  const manifest = require.resolve('lazytrae-ai/package.json');
  const info = JSON.parse(fs.readFileSync(manifest));
  const declared = require('../package.json').dependencies['lazytrae-ai'];
  const versionPinned = /^\d/.test(declared);
  if (info.name !== 'lazytrae-ai' || (versionPinned && info.version !== declared)) throw new Error('PROJECT_PACKAGE_MISMATCH');
  return path.join(path.dirname(manifest), 'src/index.js');
}
function handleProject(root, args) {
  if (!tool.inputSchema.properties.action.enum.includes(args.action) || Object.keys(args).some(key => !['action', 'command'].includes(key))) throw new Error('INVALID_PROJECT_ARGUMENTS');
  if (args.action === 'read') {
    if (args.command !== undefined) throw new Error('INVALID_PROJECT_ARGUMENTS');
    const child = spawnSync(process.execPath, [cliEntry(), 'project', 'read'], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    if (child.status !== 0) throw new Error('PROJECT_COMMAND_FAILED');
    return JSON.parse(child.stdout);
  }
  if (args.command === null || typeof args.command !== 'object' || Array.isArray(args.command)) throw new Error('INVALID_PROJECT_ARGUMENTS');
  const child = spawnSync(process.execPath, [cliEntry(), 'project', 'command', '--actor', 'mcp:lazytrae.project'], {
    cwd: root, encoding: 'utf8', input: JSON.stringify(args.command), timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (child.status !== 0) throw new Error('PROJECT_COMMAND_FAILED');
  return JSON.parse(child.stdout);
}
module.exports = { tool, handleProject };
