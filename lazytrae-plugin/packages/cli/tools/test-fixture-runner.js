const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const fixturePrefixes = ['lazytrae-', 'lazyseries-', 'lazytrae lifecycle command '];
const suiteTimeoutMs = 15 * 60 * 1000;
const preload = path.join(__dirname, '..', 'test', 'temp-fixture-cleanup.js');
const testRoot = path.join(__dirname, '..', 'test');
const packageRoot = path.join(__dirname, '..');
const serialTestNames = new Set([
  'lifecycle-command.test.js',
  'owned-process-runner.test.js',
]);
let activeChild;
let activeSuiteRoot;
let terminationSignal;

function testConcurrency() {
  const value = process.env.LAZYTRAE_TEST_CONCURRENCY;
  if (value === undefined) return 2;
  if (!/^[1-4]$/.test(value)) {
    throw new Error('LAZYTRAE_TEST_CONCURRENCY must be an integer from 1 through 4.');
  }
  return Number(value);
}

function selectedTests(args) {
  const exclusions = new Set(args
    .filter(argument => argument.startsWith('--exclude='))
    .map(argument => path.resolve(packageRoot, argument.slice('--exclude='.length))));
  const explicit = args.filter(argument => !argument.startsWith('--'));
  const selected = explicit.length > 0
    ? explicit.map(argument => path.resolve(packageRoot, argument))
    : fs.readdirSync(testRoot)
      .filter(entry => entry.endsWith('.test.js'))
      .map(entry => path.join(testRoot, entry));
  for (const file of selected) {
    const relativeToTests = path.relative(testRoot, file);
    if (!relativeToTests.startsWith(`..${path.sep}`)
      && relativeToTests !== '..'
      && !file.endsWith('.test.js')) {
      throw new Error(`test helpers cannot be executed as tests: ${relativeTests([file])[0]}`);
    }
  }
  return selected.filter(file => !exclusions.has(file)).sort();
}

function ownedFixtures(suiteRoot) {
  return fs.readdirSync(suiteRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fixturePrefixes.some(prefix => entry.name.startsWith(prefix)))
    .map(entry => path.join(suiteRoot, entry.name))
    .sort();
}

function stopChild(child, signal) {
  if (child.pid && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  child.kill(signal);
}

function cleanSuiteRoot() {
  if (!activeSuiteRoot) return;
  fs.rmSync(activeSuiteRoot, { recursive: true, force: true });
  activeSuiteRoot = undefined;
}

function removeTerminationHandlers() {
  process.removeListener('SIGINT', onTermination);
  process.removeListener('SIGTERM', onTermination);
}

function exitForTermination() {
  const signal = terminationSignal;
  cleanSuiteRoot();
  removeTerminationHandlers();
  process.kill(process.pid, signal);
}

function onTermination(signal) {
  if (terminationSignal) return;
  terminationSignal = signal;
  if (activeChild) {
    stopChild(activeChild, signal);
  } else {
    exitForTermination();
  }
}

function runTests(tests, concurrency, suiteRoot, timeout) {
  if (tests.length === 0) return Promise.resolve(0);
  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(process.execPath, [
        '--require', preload,
        `--test-concurrency=${concurrency}`,
        '--test',
        ...tests,
      ], {
        detached: process.platform !== 'win32',
        stdio: 'inherit',
        env: {
          ...process.env,
          TMPDIR: suiteRoot,
          TMP: suiteRoot,
          TEMP: suiteRoot,
          npm_config_cache: path.join(suiteRoot, 'npm-cache'),
          npm_config_logs_dir: path.join(suiteRoot, 'npm-logs'),
          npm_config_update_notifier: 'false',
        },
      });
    } catch (error) {
      process.stderr.write(`LAZYTRAE_TEST_RUNNER_ERROR ${error.message}\n`);
      resolve(1);
      return;
    }
    activeChild = child;
    const timeoutId = setTimeout(() => stopChild(child, 'SIGTERM'), timeout);
    child.once('error', (error) => {
      process.stderr.write(`LAZYTRAE_TEST_RUNNER_ERROR ${error.message}\n`);
    });
    child.once('close', (status, signal) => {
      clearTimeout(timeoutId);
      if (activeChild === child) activeChild = undefined;
      if (terminationSignal) exitForTermination();
      resolve(status === null || signal ? 1 : status);
    });
  });
}

function relativeTests(tests) {
  return tests.map(file => path.relative(packageRoot, file).split(path.sep).join('/'));
}

async function main(args) {
  const concurrency = testConcurrency();
  const tests = selectedTests(args);
  const serialTests = tests.filter(file => serialTestNames.has(path.basename(file)));
  const concurrentTests = tests.filter(file => !serialTestNames.has(path.basename(file)));
  if (args.includes('--inventory')) {
    process.stdout.write(`${JSON.stringify({
      concurrency,
      tests: relativeTests(tests),
      serial_tests: relativeTests(serialTests),
    })}\n`);
    return 0;
  }

  const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-suite-'));
  activeSuiteRoot = suiteRoot;
  process.on('SIGINT', onTermination);
  process.on('SIGTERM', onTermination);
  const started = Date.now();
  let status = 1;
  try {
    const concurrentStatus = await runTests(concurrentTests, concurrency, suiteRoot, suiteTimeoutMs);
    const remainingTimeout = Math.max(1, suiteTimeoutMs - (Date.now() - started));
    const serialStatus = await runTests(serialTests, 1, suiteRoot, remainingTimeout);
    status = concurrentStatus === 0 && serialStatus === 0 ? 0 : 1;
    const remaining = ownedFixtures(suiteRoot);
    process.stderr.write(`LAZYTRAE_TEST_FIXTURE_INVENTORY root=${suiteRoot} remaining=${JSON.stringify(remaining)}\n`);
    if (remaining.length > 0) status = 1;
  } finally {
    cleanSuiteRoot();
    removeTerminationHandlers();
  }
  return status;
}

main(process.argv.slice(2)).then((status) => {
  process.exitCode = status;
}).catch((error) => {
  process.stderr.write(`LAZYTRAE_TEST_RUNNER_ERROR ${error.message}\n`);
  process.exitCode = 1;
});
