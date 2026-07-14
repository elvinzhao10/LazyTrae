const { spawn } = require('child_process');

const MAX_BODY_BYTES = 4_000_000;
const MAX_HEADERS_BYTES = 16_384;

class LspSession {
  constructor(command, cwd, timeoutMs, environment) {
    this.process = spawn(command[0], command.slice(1), { cwd, env: environment, stdio: ['pipe', 'pipe', 'ignore'] });
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.process.stdout.on('data', chunk => this.receive(chunk));
    this.process.on('error', error => this.failPending(error));
    this.process.on('exit', () => this.failPending(new Error('LSP provider exited before responding.')));
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const separator = this.buffer.indexOf('\r\n\r\n');
      if (separator === -1) {
        if (this.buffer.length > MAX_HEADERS_BYTES) this.failPending(new Error('LSP response headers exceed limit.'));
        return;
      }
      const headers = this.buffer.subarray(0, separator).toString('ascii');
      const match = /^content-length:\s*(\d+)\s*$/im.exec(headers);
      if (!match) return this.failPending(new Error('LSP response has invalid Content-Length.'));
      const length = Number(match[1]);
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) {
        return this.failPending(new Error('LSP response has unsafe Content-Length.'));
      }
      if (this.buffer.length < separator + 4 + length) return;
      const body = this.buffer.subarray(separator + 4, separator + 4 + length);
      this.buffer = this.buffer.subarray(separator + 4 + length);
      let message;
      try {
        message = JSON.parse(body.toString('utf8'));
      } catch (_) {
        return this.failPending(new Error('LSP response has invalid JSON.'));
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return this.failPending(new Error('LSP response is not an object.'));
      this.dispatch(message);
    }
  }

  dispatch(message) {
    if (Object.hasOwn(message, 'id') && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error && typeof message.error === 'object') pending.reject(new Error(String(message.error.message || 'LSP request failed.')));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === 'textDocument/publishDiagnostics' && message.params && typeof message.params === 'object') this.notifications.push(message.params);
  }

  failPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  send(message) {
    if (this.closed || !this.process.stdin.writable) throw new Error('LSP stdin is unavailable.');
    const body = Buffer.from(JSON.stringify(message));
    this.process.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.process.stdin.write(body);
  }

  request(method, params) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('LSP response exceeded bounded timeout.'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  async initialize(root) {
    const uri = `file://${encodeURI(root)}`;
    const result = await this.request('initialize', {
      processId: process.pid,
      rootUri: uri,
      workspaceFolders: [{ uri, name: root.split('/').filter(Boolean).pop() || 'workspace' }],
      capabilities: { textDocument: { definition: {}, references: {}, documentSymbol: {}, hover: {}, publishDiagnostics: {} } },
    });
    if (!result || typeof result !== 'object' || Array.isArray(result) || !result.capabilities || typeof result.capabilities !== 'object') {
      throw new Error('LSP initialize returned malformed capabilities.');
    }
    this.notify('initialized', {});
    return result.capabilities;
  }

  async diagnostics() {
    await new Promise(resolve => setTimeout(resolve, Math.min(this.timeoutMs, 150)));
    return this.notifications;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.failPending(new Error('LSP session closed.'));
    this.process.kill('SIGTERM');
    const force = setTimeout(() => this.process.kill('SIGKILL'), 2000);
    this.process.once('exit', () => clearTimeout(force));
  }
}

module.exports = { LspSession };
