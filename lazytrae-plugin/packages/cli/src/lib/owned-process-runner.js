const { spawnSync } = require('node:child_process');

class OwnedCommandTimeoutError extends Error {
  constructor(timeoutCode, timeout) {
    super(`${timeoutCode}: package-owned command timed out after ${timeout}ms; best-effort termination was requested for its owned process group.`);
    this.code = timeoutCode;
  }
}

function didTimeOut(result) {
  return result.error?.code === 'ETIMEDOUT';
}

function terminateOwnedTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function runOwnedCommand(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    detached: process.platform !== 'win32',
    encoding: options.encoding,
    env: options.env,
    timeout: options.timeout,
  });
  if (didTimeOut(result)) {
    terminateOwnedTree(result.pid);
    throw new OwnedCommandTimeoutError(options.timeoutCode, options.timeout);
  }
  return result;
}

module.exports = { OwnedCommandTimeoutError, runOwnedCommand, terminateOwnedTree };
