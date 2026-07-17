const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');
const { listOwnedEntries, writeReceipt } = require('../src/lib/tooling-root');

function makeRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function writeTypescriptProvider(root) {
  const binary = path.join(root, 'node_modules', '.bin', 'typescript-language-server');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, `#!/usr/bin/env node
let buffer = Buffer.alloc(0);
function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  process.stdout.write(\`Content-Length: \${body.length}\\r\\n\\r\\n\`);
  process.stdout.write(body);
}
function respond(message) {
  if (message.method === 'initialize') {
    send({ jsonrpc: '2.0', id: message.id, result: { capabilities: { definitionProvider: true, referencesProvider: true, documentSymbolProvider: true, hoverProvider: true } } });
    return;
  }
  if (message.method === 'textDocument/didOpen') {
    send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri: message.params.textDocument.uri, diagnostics: [] } });
    return;
  }
  if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, result: [] });
}
process.stdin.on('data', chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const separator = buffer.indexOf('\\r\\n\\r\\n');
    if (separator < 0) return;
    const headers = buffer.subarray(0, separator).toString('ascii');
    const match = /Content-Length: (\\d+)/i.exec(headers);
    if (!match) process.exit(2);
    const length = Number(match[1]);
    if (buffer.length < separator + 4 + length) return;
    const body = buffer.subarray(separator + 4, separator + 4 + length);
    buffer = buffer.subarray(separator + 4 + length);
    respond(JSON.parse(body.toString('utf8')));
  }
});
`);
  fs.chmodSync(binary, 0o755);
}

test('LSP status is non-blocking for missing and unsupported target projects', () => {
  // Given: a supported TypeScript project and an unsupported project with no configured provider.
  const root = makeRepo('lazytrae-lsp-baseline-');
  const missingRoot = path.join(root, 'missing-tooling');
  const typescript = path.join(root, 'typescript');
  const unsupported = path.join(root, 'unsupported');
  fs.mkdirSync(typescript);
  fs.mkdirSync(unsupported);
  fs.writeFileSync(path.join(typescript, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');

  try {
    // When: the managed LSP status is inspected before a provider is provisioned.
    const missing = runCli(['tooling', 'lsp-status', '--target', typescript, '--tooling-root', missingRoot], { cwd: root });
    const unavailable = runCli(['tooling', 'lsp-status', '--target', unsupported, '--tooling-root', missingRoot], { cwd: root });

    // Then: absence and unsupported language are explicit non-blocking states.
    assert.equal(missing.status, 0, missing.stderr);
    assert.match(missing.stdout, /STATE: missing/);
    assert.equal(unavailable.status, 0, unavailable.stderr);
    assert.match(unavailable.stdout, /STATE: unsupported/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('separate LSP MCP exposes only advertised read-only operations', () => {
  // Given: a target project with a project-owned TypeScript provider that advertises read-only capabilities.
  const root = makeRepo('lazytrae-lsp-bridge-');
  const target = path.join(root, 'target');
  const toolingRoot = path.join(root, 'tooling-root');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
  fs.writeFileSync(path.join(target, 'source.ts'), 'export const answer: number = 42;\n');
  writeTypescriptProvider(target);

  try {
    // When: a real stdio MCP client initializes, lists tools, calls each read operation, and requests rename.
    const input = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'definition', arguments: { path: 'source.ts', line: 0, character: 13 } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'references', arguments: { path: 'source.ts', line: 0, character: 13 } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'symbols', arguments: { path: 'source.ts' } } },
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'hover', arguments: { path: 'source.ts', line: 0, character: 13 } } },
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'diagnostics', arguments: { path: 'source.ts' } } },
      { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'rename', arguments: { path: 'source.ts', line: 0, character: 13 } } },
    ].map(value => JSON.stringify(value)).join('\n') + '\n';
    const result = runCli(['lsp', '--target', target, '--tooling-root', toolingRoot], { cwd: root, input });

    // Then: advertised operations succeed, rename is refused, and the target stays unchanged.
    assert.equal(result.status, 0, result.stderr);
    const responses = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(responses.find(response => response.id === 1).result.serverInfo.name, 'lazytrae-lsp');
    assert.deepEqual(responses.find(response => response.id === 2).result.tools.map(tool => tool.name), [
      'lsp_status', 'definition', 'references', 'symbols', 'hover', 'diagnostics',
    ]);
    for (const id of [3, 4, 5, 6, 7]) assert.ok(responses.find(response => response.id === id).result);
    assert.match(responses.find(response => response.id === 8).error.message, /unsupported/i);
    assert.equal(fs.readFileSync(path.join(target, 'source.ts'), 'utf8'), 'export const answer: number = 42;\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('LSP status recognizes a receipt-owned provider under the macOS temporary-directory alias', () => {
  // Given: a receipt-owned provider under /tmp, whose executable resolves through /private/tmp on macOS.
  const target = makeRepo('lazytrae-lsp-alias-target-');
  const toolingRoot = fs.mkdtempSync('/tmp/lazytrae-lsp-alias-');
  fs.writeFileSync(path.join(target, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
  const binary = path.join(toolingRoot, 'lsp', 'typescript', 'node_modules', 'typescript-language-server', 'cli.js');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, '#!/usr/bin/env node\nconsole.log("5.3.0");\n');
  fs.chmodSync(binary, 0o755);
  const binDirectory = path.join(toolingRoot, 'lsp', 'typescript', 'node_modules', '.bin');
  fs.mkdirSync(binDirectory);
  fs.symlinkSync('../typescript-language-server/cli.js', path.join(binDirectory, 'typescript-language-server'));
  writeReceipt(toolingRoot, listOwnedEntries(toolingRoot), ['lsp-typescript']);

  try {
    // When: status resolves the receipt-owned executable.
    const result = runCli(['tooling', 'lsp-status', '--target', target, '--tooling-root', toolingRoot], { cwd: target });

    // Then: the physical /private/tmp path remains inside the explicitly owned root.
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /STATE: ready/);
    assert.match(result.stdout, /PROVIDER: owned/);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(toolingRoot, { recursive: true, force: true });
  }
});

test('LSP status does not reject basedpyright because its language-server binary has no version mode', () => {
  // Given: an owned Python language-server executable that intentionally rejects --version before stdio initialization.
  const target = makeRepo('lazytrae-lsp-python-target-');
  const toolingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-lsp-python-'));
  fs.writeFileSync(path.join(target, 'pyproject.toml'), '[project]\nname = "fixture"\nversion = "0.0.0"\n');
  const binary = path.join(toolingRoot, 'lsp', 'python', 'node_modules', 'basedpyright', 'langserver.index.js');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, '#!/usr/bin/env node\nprocess.exit(1);\n');
  fs.chmodSync(binary, 0o755);
  const binDirectory = path.join(toolingRoot, 'lsp', 'python', 'node_modules', '.bin');
  fs.mkdirSync(binDirectory);
  fs.symlinkSync('../basedpyright/langserver.index.js', path.join(binDirectory, 'basedpyright-langserver'));
  writeReceipt(toolingRoot, listOwnedEntries(toolingRoot), ['lsp-python']);

  try {
    // When: status detects the provider without starting its stdio server.
    const result = runCli(['tooling', 'lsp-status', '--target', target, '--tooling-root', toolingRoot], { cwd: target });

    // Then: readiness defers semantic validation to the bounded MCP initialize handshake.
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /STATE: ready/);
    assert.match(result.stdout, /PROVIDER: owned/);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(toolingRoot, { recursive: true, force: true });
  }
});

test('LSP uninstall uses the receipt-owned provider even after the target language changes', () => {
  const target = makeRepo('lazytrae-lsp-uninstall-language-change-');
  const toolingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-lsp-uninstall-language-change-'));
  fs.writeFileSync(path.join(target, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
  const binary = path.join(toolingRoot, 'lsp', 'typescript', 'node_modules', 'typescript-language-server', 'cli.js');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, '#!/usr/bin/env node\nconsole.log("5.3.0");\n');
  fs.chmodSync(binary, 0o755);
  const binDirectory = path.join(toolingRoot, 'lsp', 'typescript', 'node_modules', '.bin');
  fs.mkdirSync(binDirectory);
  fs.symlinkSync('../typescript-language-server/cli.js', path.join(binDirectory, 'typescript-language-server'));
  writeReceipt(toolingRoot, listOwnedEntries(toolingRoot), ['lsp-typescript']);

  try {
    // Given: a valid receipt-owned TypeScript provider whose target later becomes Python-only.
    fs.rmSync(path.join(target, 'tsconfig.json'));
    fs.writeFileSync(path.join(target, 'pyproject.toml'), '[project]\nname = "fixture"\nversion = "0.0.0"\n');

    // When: the owned provider is explicitly uninstalled.
    const result = runCli(['tooling', 'lsp-uninstall', '--target', target, '--tooling-root', toolingRoot], { cwd: target });

    // Then: ownership, not current language detection, authorizes safe removal.
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /STATE: removed/);
    assert.match(result.stdout, /LANGUAGE: typescript/);
    assert.equal(fs.existsSync(toolingRoot), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(toolingRoot, { recursive: true, force: true });
  }
});
