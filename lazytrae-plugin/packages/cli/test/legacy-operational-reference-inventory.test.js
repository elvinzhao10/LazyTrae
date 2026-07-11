const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { MONOREPO_ROOT, REPO_ROOT, runCli } = require('./test-helpers');

const LEGACY_REFERENCE = /lazycodex|\bomo\b|dev\/reference\/lazycodex|old checkout|reference\/lazycodex/i;
const HISTORICAL_ARCHIVES = new Set([
  'docs/archive/lazytrae-diagnosis-evaluation-vs-lazycodex-lazyworkbuddy.md',
  'docs/archive/lazytrae-dogfood-plan.md',
  'docs/archive/lazytrae-dogfood-review.md',
]);

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

function relativeFromRepo(filePath) {
  return path.relative(MONOREPO_ROOT, filePath).split(path.sep).join('/');
}

const OPERATIONAL_SOURCES = [
  'packages/cli/package.json',
  'packages/cli/README.md',
  'packages/cli/src/index.js',
  'packages/cli/src/commands/loop.js',
  'packages/cli/src/lib/loop-quality.js',
  'packages/cli/src/mcp/handlers-context.js',
  'packages/mcp/src/handlers-context.js',
];

test('operational CLI and MCP sources use LazyTrae-native names', () => {
  const help = runCli(['--help']);
  const loopHelp = runCli(['loop', '--help']);

  assert.equal(help.status, 0);
  assert.match(help.stdout, /Trae-native workflows/);
  assert.doesNotMatch(help.stdout, /lazycodex|\bomo\b/i);
  assert.equal(loopHelp.status, 0);
  assert.match(loopHelp.stdout, /canonical steering mutation/);
  assert.doesNotMatch(loopHelp.stdout, /lazycodex|\bomo\b/i);

  for (const relativePath of OPERATIONAL_SOURCES) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /lazycodex|\bomo\b/i, relativePath);
  }
});

test('active installable surfaces and current guides contain no legacy harness references', () => {
  const activeFiles = [
    path.join(MONOREPO_ROOT, 'AGENTS.md'),
    path.join(MONOREPO_ROOT, 'README.md'),
    path.join(MONOREPO_ROOT, 'lazytrae-evaluation.md'),
    path.join(REPO_ROOT, '.trae'),
    path.join(REPO_ROOT, '.lazytrae'),
    path.join(REPO_ROOT, 'packages/cli/AGENTS.md'),
    path.join(REPO_ROOT, 'packages/cli/templates'),
  ].flatMap((entry) => fs.statSync(entry).isDirectory() ? walkFiles(entry) : [entry]);

  const currentGuideFiles = walkFiles(path.join(MONOREPO_ROOT, 'docs'))
    .filter((filePath) => !relativeFromRepo(filePath).startsWith('docs/archive/'));

  const offenders = [...new Set([...activeFiles, ...currentGuideFiles])]
    .filter((filePath) => LEGACY_REFERENCE.test(fs.readFileSync(filePath, 'utf8')))
    .map(relativeFromRepo)
    .sort();

  assert.deepEqual(offenders, []);

  const matchingArchives = walkFiles(path.join(MONOREPO_ROOT, 'docs/archive'))
    .filter((filePath) => LEGACY_REFERENCE.test(fs.readFileSync(filePath, 'utf8')))
    .map(relativeFromRepo)
    .sort();

  assert.deepEqual(matchingArchives, [...HISTORICAL_ARCHIVES].sort());
  for (const archive of matchingArchives) {
    assert.match(fs.readFileSync(path.join(MONOREPO_ROOT, archive), 'utf8'), /historical/i, archive);
  }
});
