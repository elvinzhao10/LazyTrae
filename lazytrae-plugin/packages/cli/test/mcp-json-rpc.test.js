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

test('MCP returns JSON-RPC errors for malformed input without blocking a later valid request', async () => {
  // Given: malformed JSON, JSON null, an invalid request envelope, and a valid tools/list request.
  const responses = await sendRequests([
    '{bad json',
    'null',
    JSON.stringify({ jsonrpc: '2.0', id: 3 }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'rpc.reserved' }),
    JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list' }),
  ], 5);

  // Then: each invalid input has the protocol error and the valid request still receives all 15 tools.
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
  assert.equal(responses[4].id, 5);
  assert.equal(responses[4].error, undefined);
  assert.equal(responses[4].result.tools.length, 15);
});
