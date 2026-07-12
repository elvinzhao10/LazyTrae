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

// ── Request handler ──

function handleRequest(req, repoRoot) {
  const { id, method, params } = req;

  try {
    if (method === 'initialize') {
      return send(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'lazytrae-mcp', version: '0.15.0-alpha.3' },
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

  let buffer = '';

  rl.on('line', (line) => {
    buffer += line;
    try {
      const req = JSON.parse(buffer);
      buffer = '';
      handleRequest(req, repoRoot);
    } catch (_) {
      // Incomplete JSON — wait for more lines
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Log startup info to stderr (not stdout, which is the JSON-RPC transport)
  process.stderr.write('LazyTrae MCP server v0.15.0-alpha.3 started (repo: ' + repoRoot + ')\n');
}

// Run directly if executed as a script
if (require.main === module) {
  main();
}

module.exports = { main, handleRequest, TOOLS, HANDLERS };
