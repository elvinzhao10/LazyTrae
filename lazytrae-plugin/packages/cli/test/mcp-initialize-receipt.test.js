const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { inspectInitializeReceipt, RECEIPT_FILE, SERVER_VERSION } = require('../src/lib/initialize-receipt');
const { makeFixture, runCli } = require('./test-helpers');

const ENTRY_POINT = path.join(__dirname, '..', 'src', 'mcp', 'index.js');

function initialize(projectRoot, callerRoot, clientName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ENTRY_POINT], {
      cwd: callerRoot,
      env: { ...process.env, LAZYTRAE_PROJECT_ROOT: projectRoot },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', status => {
      if (status !== 0) {
        reject(new Error(`initialize exited ${status}: ${stderr}`));
        return;
      }
      resolve({ response: JSON.parse(stdout.trim()), stderr });
    });
    child.stdin.end(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: clientName } },
    })}\n`);
  });
}

test('CLI-embedded MCP writes a receipt from a non-package-root cwd and load-check keeps host readiness pending', async () => {
  const fixture = makeFixture('lazytrae-cli-mcp-receipt-');
  const callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae cli caller with spaces '));
  try {
    const result = await initialize(fixture, callerRoot, 'Trae IDE');
    assert.equal(result.response.result.serverInfo.version, SERVER_VERSION);
    assert.equal(result.response.error, undefined);
    const receiptPath = path.join(fixture, '.lazytrae', 'state', RECEIPT_FILE);
    assert.equal(fs.existsSync(receiptPath), true);
    assert.equal(inspectInitializeReceipt(fixture).state, 'valid');

    const check = runCli(['load-check', '--host', 'ide'], { cwd: fixture });
    assert.equal(check.status, 0, check.stdout);
    assert.match(check.stdout, /MCP initialize evidence: previously observed/);
    assert.match(check.stdout, /host readiness remains PENDING/);
    assert.match(check.stdout, /IDE registration: NOT VERIFIED/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
  }
});
