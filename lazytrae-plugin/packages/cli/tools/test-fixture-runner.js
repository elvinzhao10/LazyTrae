const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const fixturePrefixes = ['lazytrae-', 'lazyseries-'];
const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-suite-'));
const preload = path.join(__dirname, '..', 'test', 'temp-fixture-cleanup.js');

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
    ...process.argv.slice(2),
  ], {
    stdio: 'inherit',
    env: { ...process.env, TMPDIR: suiteRoot, TMP: suiteRoot, TEMP: suiteRoot },
  });
  status = result.status === null ? 1 : result.status;
  const remaining = ownedFixtures();
  process.stderr.write(`LAZYTRAE_TEST_FIXTURE_INVENTORY root=${suiteRoot} remaining=${JSON.stringify(remaining)}\n`);
  if (remaining.length > 0) status = 1;
} finally {
  fs.rmSync(suiteRoot, { recursive: true, force: true });
}

process.exitCode = status;
