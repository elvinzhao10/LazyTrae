'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const RELEASE_VERSION = '1.2.0';
const PREVIOUS_VERSION = '1.1.0';
const HISTORICAL_DIGESTS = {
  'RELEASE_NOTES-v1.1.0.md': '1b0a39ed74b5caec056391e9ed083b5716d9b0110bf05b63127c26639725c5a7',
};
const VERSION_JSON_PATHS = [
  ['lazytrae-plugin/packages/cli/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/mcp/package.json', ['version']],
  ['lazytrae-plugin/packages/mcp/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/mcp/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/codegraph/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/codegraph/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/codegraph/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/python/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/python/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/python/package-lock.json', ['packages', '', 'version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/typescript/package.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/typescript/package-lock.json', ['version']],
  ['lazytrae-plugin/packages/cli/tooling/lsp/typescript/package-lock.json', ['packages', '', 'version']],
];
const REQUIRED_RELEASE_NOTE_SECTIONS = [
  'Eval-driven fixes', 'Measured efficiency', 'Host capability matrix',
  'Migration and upgrade', 'Known risks', 'Rollback',
];

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function nestedValue(value, keys) {
  let current = value;
  for (const key of keys) current = current?.[key];
  return current;
}

function walk(root, directory = root) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return files;
}

function previousVersionClassification(relativePath, line) {
  if (relativePath === 'RELEASE_NOTES-v1.1.0.md' || relativePath.startsWith('docs/v1.1.0-')) return 'historical-release-document';
  if (relativePath === 'CHANGELOG.md') return 'historical-release-history';
  if (relativePath === 'RELEASE_NOTES-v1.2.0.md') return 'documented-migration-boundary';
  if (relativePath === '.product-naming-allowlist.json') return 'historical-naming-allowlist';
  if (relativePath.includes('/contracts/fixtures/') || relativePath.includes('/test/fixtures/')) return 'historical-or-adversarial-fixture';
  if (relativePath.includes('lazyseries-trae-ide-observation-descriptor.v1') || relativePath.includes('lazyseries-trae-host-status.v2')) return 'schema-independent-contract-version';
  if (relativePath.endsWith('trae-ide-observation.js') || relativePath.endsWith('host-capability-matrix.js') || relativePath.endsWith('commands/status.js')) return 'schema-independent-runtime-contract-version';
  if (relativePath.endsWith('host-capability-matrix.test.js') || relativePath.endsWith('host-capability-status-integration.test.js')) return 'schema-independent-contract-test';
  if (relativePath.includes('automatic-tooling-contract.v1') || relativePath.includes('v1.0.3-')) return 'schema-independent-contract-history';
  if (relativePath.endsWith('release-version-classifier.js')) return 'classifier-input';
  if (relativePath.endsWith('v120-release-version-classification.test.js')) return 'adversarial-test-input';
  if (relativePath.endsWith('automatic-tooling-contract.test.js')) return 'schema-independent-contract-test';
  if (/(?:^|\/)(?:test|tests)\//.test(relativePath) && /(previous|historical|fixture|wrong|from|upgrade|mutable|prior)/i.test(line)) return 'historical-test-input';
  if (/\bcurrent\b.*\b(?:release|version)\b/i.test(line)) return 'current-version-drift';
  if (/(upgrade|migrat|rollback|previous|historical|prior|old release|from v?1\.1\.0|tag\/v1\.1\.0|release notes)/i.test(line)) return 'historical-migration-reference';
  return null;
}

function classify(root) {
  const failures = [];
  const classifications = [];
  for (const [relativePath, keys] of VERSION_JSON_PATHS) {
    const actual = nestedValue(readJson(root, relativePath), keys);
    if (actual !== RELEASE_VERSION) failures.push(`CURRENT_VERSION_DRIFT ${relativePath}#${keys.join('.')} expected ${RELEASE_VERSION}, got ${JSON.stringify(actual)}`);
  }
  const runtimeVersion = require(path.join(root, 'lazytrae-plugin/packages/cli/src/lib/version.js')).CURRENT_VERSION;
  if (runtimeVersion !== RELEASE_VERSION) failures.push(`PACKAGE_RUNTIME_MISMATCH runtime expected ${RELEASE_VERSION}, got ${runtimeVersion}`);

  const notesPath = path.join(root, `RELEASE_NOTES-v${RELEASE_VERSION}.md`);
  if (!fs.existsSync(notesPath)) failures.push(`MISSING_RELEASE_NOTE RELEASE_NOTES-v${RELEASE_VERSION}.md`);
  else {
    const notes = fs.readFileSync(notesPath, 'utf8');
    for (const section of REQUIRED_RELEASE_NOTE_SECTIONS) {
      if (!notes.includes(`## ${section}`)) failures.push(`MISSING_RELEASE_NOTE_SECTION ${section}`);
    }
  }

  for (const [relativePath, expected] of Object.entries(HISTORICAL_DIGESTS)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
    if (actual !== expected) failures.push(`CHANGED_HISTORICAL_FIXTURE ${relativePath}`);
  }

  for (const relativePath of walk(root)) {
    let contents;
    try { contents = fs.readFileSync(path.join(root, relativePath), 'utf8'); } catch { continue; }
    if (!contents.includes(PREVIOUS_VERSION)) continue;
    contents.split('\n').forEach((line, index) => {
      if (!line.includes(PREVIOUS_VERSION)) return;
      const classification = previousVersionClassification(relativePath, line);
      if (classification === 'current-version-drift') failures.push(`CURRENT_VERSION_DRIFT_TEXT ${relativePath}:${index + 1}`);
      else if (classification) classifications.push({ path: relativePath, line: index + 1, classification });
      else failures.push(`UNCLASSIFIED_PREVIOUS_VERSION ${relativePath}:${index + 1}`);
    });
  }
  return { product: 'LazyTrae', release_version: RELEASE_VERSION, status: failures.length ? 'fail' : 'pass', failures, classifications };
}

if (require.main === module) {
  const report = classify(path.resolve(process.argv[2] || path.join(__dirname, '../../../..')));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'pass' ? 0 : 1;
}

module.exports = { classify };
