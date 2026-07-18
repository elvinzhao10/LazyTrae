const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  MAX_RECEIPT_AGE_MS,
  PROTOCOL_VERSION,
  RECEIPT_FILE,
  RECEIPT_OWNER,
  RECEIPT_SCHEMA_VERSION,
  SERVER_VERSION,
  inspectInitializeReceipt,
} = require('../src/runtime/initialize-receipt');

const ENTRY_POINT = path.join(__dirname, '..', 'src', 'index.js');

function makeProject(prefix) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix} with spaces `));
  fs.mkdirSync(path.join(projectRoot, '.lazytrae', 'state'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.lazytrae', 'state', 'boulder.json'), '{"active_work_id":null,"works":{}}\n');
  return projectRoot;
}

function runInitialize(projectRoot, callerRoot, clientName) {
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

test('concurrent initialize calls from an unrelated spaced cwd leave one bounded receipt', async () => {
  const projectRoot = makeProject('lazytrae-mcp-receipt-');
  const callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unrelated caller with spaces '));
  const localConfigPath = path.join(projectRoot, '.lazytrae', 'state', 'caller-state.json');
  const localConfig = '{"caller_owned":true}\n';
  fs.writeFileSync(localConfigPath, localConfig);
  try {
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => runInitialize(
      projectRoot,
      callerRoot,
      `Trae IDE\nclient-${index}/secret`,
    )));
    for (const result of responses) {
      assert.deepEqual(result.response.result.serverInfo, { name: 'lazytrae-mcp', version: SERVER_VERSION });
      assert.equal(result.response.error, undefined);
      assert.doesNotMatch(result.response.result.protocolVersion, /\\n/);
    }
    const target = path.join(projectRoot, '.lazytrae', 'state', RECEIPT_FILE);
    const observation = inspectInitializeReceipt(projectRoot);
    assert.equal(observation.state, 'valid');
    assert.equal(observation.receipt.owner, RECEIPT_OWNER);
    assert.equal(observation.receipt.schema_version, RECEIPT_SCHEMA_VERSION);
    assert.equal(observation.receipt.protocol_version, PROTOCOL_VERSION);
    assert.equal(observation.receipt.server_version, SERVER_VERSION);
    assert.equal(Number.isInteger(observation.receipt.pid), true);
    assert.match(observation.receipt.client_label, /^Trae IDE client-\d+_secret$/);
    assert.equal(fs.readFileSync(localConfigPath, 'utf8'), localConfig);
    assert.equal(fs.statSync(target).isFile(), true);
    assert.deepEqual(
      fs.readdirSync(path.dirname(target)).filter(name => name.includes(RECEIPT_FILE) && (name.endsWith('.tmp') || name.endsWith('.lock'))),
      [],
    );

    const repeated = await runInitialize(projectRoot, callerRoot, 'Trae IDE repeated');
    assert.equal(repeated.response.result.serverInfo.version, SERVER_VERSION);
    assert.equal(inspectInitializeReceipt(projectRoot).state, 'valid');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
  }
});

test('receipt write failure keeps initialize protocol-valid and preserves the target behind a symlink', async () => {
  const projectRoot = makeProject('lazytrae-mcp-receipt-failure-');
  const callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-caller '));
  const outside = path.join(os.tmpdir(), `lazytrae-mcp-outside-${process.pid}-${Date.now()}`);
  const target = path.join(projectRoot, '.lazytrae', 'state', RECEIPT_FILE);
  fs.writeFileSync(outside, 'caller-owned\n');
  fs.symlinkSync(outside, target);
  try {
    const result = await runInitialize(projectRoot, callerRoot, 'Trae IDE');
    assert.equal(result.response.result.serverInfo.version, SERVER_VERSION);
    assert.equal(result.response.error, undefined);
    assert.match(result.stderr, /initialize receipt write skipped/);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'caller-owned\n');
    assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
    assert.equal(inspectInitializeReceipt(projectRoot).state, 'invalid');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
});

test('receipt write failure preserves a non-regular FIFO target', async () => {
  const projectRoot = makeProject('lazytrae-mcp-receipt-fifo-');
  const callerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-fifo-caller '));
  const target = path.join(projectRoot, '.lazytrae', 'state', RECEIPT_FILE);
  execFileSync('mkfifo', [target]);
  try {
    const result = await runInitialize(projectRoot, callerRoot, 'Trae IDE');
    assert.equal(result.response.result.serverInfo.version, SERVER_VERSION);
    assert.equal(result.response.error, undefined);
    assert.match(result.stderr, /initialize receipt write skipped/);
    assert.equal(fs.statSync(target).isFIFO(), true);
    assert.equal(inspectInitializeReceipt(projectRoot).state, 'invalid');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.rmSync(callerRoot, { recursive: true, force: true });
  }
});

test('corrupt, stale, and non-regular receipts remain non-live observations', () => {
  const projectRoot = makeProject('lazytrae-mcp-receipt-states-');
  const target = path.join(projectRoot, '.lazytrae', 'state', RECEIPT_FILE);
  const stale = new Date(Date.now() - MAX_RECEIPT_AGE_MS - 1_000).toISOString();
  try {
    fs.writeFileSync(target, '{bad json\n');
    assert.equal(inspectInitializeReceipt(projectRoot).state, 'invalid');

    fs.writeFileSync(target, JSON.stringify({
      owner: RECEIPT_OWNER,
      schema_version: RECEIPT_SCHEMA_VERSION,
      protocol_version: PROTOCOL_VERSION,
      server_version: SERVER_VERSION,
      pid: process.pid,
      initialized_at: stale,
      last_initialized_at: stale,
    }) + '\n');
    assert.equal(inspectInitializeReceipt(projectRoot).state, 'stale');

    fs.rmSync(target);
    const outside = path.join(os.tmpdir(), `lazytrae-mcp-receipt-state-${process.pid}-${Date.now()}`);
    fs.writeFileSync(outside, '{}\n');
    fs.symlinkSync(outside, target);
    assert.equal(inspectInitializeReceipt(projectRoot).state, 'invalid');
    fs.rmSync(outside, { force: true });
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
