const fs = require('fs');
const path = require('path');
const { lspInvocation } = require('./lsp-provider');
const { LspSession } = require('./lsp-session');

const TIMEOUT_MS = Number.parseInt(process.env.LAZYTRAE_LSP_TIMEOUT_MS || '8000', 10);

function timeoutMs() {
  return Number.isInteger(TIMEOUT_MS) && TIMEOUT_MS > 0 && TIMEOUT_MS <= 30000 ? TIMEOUT_MS : 8000;
}

function operations(capabilities) {
  const result = [];
  if (capabilities.definitionProvider) result.push('definition');
  if (capabilities.referencesProvider) result.push('references');
  if (capabilities.documentSymbolProvider) result.push('symbols');
  if (capabilities.hoverProvider) result.push('hover');
  result.push('diagnostics');
  return result;
}

function relativeFile(root, raw) {
  if (typeof raw !== 'string' || !raw || path.isAbsolute(raw)) throw new Error('path must be a non-empty repository-relative string.');
  const candidate = path.resolve(root, raw);
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('path is outside project root.');
  const resolved = fs.realpathSync(candidate);
  const realRelative = path.relative(root, resolved);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative) || !fs.statSync(resolved).isFile()) {
    throw new Error('path must resolve to a regular file inside project root.');
  }
  return resolved;
}

function position(arguments) {
  const { line, character } = arguments;
  if (!Number.isInteger(line) || line < 0 || !Number.isInteger(character) || character < 0) {
    throw new Error('line and character must be non-negative integers.');
  }
  return { line, character };
}

function languageId(language) {
  return language === 'typescript' ? 'typescript' : 'python';
}

async function withSession(provider, root, environment, action, requestedTimeout) {
  const session = new LspSession(lspInvocation(provider), root, requestedTimeout || timeoutMs(), environment);
  try {
    return await action(session);
  } finally {
    session.close();
  }
}

async function advertised(provider, root, environment) {
  return withSession(provider, root, environment, async session => operations(await session.initialize(root)));
}

async function execute(name, arguments, provider, root, environment, requestedTimeout) {
  if (name === 'rename') throw new Error('rename is intentionally unsupported; LazyTrae exposes read-only LSP operations only.');
  const file = relativeFile(root, arguments.path);
  return withSession(provider, root, environment, async session => {
    const capabilities = await session.initialize(root);
    const enabled = operations(capabilities);
    if (!enabled.includes(name)) throw new Error(`operation is unavailable because the active provider did not advertise it: ${name}`);
    const uri = `file://${encodeURI(file)}`;
    session.notify('textDocument/didOpen', {
      textDocument: { uri, languageId: languageId(provider.language), version: 1, text: fs.readFileSync(file, 'utf8') },
    });
    const textDocument = { uri };
    if (name === 'definition') return session.request('textDocument/definition', { textDocument, position: position(arguments) });
    if (name === 'references') return session.request('textDocument/references', { textDocument, position: position(arguments), context: { includeDeclaration: arguments.includeDeclaration !== false } });
    if (name === 'symbols') return session.request('textDocument/documentSymbol', { textDocument });
    if (name === 'hover') return session.request('textDocument/hover', { textDocument, position: position(arguments) });
    return session.diagnostics();
  }, requestedTimeout);
}

function tool(name) {
  if (name === 'lsp_status') return { name, description: 'Inspect the bounded read-only LSP provider state.', inputSchema: { type: 'object', properties: {} } };
  const properties = { path: { type: 'string', description: 'Repository-relative source file' } };
  if (['definition', 'references', 'hover'].includes(name)) {
    properties.line = { type: 'integer', minimum: 0 };
    properties.character = { type: 'integer', minimum: 0 };
  }
  if (name === 'references') properties.includeDeclaration = { type: 'boolean', default: true };
  return { name, description: `Read-only LSP ${name} operation when advertised by the active provider.`, inputSchema: { type: 'object', properties, required: ['path'] } };
}

module.exports = { advertised, execute, tool };
