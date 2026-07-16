#!/usr/bin/env node

const readline = require('readline');
const { detectRepoRoot } = require('./state-access');
const { TOOLS, HANDLERS } = require('./tools');

// ── JSON-RPC helpers ──

function send(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  }) + '\n');
}

function isRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.jsonrpc !== '2.0' || typeof value.method !== 'string' || value.method.startsWith('rpc.')) return false;
  if (Object.hasOwn(value, 'params') && (!value.params || typeof value.params !== 'object')) return false;
  return !Object.hasOwn(value, 'id') || value.id === null || typeof value.id === 'string' || typeof value.id === 'number';
}

// ── Request handler ──

function handleRequest(req, repoRoot) {
  const { id, method, params } = req;

  try {
    if (method === 'initialize') {
      return send(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'lazytrae-mcp', version: '0.18.0' },
      });
    }

    if (method === 'notifications/initialized') {
      // MCP lifecycle: no response needed for notifications
      return;
    }

    if (method === 'tools/list') {
      return send(id, { tools: TOOLS });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      const handler = HANDLERS[name];
      if (!handler) {
        return sendError(id, -32601, 'Unknown tool: ' + name);
      }
      const result = handler(repoRoot, args || {});
      return send(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
    }

    if (method === 'ping') {
      return send(id, {});
    }

    sendError(id, -32601, 'Method not found: ' + method);
  } catch (e) {
    sendError(id, -32603, 'Internal error: ' + e.message);
  }
}

// ── Main: stdio JSON-RPC loop ──

function main() {
  const repoRoot = detectRepoRoot();

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', (line) => {
    let req;
    try {
      req = JSON.parse(line);
    } catch (_) {
      sendError(null, -32700, 'Parse error');
      return;
    }

    if (!isRequest(req)) {
      sendError(null, -32600, 'Invalid Request');
      return;
    }

    handleRequest(req, repoRoot);
  });

  rl.on('close', () => {
    process.exit(0);
  });

  process.stderr.write('LazyTrae MCP server v0.18.0 started\n');
}

// Run directly if executed as a script
if (require.main === module) {
  main();
}

module.exports = { main, handleRequest, TOOLS, HANDLERS };
