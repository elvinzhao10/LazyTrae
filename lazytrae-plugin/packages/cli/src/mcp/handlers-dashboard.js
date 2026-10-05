'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tool = { name: 'lazytrae.dashboard', description: 'Manage the owned browser dashboard or read native task context. Does not execute tasks.',
  inputSchema: { type: 'object', required: ['action'], additionalProperties: false,
    properties: { action: { type: 'string', enum: ['start', 'open', 'status', 'stop', 'snapshot', 'context'] },
      task_id: { type: 'string' }, port: { type: 'integer' } } } };
function cliEntry() {
  const embedded = path.resolve(__dirname, '../index.js');
  const embeddedPackage = path.resolve(__dirname, '../../package.json');
  if (fs.existsSync(embeddedPackage) && JSON.parse(fs.readFileSync(embeddedPackage)).name === 'lazytrae-ai') return embedded;
  const manifest = require.resolve('lazytrae-ai/package.json');
  const info = JSON.parse(fs.readFileSync(manifest));
  const declared = require('../package.json').dependencies['lazytrae-ai'];
  const versionPinned = /^\d/.test(declared);
  if (info.name !== 'lazytrae-ai' || (versionPinned && info.version !== declared)) throw new Error('DASHBOARD_PACKAGE_MISMATCH');
  return path.join(path.dirname(manifest), 'src/index.js');
}
function handleDashboard(root, args) {
  if (!tool.inputSchema.properties.action.enum.includes(args.action) || Object.keys(args).some(key => !['action', 'task_id', 'port'].includes(key))) throw new Error('INVALID_DASHBOARD_ARGUMENTS');
  const argv = ['dashboard', args.action];
  if (args.action === 'context') {
    if (typeof args.task_id !== 'string' || args.task_id.startsWith('-') || args.port !== undefined) throw new Error('INVALID_DASHBOARD_ARGUMENTS');
    argv.push(args.task_id);
  } else if (args.task_id !== undefined) throw new Error('INVALID_DASHBOARD_ARGUMENTS');
  if (args.port !== undefined) {
    if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535 || !['start', 'open', 'status', 'stop'].includes(args.action)) throw new Error('INVALID_DASHBOARD_ARGUMENTS');
    argv.push('--port', String(args.port));
  }
  const child = spawnSync(process.execPath, [cliEntry(), ...argv], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (child.status !== 0) throw new Error('DASHBOARD_COMMAND_FAILED');
  return JSON.parse(child.stdout);
}
module.exports = { tool, handleDashboard };
