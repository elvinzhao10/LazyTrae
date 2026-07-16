const readline = require('readline');
const { advertised, execute, tool } = require('../lib/lsp-bridge');
const { formatStatus, parseLspArgs, status } = require('../lib/lsp-lifecycle');
const { ownedRuntimeEnvironment } = require('../lib/tooling-root');

function json(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function result(id, value) {
  json({ jsonrpc: '2.0', id, result: value });
}

function error(id, code, message) {
  json({ jsonrpc: '2.0', id, error: { code, message } });
}

function content(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

async function handle(request, context) {
  const id = Object.hasOwn(request, 'id') ? request.id : 0;
  if (request.method === 'initialize') {
    result(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'lazytrae-lsp', version: '0.19.0' } });
    return;
  }
  const provider = status(context.target, context.toolingRoot);
  const environment = provider.source === 'owned' ? ownedRuntimeEnvironment(context.toolingRoot) : undefined;
  let available = ['lsp_status'];
  if (provider.state === 'ready') {
    try {
      available = ['lsp_status', ...(await advertised(provider, context.target, environment))];
    } catch (failure) {
      provider.state = 'failed-optional';
      provider.reason = `LSP provider handshake failed without changing the target: ${failure.message}`;
    }
  }
  if (request.method === 'tools/list') {
    result(id, { tools: available.map(tool) });
    return;
  }
  if (request.method !== 'tools/call') return error(id, -32601, 'unsupported method');
  const params = request.params;
  if (!params || typeof params !== 'object' || Array.isArray(params) || typeof params.name !== 'string' || (params.arguments !== undefined && (typeof params.arguments !== 'object' || Array.isArray(params.arguments)))) {
    return error(id, -32602, 'tools/call requires a tool name and object arguments');
  }
  try {
    if (params.name === 'lsp_status') return result(id, content(provider));
    if (params.name === 'rename') throw new Error('rename is intentionally unsupported; LazyTrae exposes read-only LSP operations only.');
    if (!available.includes(params.name)) throw new Error(`operation is unavailable because the active LSP provider did not advertise it: ${params.name}`);
    result(id, content(await execute(params.name, params.arguments || {}, provider, context.target, environment)));
  } catch (failure) {
    error(id, -32602, failure.message);
  }
}

function printUsage() {
  console.log('Usage: lazytrae lsp --target <absolute-project-path> --tooling-root <absolute-owned-root>');
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return 0;
  }
  let context;
  try {
    context = parseLspArgs(args);
  } catch (failure) {
    console.error(`lazytrae lsp: ${failure.message}`);
    return 1;
  }
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  input.on('line', line => {
    Promise.resolve().then(async () => {
      let request;
      try {
        request = JSON.parse(line);
      } catch (_) {
        error(0, -32700, 'parse error');
        return;
      }
      if (!request || typeof request !== 'object' || Array.isArray(request)) {
        error(0, -32600, 'request must be an object');
        return;
      }
      await handle(request, context);
    }).catch(failure => error(0, -32603, failure.message));
  });
  return undefined;
}

module.exports = { run };
