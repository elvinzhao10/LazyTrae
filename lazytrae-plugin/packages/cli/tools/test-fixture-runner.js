const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const fixturePrefixes = ['lazytrae-', 'lazyseries-'];
const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-suite-'));
const preload = path.join(__dirname, '..', 'test', 'temp-fixture-cleanup.js');
const testRoot = path.join(__dirname, '..', 'test');

function selectedTests() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args;
  return fs.readdirSync(testRoot)
    .filter(entry => entry.endsWith('.js'))
    .map(entry => path.join(testRoot, entry));
}

function ownedFixtures() {
  return fs.readdirSync(suiteRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fixturePrefixes.some(prefix => entry.name.startsWith(prefix)))
    .map(entry => path.join(suiteRoot, entry.name))
    .sort();
}

let status = 1;
try {
  const result = childProcess.spawnSync(process.execPath, [
    '--require', preload,
    '--test-concurrency=1',
    '--test',
    ...selectedTests(),
  ], {
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
  status = result.status === null ? 1 : result.status;
  const remaining = ownedFixtures();
  process.stderr.write(`LAZYTRAE_TEST_FIXTURE_INVENTORY root=${suiteRoot} remaining=${JSON.stringify(remaining)}\n`);
  if (remaining.length > 0) status = 1;
} finally {
  fs.rmSync(suiteRoot, { recursive: true, force: true });
}

process.exitCode = status;
