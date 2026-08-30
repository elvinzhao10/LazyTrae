const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const WORKFLOW_PATH = path.resolve(CLI_ROOT, '..', '..', '..', '.github', 'workflows', 'ci.yml');
const RELEASE_WORKFLOW_PATH = path.resolve(CLI_ROOT, '..', '..', '..', '.github', 'workflows', 'release.yml');
const REQUIRED_COMMANDS = [
  'npm ci --ignore-scripts',
  'npm run test:all',
  'npm test --prefix ../mcp',
  'npm run test:publication',
  'npm pack --dry-run --json',
];
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

function validateWorkflow(contents) {
  parseYaml(contents);
  assert.match(contents, /^\s*runs-on:\s*macos-latest\s*$/m, 'workflow must use the documented macOS runner');
  assert.match(contents, /^\s*working-directory:\s*lazytrae-plugin\/packages\/cli\s*$/m, 'workflow commands must run from the CLI package');
  for (const command of REQUIRED_COMMANDS) {
    assert.match(contents, new RegExp(`^\\s*(?:-\\s+)?run:\\s*${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'), `workflow must run ${command}`);
  }
  for (const [pattern, label] of FORBIDDEN_ACTIONS) {
    assert.doesNotMatch(contents, pattern, `workflow must not contain ${label}`);
  }
}

test('publication-readiness workflow is macOS-only, package-local, and non-publishing', () => {
  const contents = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  validateWorkflow(contents);
});

test('release workflow runs the full CLI and standalone MCP runtime suites', () => {
  const contents = fs.readFileSync(RELEASE_WORKFLOW_PATH, 'utf8');
  parseYaml(contents);
  for (const command of ['npm run test:all', 'npm test --prefix ../mcp']) {
    assert.match(contents, new RegExp(`^\\s*(?:-\\s+)?run:\\s*${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'), `release workflow must run ${command}`);
  }
});

test('workflow regression rejects omitted verification and prohibited publication or capability actions', () => {
  const contents = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  assert.throws(() => validateWorkflow('jobs: [invalid'), /Psych::SyntaxError/);
  assert.throws(() => validateWorkflow(contents.replace(
    '      - name: Full CLI verification\n        run: npm run test:all\n',
    '',
  )), /workflow must run npm run test:all/);
  assert.throws(() => validateWorkflow(contents.replace(
    '      - name: Standalone MCP runtime tests\n        run: npm test --prefix ..\/mcp\n',
    '',
  )), /workflow must run npm test --prefix \.\.\/mcp/);
  assert.throws(() => validateWorkflow(contents.replace(
    '      - name: Publication documentation checks\n        run: npm run test:publication\n',
    '',
  )), /workflow must run npm run test:publication/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: npm publish\n`), /npm publish/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: gh release create v0.18.0\n`), /release action/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: git tag v0.18.0\n`), /tag action/);
  assert.throws(() => validateWorkflow(`${contents}\n      - uses: actions/checkout@v4\n        with:\n          repository: example/LazyBuddy\n`), /sibling checkout/);
  assert.throws(() => validateWorkflow(`${contents}\n      - run: lazytrae tooling enable codegraph\n`), /optional-tool activation/);
});
