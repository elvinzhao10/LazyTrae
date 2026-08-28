const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(CLI_ROOT, 'src', 'index.js');

function sendRequests(requests, expectedResponses) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'mcp'], { cwd: CLI_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = [];
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(responses);
    };

    const timer = setTimeout(() => {
      finish(new Error(`MCP server timed out; stdout=${stdout}; stderr=${stderr}`));
    }, 2_000);

    child.stdout.on('data', chunk => {
      stdout += chunk;
      const lines = stdout.split('\n');
      stdout = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        try {
          responses.push(JSON.parse(line));
        } catch (error) {
          finish(new Error(`MCP emitted invalid JSON-RPC: ${error.message}`));
          return;
        }
      }
      if (responses.length === expectedResponses) finish();
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', finish);
    child.on('exit', code => {
      if (!settled) finish(new Error(`MCP exited before responding (code ${code}); stdout=${stdout}; stderr=${stderr}`));
    });

    child.stdin.end(requests.join('\n') + '\n');
  });
}

test('MCP returns JSON-RPC errors for malformed input without blocking later valid requests', async () => {
  // Given: malformed JSON, invalid envelopes, a notification, then initialize and tools/list requests.
  const responses = await sendRequests([
    '{bad json',
    'null',
    JSON.stringify({ jsonrpc: '2.0', id: 3 }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'rpc.reserved' }),
    JSON.stringify({ jsonrpc: '2.0', id: 'bad-arguments', method: 'tools/call', params: { name: 'lazytrae.docs_lookup', arguments: { query: [] } } }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'initialize' }),
    JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/list' }),
  ], 7);

  // Then: invalid inputs have protocol errors, the notification is silent, and later valid requests succeed.
  assert.deepEqual(responses[0], {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error' },
  });
  assert.deepEqual(responses[1], {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32600, message: 'Invalid Request' },
  });
  assert.deepEqual(responses[2], {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32600, message: 'Invalid Request' },
  });
  assert.deepEqual(responses[3], {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32600, message: 'Invalid Request' },
  });
  assert.deepEqual(responses[4], {
    jsonrpc: '2.0', id: 'bad-arguments', error: { code: -32602, message: 'Invalid tools/call parameters' },
  });
  assert.equal(responses[5].id, 5);
  assert.equal(responses[5].error, undefined);
  assert.equal(responses[5].result.serverInfo.name, 'lazytrae-mcp');
  assert.equal(responses[6].id, 6);
  assert.equal(responses[6].error, undefined);
  assert.equal(responses[6].result.tools.length, 15);
});
