#!/usr/bin/env node

const readline = require('readline');
const { detectRepoRoot } = require('./state-access');
const { TOOLS, HANDLERS } = require('./tools');
const {
  PROTOCOL_VERSION,
  SERVER_VERSION,
  receiptWriteDiagnostic,
  tryWriteInitializeReceipt,
} = require('./runtime/initialize-receipt');

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

function matchesSchema(value, schema) {
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'string') return typeof value === 'string';
  if (schema.type === 'integer') return Number.isSafeInteger(value);
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'array') return Array.isArray(value) && value.every(item => matchesSchema(item, schema.items || {}));
  if (schema.type !== 'object') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if ((schema.required || []).some(key => !Object.hasOwn(value, key))) return false;
  for (const [key, item] of Object.entries(value)) {
    const property = schema.properties && schema.properties[key];
    if (property && !matchesSchema(item, property)) return false;
    if (!property && schema.additionalProperties && !matchesSchema(item, schema.additionalProperties)) return false;
  }
  return true;
}

// ── Request handler ──

function handleRequest(req, repoRoot) {
  const { id, method, params } = req;

  try {
    if (method === 'initialize') {
      const receipt = tryWriteInitializeReceipt(repoRoot, params);
      if (!receipt.ok) process.stderr.write(`${receiptWriteDiagnostic(receipt.error)}\n`);
      return send(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'lazytrae-mcp', version: SERVER_VERSION },
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
      if (!params || typeof params !== 'object' || Array.isArray(params) || typeof params.name !== 'string') {
        return sendError(id, -32602, 'Invalid tools/call parameters');
      }
      const { name, arguments: args = {} } = params;
      const handler = HANDLERS[name];
      if (!handler) {
        return sendError(id, -32601, 'Unknown tool: ' + name);
      }
      const tool = TOOLS.find(candidate => candidate.name === name);
      if (!tool || !matchesSchema(args, tool.inputSchema)) {
        return sendError(id, -32602, 'Invalid tools/call parameters');
      }
      const result = handler(repoRoot, args);
      return send(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
    }

    if (method === 'ping') {
      return send(id, {});
    }

    sendError(id, -32601, 'Method not found: ' + method);
  } catch (_) {
    sendError(id, -32603, 'Internal error');
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

  process.stderr.write('LazyTrae MCP server v1.1.0 started\n');
}

// Run directly if executed as a script
if (require.main === module) {
  main();
}

module.exports = { main, handleRequest, matchesSchema, TOOLS, HANDLERS };
