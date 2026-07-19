const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const MCP_JSON_BEGIN = 'LAZYTRAE_MCP_JSON_BEGIN';
const MCP_JSON_END = 'LAZYTRAE_MCP_JSON_END';

function runLauncher(launcher, args, options) {
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      HOME: options.home,
      PATH: path.dirname(process.execPath),
      npm_config_update_notifier: 'false',
    },
  });
}

function extractMcpJson(output) {
  const start = output.indexOf(`${MCP_JSON_BEGIN}\n`);
  const end = output.indexOf(`\n${MCP_JSON_END}`, start);
  assert.notEqual(start, -1, `missing ${MCP_JSON_BEGIN} marker in:\n${output}`);
  assert.notEqual(end, -1, `missing ${MCP_JSON_END} marker in:\n${output}`);
  return JSON.parse(output.slice(start + MCP_JSON_BEGIN.length + 1, end));
}

function assertLocalCoreConfiguration(config, launcher, project) {
  assert.deepEqual(Object.keys(config), ['mcpServers']);
  assert.deepEqual(Object.keys(config.mcpServers), ['lazytrae']);
  assert.deepEqual(config.mcpServers.lazytrae, {
    command: 'node',
    args: [fs.realpathSync(launcher), '--root', fs.realpathSync(project), 'mcp'],
  });
  assert.equal(path.isAbsolute(config.mcpServers.lazytrae.args[0]), true);
  assert.doesNotMatch(JSON.stringify(config), /"command":"lazytrae"/);
}

test('Work and CLI host adapters emit paste-ready local JSON for paths with spaces', () => {
  // Given: a permanent release and project whose paths contain spaces, with no Trae CLI binary.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae host adapter spaces '));
  const release = path.join(root, 'LazyTrae Release 1.0.2');
  const project = path.join(root, 'Consumer Project');
  const caller = path.join(root, 'Unrelated Caller');
  const home = path.join(root, 'Home');
  const skillsDir = path.join(root, 'Unapproved Work Skills');
  fs.cpSync(CLI_ROOT, release, { recursive: true });
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  fs.mkdirSync(caller);
  fs.mkdirSync(home);
  fs.mkdirSync(skillsDir);
  const launcher = path.join(release, 'bin', 'lazytrae.js');

  try {
    const initialized = runLauncher(launcher, ['--root', project, 'init', '--host', 'ide'], { cwd: caller, home });
    assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);

    // When: each manual host adapter reports from a node-only PATH.
    const cli = runLauncher(launcher, ['--root', project, 'load-check', '--host', 'cli'], { cwd: caller, home });
    const work = runLauncher(launcher, [
      '--root', project, 'load-check', '--host', 'work', '--skills-dir', skillsDir,
    ], { cwd: caller, home });

    // Then: both blocks parse to the same absolute local command, while Work remains non-mutating.
    assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
    assert.equal(work.status, 1, `${work.stdout}\n${work.stderr}`);
    assertLocalCoreConfiguration(extractMcpJson(cli.stdout), launcher, project);
    assertLocalCoreConfiguration(extractMcpJson(work.stdout), launcher, project);
    assert.doesNotMatch(cli.stdout, /trae-cli mcp add-json/);
    assert.match(cli.stdout, /CLI MCP ROUTE: CONFIGURATION JSON ONLY/);
    assert.match(work.stdout, /WORK SKILLS ACTION: APPROVAL REQUIRED/);
    assert.doesNotMatch(work.stdout, /Package readiness failed[^\n]* sync/);
    assert.match(cli.stdout, /HOST PENDING/);
    assert.match(work.stdout, /HOST PENDING/);
    assert.deepEqual(fs.readdirSync(skillsDir), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a moved release is reported and its CLI JSON points only at the new launcher', () => {
  // Given: a project configured by a release that is moved after initialization.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae host moved '));
  const oldRelease = path.join(root, 'Old Release');
  const newRelease = path.join(root, 'New Release');
  const project = path.join(root, 'Project With Spaces');
  const caller = path.join(root, 'Caller');
  const home = path.join(root, 'Home');
  fs.cpSync(CLI_ROOT, oldRelease, { recursive: true });
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  fs.mkdirSync(caller);
  fs.mkdirSync(home);

  try {
    const oldLauncher = path.join(oldRelease, 'bin', 'lazytrae.js');
    const initialized = runLauncher(oldLauncher, ['--root', project, 'init', '--host', 'ide'], { cwd: caller, home });
    assert.equal(initialized.status, 0, `${initialized.stdout}\n${initialized.stderr}`);
    const stale = JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'))
      .mcpServers.lazytrae;
    fs.renameSync(oldRelease, newRelease);

    // When: the missing old launcher is invoked and the moved release runs the CLI package check.
    const staleStart = spawnSync(stale.command, stale.args, {
      cwd: caller,
      encoding: 'utf8',
      env: { HOME: home, PATH: path.dirname(process.execPath) },
    });
    const newLauncher = path.join(newRelease, 'bin', 'lazytrae.js');
    const checked = runLauncher(newLauncher, [
      '--root', project, 'load-check', '--host', 'cli',
    ], { cwd: caller, home });

    // Then: the old path fails, the package check names stale state, and remediation JSON uses only the new release.
    assert.notEqual(staleStart.status, 0);
    assert.equal(checked.status, 1, checked.stdout);
    assert.match(`${checked.stdout}${checked.stderr}`, /stale|missing/i);
    const currentConfiguration = extractMcpJson(checked.stdout);
    assertLocalCoreConfiguration(currentConfiguration, newLauncher, project);
    assert.doesNotMatch(JSON.stringify(currentConfiguration), new RegExp(oldRelease.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('canonical host-route docs classify documented, observed, and pending states without an add-json command', () => {
  // Given: the focused host adapter guides shipped to maintainers and initialized projects.
  const paths = [
    path.resolve(CLI_ROOT, 'templates', 'AGENTS.md'),
    path.resolve(CLI_ROOT, '..', '..', '..', 'README.md'),
    path.resolve(CLI_ROOT, '..', '..', '..', 'docs', '03-install-and-host-verification.md'),
    path.resolve(CLI_ROOT, '..', '..', '..', 'docs', '10-host-capability-matrix.md'),
    path.resolve(CLI_ROOT, '..', '..', '..', 'docs', 'reference', 'host-routes.md'),
  ];

  // When: their host-availability contract is inspected.
  const documents = paths.map(documentPath => fs.readFileSync(documentPath, 'utf8'));

  // Then: each keeps the three evidence classes explicit and never prescribes the undocumented command.
  for (const [index, document] of documents.entries()) {
    assert.match(document, /documented/i, paths[index]);
    assert.match(document, /observed prerelease/i, paths[index]);
    assert.match(document, /HOST\s+READINESS:\s*PENDING/i, paths[index]);
    assert.doesNotMatch(document, /trae-cli mcp add-json/, paths[index]);
  }
});
