#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'packages', 'cli', 'src', 'index.js');

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

function usage() {
  console.error('Usage: json-rpc-call.js --cwd <dir> (--list-tools | --method <name> --arguments <json>)');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) return;
  const cwd = valueAfter(args, '--cwd') || process.cwd();
  const listTools = args.includes('--list-tools');
  const method = valueAfter(args, '--method');
  if (!listTools && !method) usage();

  let toolArguments = {};
  const rawArguments = valueAfter(args, '--arguments');
  if (rawArguments) toolArguments = JSON.parse(rawArguments);

  const request = listTools
    ? { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    : { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: toolArguments } };

  const child = spawn(process.execPath, [CLI, 'mcp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout += chunk;
    const lines = stdout.trim().split('\n').filter(Boolean);
    const response = lines.find(line => {
      try {
        return JSON.parse(line).id === 1;
      } catch (_) {
        return false;
      }
    });
    if (!response) return;
    process.stdout.write(response + '\n');
    child.kill();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });
  child.on('exit', code => {
    if (!stdout.trim()) {
      if (stderr) process.stderr.write(stderr);
      process.exit(code || 1);
    }
  });
  child.stdin.write(JSON.stringify(request) + '\n');
}

main();
