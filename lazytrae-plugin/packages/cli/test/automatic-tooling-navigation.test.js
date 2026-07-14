const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

function fixture(prefix, definition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(root, 'source.ts'), 'export const answer = 42;\n');
  fs.writeFileSync(path.join(bin, 'typescript-language-server'), `#!/usr/bin/env node
if (process.argv[2] === '--version') { console.log('4.3.3'); process.exit(0); }
let buffer = Buffer.alloc(0);
function reply(message) { const body = Buffer.from(JSON.stringify(message)); process.stdout.write(\`Content-Length: \${body.length}\\r\\n\\r\\n\`); process.stdout.write(body); }
process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const separator = buffer.indexOf('\\r\\n\\r\\n');
    if (separator === -1) return;
    const length = Number(/content-length:\\s*(\\d+)/i.exec(buffer.subarray(0, separator).toString('ascii'))[1]);
    if (buffer.length < separator + 4 + length) return;
    const request = JSON.parse(buffer.subarray(separator + 4, separator + 4 + length).toString('utf8'));
    buffer = buffer.subarray(separator + 4 + length);
    if (request.method === 'initialize') reply({ jsonrpc: '2.0', id: request.id, result: { capabilities: { definitionProvider: true } } });
    if (request.method === 'textDocument/definition') reply({ jsonrpc: '2.0', id: request.id, result: ${JSON.stringify(definition)} });
  }
});
`);
  fs.chmodSync(path.join(bin, 'typescript-language-server'), 0o755);
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '-qm', 'navigation-fixture'], { cwd: root });
  return { root, bin, toolpack: path.join(root, 'empty-toolpack') };
}

function runNavigation(root, bin, toolpack) {
  return runCli(['tooling', 'capability', 'run', 'code_navigation', '--query', 'answer', '--toolpack', toolpack], {
    cwd: root,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  });
}

test('automatic code navigation returns an explicit unavailable result when the LSP has no definition', () => {
  // Given: a clean TypeScript repository and a project-visible LSP stub that starts successfully.
  const { root, bin, toolpack } = fixture('lazytrae-broker-navigation-unavailable-', null);
  try {
    // When: the capability runs a query whose target symbol receives no definition response.
    const result = runNavigation(root, bin, toolpack);

    // Then: it cannot claim success with the old empty string result.
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).result, {
      kind: 'unavailable',
      code: 'AUTOMATIC_TOOLING_NAVIGATION_UNAVAILABLE',
    });
    assert.equal(fs.existsSync(toolpack), false);
    assert.equal(fs.existsSync(path.join(root, '.trae', 'mcp.json')), false);
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout, '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic code navigation returns the bounded LSP definition result', () => {
  const location = { uri: 'file:///definition.ts', range: { start: { line: 0, character: 13 }, end: { line: 0, character: 19 } } };
  const { root, bin, toolpack } = fixture('lazytrae-broker-navigation-result-', location);
  try {
    const result = runNavigation(root, bin, toolpack);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).result, { kind: 'navigation', operation: 'definition', result: location });
    assert.equal(fs.existsSync(toolpack), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
