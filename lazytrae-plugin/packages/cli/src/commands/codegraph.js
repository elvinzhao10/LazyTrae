const { spawn } = require('child_process');
const { ownedExecutable, parseCodeGraphArgs, status } = require('../lib/codegraph-lifecycle');
const { ownedRuntimeEnvironment } = require('../lib/tooling-root');

function printUsage() {
  console.log('Usage: lazytrae codegraph --target <absolute-project-path> --tooling-root <absolute-owned-root>');
}

function stopChildTree(child, signal) {
  if (child.pid === undefined) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (failure) {
    if (failure.code !== 'ESRCH') throw failure;
  }
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return 0;
  }
  try {
    const { target, toolingRoot } = parseCodeGraphArgs(args);
    const current = status(target, toolingRoot);
    if (current.state !== 'ready') throw new Error(`CodeGraph is unavailable: ${current.reason}`);
    const executable = ownedExecutable(toolingRoot);
    const child = spawn(executable, ['serve', '--mcp'], {
      cwd: target,
      stdio: ['pipe', 'pipe', 'inherit'],
      detached: process.platform !== 'win32',
      env: {
        ...ownedRuntimeEnvironment(toolingRoot),
        CODEGRAPH_NO_DAEMON: '1',
        CODEGRAPH_NO_DOWNLOAD: '1',
      },
    });
    let stopping = false;
    let inputClosed = false;
    let forceTimer;
    let closeTimer;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      stopChildTree(child, 'SIGTERM');
      forceTimer = setTimeout(() => stopChildTree(child, 'SIGKILL'), 500);
    };
    const cleanup = () => {
      if (!stopping) clearTimeout(forceTimer);
      clearTimeout(closeTimer);
      process.stdin.unpipe(child.stdin);
      process.stdin.removeListener('end', closeInput);
      process.stdin.removeListener('error', stop);
      process.removeListener('SIGTERM', stop);
      process.removeListener('SIGINT', stop);
    };
    const closeInput = () => {
      inputClosed = true;
      child.stdin.end();
      closeTimer = setTimeout(stop, 500);
    };
    child.stdout.on('data', chunk => {
      process.stdout.write(chunk);
      if (inputClosed) {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(stop, 25);
      }
    });
    process.stdin.pipe(child.stdin);
    process.stdin.once('end', closeInput);
    process.stdin.once('error', stop);
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    child.on('error', failure => {
      console.error(`lazytrae codegraph: ${failure.message}`);
      process.exitCode = 1;
      stop();
    });
    child.on('exit', code => {
      cleanup();
      if (code !== 0 && !stopping) process.exitCode = code || 1;
    });
    return undefined;
  } catch (failure) {
    console.error(`lazytrae codegraph: ${failure.message}`);
    return 1;
  }
}

module.exports = { run };
