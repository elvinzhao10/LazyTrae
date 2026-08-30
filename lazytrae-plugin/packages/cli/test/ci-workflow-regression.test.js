const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const WORKFLOW_PATH = path.resolve(CLI_ROOT, '..', '..', '..', '.github', 'workflows', 'ci.yml');
const RELEASE_WORKFLOW_PATH = path.resolve(CLI_ROOT, '..', '..', '..', '.github', 'workflows', 'release.yml');
const PINNED_ACTION = /uses:\s+[\w/-]+@[0-9a-f]{40}\s*$/gm;
const FORBIDDEN_ACTIONS = [
  [/\bnpm\s+publish\b/i, 'npm publish'],
  [/\b(?:gh\s+release|actions\/create-release|softprops\/action-gh-release|release:)\b/i, 'release action'],
  [/\b(?:git\s+tag|refs\/tags|tags:)\b/i, 'tag action'],
  [/\b(?:repository:|lazybuddy)\b/i, 'sibling checkout'],
  [/\blazytrae\s+(?:tooling\s+enable|tooling\s+codegraph-init|providers)\b/i, 'optional-tool activation'],
];

function parseYaml(contents) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-ci-workflow-'));
  const candidate = path.join(temporaryDirectory, 'ci.yml');
  fs.writeFileSync(candidate, contents);
  try {
    const parsed = childProcess.spawnSync('ruby', [
      '-e', 'require "yaml"; YAML.load_file(ARGV.fetch(0))', candidate,
    ], { encoding: 'utf8' });
    assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout || 'Ruby YAML parser rejected workflow');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function jobBlock(contents, name) {
  const start = contents.indexOf(`  ${name}:\n`);
  assert.notEqual(start, -1, `workflow must contain the ${name} job`);
  const remainder = contents.slice(start + 1);
  const next = remainder.search(/\n  [a-z][a-z0-9-]*:\n/);
  return next === -1 ? contents.slice(start) : contents.slice(start, start + 1 + next);
}

function assertJob(block, { nodeVersion, lockfile, commands }) {
  assert.match(block, /^    runs-on: ubuntu-latest$/m);
  assert.match(block, /^    timeout-minutes: (?:10|15)$/m);
  assert.match(block, new RegExp(`^          node-version: ${nodeVersion}$`, 'm'));
  assert.match(block, new RegExp(`^          cache-dependency-path: ${lockfile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  for (const command of commands) {
    assert.match(block, new RegExp(`^      - run: ${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `job must run ${command}`);
  }
}

function validateWorkflow(contents) {
  parseYaml(contents);
  assert.match(contents, /^  cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}$/m);
  assert.equal(contents.match(PINNED_ACTION)?.length, 8, 'every checkout/setup action must use a full SHA pin');
  assertJob(jobBlock(contents, 'cli'), {
    nodeVersion: 22,
    lockfile: 'lazytrae-plugin/packages/cli/package-lock.json',
    commands: ['npm ci --ignore-scripts', 'npm run test:all', 'npm run test:publication'],
  });
  assertJob(jobBlock(contents, 'cli-current-lts'), {
    nodeVersion: 24,
    lockfile: 'lazytrae-plugin/packages/cli/package-lock.json',
    commands: ['npm ci --ignore-scripts', 'npm run test:all', 'npm run test:publication'],
  });
  assertJob(jobBlock(contents, 'mcp'), {
    nodeVersion: 22,
    lockfile: 'lazytrae-plugin/packages/mcp/package-lock.json',
    commands: ['npm ci --ignore-scripts', 'npm test'],
  });
  const packageJob = jobBlock(contents, 'package');
  assertJob(packageJob, {
    nodeVersion: 22,
    lockfile: 'lazytrae-plugin/packages/cli/package-lock.json',
    commands: ['npm ci --ignore-scripts'],
  });
  assert.match(packageJob, /npm pack --json --pack-destination/);
  assert.doesNotMatch(packageJob, /npm pack --dry-run/);
  assert.match(packageJob, /for member in package\/package\.json package\/bin\/lazytrae\.js package\/src\/index\.js package\/LICENSE package\/NOTICE package\/README\.md; do/);
  assert.match(packageJob, /tar -tzf "\$tarball" \| grep -Fx "\$member"/);
  assert.match(packageJob, /npm install --prefix "\$consumer_root" --ignore-scripts --no-audit --no-fund --offline --package-lock=false "\$tarball"/);
  assert.match(packageJob, /node_modules\/\.bin\/lazytrae" --help/);
  for (const [pattern, label] of FORBIDDEN_ACTIONS) {
    assert.doesNotMatch(contents, pattern, `workflow must not contain ${label}`);
  }
}

test('pull-request workflow has pinned Linux CLI, MCP, and exact-package gates', () => {
  validateWorkflow(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
});

test('release workflow runs the full CLI and standalone MCP runtime suites', () => {
  const contents = fs.readFileSync(RELEASE_WORKFLOW_PATH, 'utf8');
  parseYaml(contents);
  for (const command of ['npm run test:all', 'npm test --prefix ../mcp']) {
    assert.match(contents, new RegExp(`^\\s*(?:-\\s+)?run:\\s*${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'), `release workflow must run ${command}`);
  }
});

test('workflow regression rejects missing gates, unpinned actions, and dry-run package checks', () => {
  const contents = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  assert.throws(() => validateWorkflow('jobs: [invalid'), /Psych::SyntaxError/);
  assert.throws(() => validateWorkflow(contents.replace('      - run: npm run test:all\n', '')), /job must run npm run test:all/);
  assert.throws(() => validateWorkflow(contents.replace('      - run: npm test\n', '')), /job must run npm test/);
  assert.throws(() => validateWorkflow(contents.replace('npm pack --json --pack-destination', 'npm pack --dry-run --json --pack-destination')), /npm pack --dry-run/);
  assert.throws(() => validateWorkflow(contents.replace('package/bin/lazytrae.js ', '')), /for member in/);
  assert.throws(() => validateWorkflow(contents.replace('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', 'actions/checkout@v4')), /full SHA pin/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: npm publish\n`), /npm publish/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: gh release create v0.18.0\n`), /release action/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: git tag v0.18.0\n`), /tag action/);
  assert.throws(() => validateWorkflow(`${contents}\n      - uses: actions/checkout@v4\n        with:\n          repository: example/LazyBuddy\n`), /sibling checkout/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: lazytrae tooling enable codegraph\n`), /optional-tool activation/);
});
