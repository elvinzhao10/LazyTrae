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
const HISTORICAL_BANNER = /^> \*\*Historical record \(non-operational\):\*\*/m;
const UNSUPPORTED_HOST_API = /\b(?:SearchCodebase|RunCommand|WebSearch|WebFetch|Defuddle|TodoWrite|OpenPreview)\b/;
const EXTERNAL_CAPABILITIES = ['context7', 'grep_app', 'filesystem', 'playwright'];

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

function relativeFromRepo(filePath) {
  return path.relative(MONOREPO_ROOT, filePath).split(path.sep).join('/');
}

function legacyReferenceOffenders(records) {
  return records
    .filter(({ relativePath, content }) => LEGACY_REFERENCE.test(content) && !isHistoricalArchiveRecord(relativePath, content))
    .map(({ relativePath }) => relativePath)
    .sort();
}

function isHistoricalArchiveRecord(relativePath, content) {
  return HISTORICAL_ARCHIVES.has(relativePath) && HISTORICAL_BANNER.test(content);
}

function inventoryRecords(entries) {
  return entries
    .flatMap((entry) => fs.statSync(entry).isDirectory() ? walkFiles(entry) : [entry])
    .map((filePath) => ({
      relativePath: relativeFromRepo(filePath),
      content: fs.readFileSync(filePath, 'utf8'),
    }));
}

test('legacy-reference inventory rejects active guidance and unlabeled archives', () => {
  const activeInstruction = {
    relativePath: 'docs/current-setup.md',
    content: 'Follow the LazyCodex workflow for this project.',
  };
  const unlabeledArchive = {
    relativePath: 'docs/archive/lazytrae-dogfood-plan.md',
    content: 'This plan was adapted from OmO guidance.',
  };
  const namedHistoricalArchive = {
    relativePath: 'docs/archive/lazytrae-dogfood-plan.md',
    content: '> **Historical record (non-operational):** Archived for study only.\nAdapted from OmO guidance.',
  };
  const unlistedHistoricalArchive = {
    relativePath: 'docs/archive/newly-added-record.md',
    content: '> **Historical record (non-operational):** Archived for study only.\nAdapted from OmO guidance.',
  };

  assert.deepEqual(legacyReferenceOffenders([activeInstruction]), ['docs/current-setup.md']);
  assert.deepEqual(legacyReferenceOffenders([unlabeledArchive]), ['docs/archive/lazytrae-dogfood-plan.md']);
  assert.deepEqual(legacyReferenceOffenders([namedHistoricalArchive]), []);
  assert.deepEqual(legacyReferenceOffenders([unlistedHistoricalArchive]), ['docs/archive/newly-added-record.md']);
});

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

test('active installable surfaces, documentation, and runtime source allow only named historical records', () => {
  const inventory = inventoryRecords([
    path.join(MONOREPO_ROOT, 'AGENTS.md'),
    path.join(MONOREPO_ROOT, 'README.md'),
    path.join(MONOREPO_ROOT, 'lazytrae-evaluation.md'),
    path.join(MONOREPO_ROOT, 'docs'),
    path.join(REPO_ROOT, '.trae'),
    path.join(REPO_ROOT, '.lazytrae'),
    path.join(REPO_ROOT, 'packages/cli/AGENTS.md'),
    path.join(REPO_ROOT, 'packages/cli/templates'),
    path.join(REPO_ROOT, 'packages/cli/src'),
    path.join(REPO_ROOT, 'packages/mcp/src'),
  ]);

  assert.deepEqual(legacyReferenceOffenders(inventory), []);
});

test('published guidance matches the explicit external-capability contract', () => {
  const templateRoot = path.join(REPO_ROOT, 'packages/cli/templates');
  const mcp = JSON.parse(fs.readFileSync(path.join(templateRoot, 'mcp.json'), 'utf8'));
  const servers = mcp.mcpServers;
  const executable = Object.entries(servers)
    .filter(([, server]) => Object.hasOwn(server, 'command'))
    .map(([name]) => name);

  assert.equal(Object.keys(servers).length, 8, 'base config must retain eight declarations');
  assert.deepEqual(executable, ['lazytrae'], 'only the core server may be executable by default');
  for (const capability of EXTERNAL_CAPABILITIES) {
    assert.equal(servers[capability].disabled, true, `${capability} must be disabled by default`);
    assert.equal(Object.hasOwn(servers[capability], 'command'), false, `${capability} must not have a default command`);
  }

  const initDeep = fs.readFileSync(path.join(templateRoot, 'skills/lazy-init-deep/SKILL.md'), 'utf8');
  assert.match(initDeep, /Do NOT enable optional MCP\s+capabilities or install external dependencies during InitDeep/);

  const packageReadme = fs.readFileSync(path.join(REPO_ROOT, 'packages/cli/README.md'), 'utf8');
  assert.match(packageReadme, /8 MCP declarations; one executable core server and seven disabled placeholders/);

  const rootReadme = fs.readFileSync(path.join(MONOREPO_ROOT, 'README.md'), 'utf8');
  assert.match(rootReadme, /\| CLI \| 17 \|/);

  const guidance = inventoryRecords([
    path.join(MONOREPO_ROOT, 'AGENTS.md'),
    path.join(MONOREPO_ROOT, 'README.md'),
    path.join(MONOREPO_ROOT, 'lazytrae-evaluation.md'),
    path.join(REPO_ROOT, 'packages/cli/README.md'),
    path.join(REPO_ROOT, '.trae/agents'),
    path.join(REPO_ROOT, '.trae/skills'),
    path.join(templateRoot, 'agents'),
    path.join(templateRoot, 'skills'),
  ]);
  for (const record of guidance) {
    assert.doesNotMatch(record.content, UNSUPPORTED_HOST_API, `${record.relativePath} names an unsupported host API`);
    assert.doesNotMatch(record.content, /\.omo\//, `${record.relativePath} retains an obsolete operational path`);
  }
});
