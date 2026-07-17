const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporaryRoot = path.resolve(os.tmpdir());
const fixturePrefixes = ['lazytrae-', 'lazyseries-'];
const fixtures = new Set();
const originalMkdtempSync = fs.mkdtempSync;

function isOwnedFixture(candidate) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(temporaryRoot, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  return fixturePrefixes.some(prefix => relative.startsWith(prefix));
}

fs.mkdtempSync = function trackedMkdtempSync(prefix, options) {
  const fixture = originalMkdtempSync.call(fs, prefix, options);
  if (isOwnedFixture(fixture)) fixtures.add(fixture);
  return fixture;
};

function cleanupFixtures() {
  if (process.env.LAZYTRAE_KEEP_TEST_FIXTURES === '1') return;
  for (const fixture of fixtures) {
    try {
      fs.rmSync(fixture, { recursive: true, force: true });
    } catch (error) {
      process.stderr.write(`Unable to clean test fixture ${fixture}: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

process.once('exit', cleanupFixtures);
