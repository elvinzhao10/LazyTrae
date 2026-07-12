const { spawn } = require('child_process');
const { ownedExecutable, parseCodeGraphArgs, status } = require('../lib/codegraph-lifecycle');
const { ownedRuntimeEnvironment } = require('../lib/tooling-root');

function printUsage() {
  console.log('Usage: lazytrae codegraph --target <absolute-project-path> --tooling-root <absolute-owned-root>');
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
      stdio: 'inherit',
      env: { ...ownedRuntimeEnvironment(toolingRoot), CODEGRAPH_NO_DOWNLOAD: '1' },
    });
    child.on('error', failure => {
      console.error(`lazytrae codegraph: ${failure.message}`);
      process.exitCode = 1;
    });
    child.on('exit', code => {
      if (code !== 0) process.exitCode = code || 1;
    });
    return undefined;
  } catch (failure) {
    console.error(`lazytrae codegraph: ${failure.message}`);
    return 1;
  }
}

module.exports = { run };
