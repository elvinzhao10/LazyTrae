const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const ENTRY_POINT = path.join(PACKAGE_ROOT, 'src', 'index.js');
const EXPECTED_TOOL_NAMES = [
  'lazytrae.get_active_plan',
  'lazytrae.get_boulder_status',
  'lazytrae.get_next_task',
  'lazytrae.record_evidence',
  'lazytrae.mark_task_done',
  'lazytrae.add_blocker',
  'lazytrae.request_review',
  'lazytrae.generate_handoff',
  'lazytrae.get_parity_status',
  'lazytrae.symbol_search',
  'lazytrae.find_references',
  'lazytrae.goto_definition',
  'lazytrae.diagnostics',
  'lazytrae.docs_lookup',
  'lazytrae.dependency_graph',
];

function listJavaScriptFiles(root, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...listJavaScriptFiles(root, relativePath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(relativePath);
  }
  return files;
}

function runMcp(cwd, requests, expectedResponseCount) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ENTRY_POINT], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = [];
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      if (error) reject(error);
      else resolve(responses);
    };

    const timeout = setTimeout(() => {
      finish(new Error(`MCP server timed out; stdout=${stdout}; stderr=${stderr}`));
    }, 5_000);

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
      if (responses.length === expectedResponseCount) finish();
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', finish);
    child.on('exit', code => {
      if (!settled) finish(new Error(`MCP exited before responding (code ${code}); stdout=${stdout}; stderr=${stderr}`));
    });

    child.stdin.end(requests.join('\n') + '\n');
  });
}

test('package runtime does not import the CLI checkout', () => {
  // Given: every packaged production source file.
  const sourceRoot = path.join(PACKAGE_ROOT, 'src');
  const sourceFiles = listJavaScriptFiles(sourceRoot);

  // When: the package import graph is inspected.
  const cliImports = sourceFiles.filter(file =>
    fs.readFileSync(path.join(sourceRoot, file), 'utf8').includes('../../cli'),
  );

  // Then: no runtime module reaches outside this package.
  assert.deepEqual(cliImports, []);
});

test('stdio MCP serves protocol errors, reads state, and writes receipt evidence', async () => {
  // Given: an isolated LazyTrae state root and a real stdio server process.
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-package-test-'));
  const stateDir = path.join(projectRoot, '.lazytrae', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'boulder.json'), JSON.stringify({
    active_work_id: null,
    works: {},
  }));

  try {
    // When: malformed, notification, discovery, read, and safe-write requests share one stream.
    const responses = await runMcp(projectRoot, [
      '{malformed json',
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'missing.tool', arguments: {} } }),
      JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'lazytrae.get_boulder_status', arguments: {} } }),
      JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: {
        name: 'lazytrae.record_evidence',
        arguments: { gate_type: 'manual_qa', verdict: 'pass', notes: 'isolated stdio test' },
      } }),
    ], 6);

    // Then: the protocol remains usable and the handler writes only inside .lazytrae.
    assert.deepEqual(responses[0], {
      jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' },
    });
    assert.equal(responses[1].result.serverInfo.version, '1.0.2');
    assert.deepEqual(responses[2].result.tools.map(tool => tool.name), EXPECTED_TOOL_NAMES);
    assert.deepEqual(responses[3], {
      jsonrpc: '2.0', id: 3, error: { code: -32601, message: 'Unknown tool: missing.tool' },
    });
    assert.match(responses[4].result.content[0].text, /"work_count": 0/);
    assert.match(responses[5].result.content[0].text, /"recorded": true/);
    assert.match(
      fs.readFileSync(path.join(projectRoot, '.lazytrae', 'evidence', 'verifier.md'), 'utf8'),
      /isolated stdio test/,
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
