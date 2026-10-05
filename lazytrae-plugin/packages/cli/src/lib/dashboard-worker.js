'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { safeRead, hash, DashboardError } = require('./dashboard-files');

function runWorker(root, script, context, timeout) {
  const bytes = safeRead(root, script, 1024 * 1024);
  if (!/\.(?:c?js|mjs)$/.test(script)) throw new DashboardError('NODE_SCRIPT_REQUIRED');
  const startedAt = new Date().toISOString();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, script)], { cwd: root, detached: process.platform !== 'win32',
      env: { PATH: path.dirname(process.execPath), HOME: root, TMPDIR: root }, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = []; let size = 0; let stopped = false; let failure = null;
    const stop = reason => {
      failure ??= reason;
      if (stopped) return; stopped = true;
      try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') failure = 'PROCESS_CLEANUP_FAILED'; }
    };
    const timer = setTimeout(() => stop('WORKER_TIMEOUT'), timeout);
    const interrupt = () => stop('WORKER_INTERRUPTED');
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      size += chunk.length;
      if (size > 1024 * 1024) stop('WORKER_OUTPUT_LIMIT'); else output.push(chunk);
    });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') stop('WORKER_INPUT_FAILED'); });
    child.stdin.end(JSON.stringify(context));
    child.on('exit', () => { if (!stopped) stop(null); });
    child.on('close', (code, signal) => {
      clearTimeout(timer); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
      const data = Buffer.concat(output);
      resolve({ identity: `trae-worker:${randomUUID()}`, pid: child.pid, script, script_sha256: hash(bytes),
        exit_code: failure || signal ? 1 : code, reason: failure ?? signal, started_at: startedAt,
        finished_at: new Date().toISOString(), output: data });
    });
  });
}
module.exports = { runWorker };
