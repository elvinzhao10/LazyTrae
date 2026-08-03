const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

const CLI_ROOT = path.resolve(__dirname, '..');
const LOCAL_LAUNCHER = path.join(CLI_ROOT, 'bin', 'lazytrae.js');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = require('node:child_process').spawnSync(command, args, {
    cwd: options.cwd || CLI_ROOT,
    encoding: 'utf8',
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('packed release carries the automatic-tooling contract, adapters, and CLI surfaces', () => {
  // Given: the publishable CLI package.
  const output = run(npm, ['pack', '--dry-run', '--json']);
  const [packageInfo] = JSON.parse(output);
  const files = new Set(packageInfo.files.map(file => file.path));

  // When: its publish manifest is inspected.
  // Then: the self-contained contract and runtime entry points are present.
  for (const file of [
    'LICENSE',
    'NOTICE',
    'contracts/automatic-tooling-contract.v1.json',
    'contracts/automatic-tooling-contract.v1.json.sha256',
    'contracts/lazyseries-capability-readiness.v1.json',
    'contracts/lazyseries-capability-readiness.v1.json.sha256',
    'contracts/lazyseries-capability-readiness.v2.json',
    'contracts/lazyseries-capability-readiness.v2.json.sha256',
    'contracts/paired-candidate-contract.v1.schema.json',
    'contracts/paired-candidate-contract.v1.schema.json.sha256',
    'contracts/validate-paired-candidate.js',
    'contracts/fixtures/readiness-v2/sha256sums.txt',
    'templates/AGENTS.md',
    'templates/mcp.json',
    'bin/lazytrae.js',
    'src/index.js',
    'src/mcp/index.js',
    'src/commands/setup.js',
    'src/commands/providers.js',
    'src/lib/automatic-tooling-broker.js',
    'src/lib/automatic-tooling-policy.js',
    'src/lib/readiness-v2-contract.js',
    'src/lib/provider-lifecycle.js',
  ]) assert.equal(files.has(file), true, `${file} must be packed`);
});

test('package-local legal records exactly preserve the repository records', () => {
  const repositoryRoot = path.resolve(CLI_ROOT, '..', '..', '..');

  for (const record of ['LICENSE', 'NOTICE']) {
    assert.deepEqual(
      fs.readFileSync(path.join(CLI_ROOT, record)),
      fs.readFileSync(path.join(repositoryRoot, record)),
      `${record} must remain byte-identical to the repository record`,
    );
  }
});

test('init onboarding installs only the core MCP declaration and leaves remote capability state disabled', () => {
  // Given: a clean project with a credential-shaped environment variable.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-init-'));
  fs.mkdirSync(path.join(project, '.git'));
  const environment = { ...process.env, CONTEXT7_API_KEY: 'SENTINEL_NEVER_PRINT_84d1' };
  try {
    // When: the real package onboarding command runs.
    const initialized = runCli(['init', '--host', 'ide'], { cwd: project, env: environment });

    // Then: it copies package assets without enabling remote MCP services or exposing secrets.
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.doesNotMatch(`${initialized.stdout}${initialized.stderr}`, /SENTINEL_NEVER_PRINT_84d1/);
    const mcp = JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'));
    assert.deepEqual(
      { command: mcp.mcpServers.lazytrae.command, args: mcp.mcpServers.lazytrae.args },
      { command: 'node', args: [LOCAL_LAUNCHER, '--root', fs.realpathSync(project), 'mcp'] },
    );
    assert.match(mcp.mcpServers.lazytrae._lazytrae.fingerprint, /^sha256:[a-f0-9]{64}$/);
    for (const [name, server] of Object.entries(mcp.mcpServers)) {
      if (name !== 'lazytrae') assert.equal(server.disabled, true, `${name} must remain a disabled placeholder`);
    }
    const state = JSON.parse(fs.readFileSync(path.join(project, '.lazytrae', 'state', 'tooling.json'), 'utf8'));
    assert.deepEqual(state.capabilities, {});
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('onboard and initdeep are CLI-compatible aliases for safe core installation', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-aliases-'));
  fs.mkdirSync(path.join(project, '.git'));
  try {
    const onboard = runCli(['onboard', '--host', 'ide'], { cwd: project });
    const initdeep = runCli(['initdeep', '--host', 'ide'], { cwd: project });

    assert.equal(onboard.status, 0, onboard.stderr);
    assert.equal(initdeep.status, 0, initdeep.stderr);
    assert.equal(fs.existsSync(path.join(project, '.trae', 'commands', 'lazy-init-deep.md')), true);
    const mcp = JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'));
    assert.equal(Object.keys(mcp.mcpServers).filter(name => name !== 'lazytrae').every(name => mcp.mcpServers[name].disabled === true), true);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('packed CLI retains safe onboard and initdeep aliases', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-packed-aliases-'));
  try {
    const [packageInfo] = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', temporaryRoot]));
    const installRoot = path.join(temporaryRoot, 'install');
    run(npm, ['install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund', '--offline', '--package-lock=false', path.join(temporaryRoot, packageInfo.filename)]);
    const binary = path.join(installRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'lazytrae.cmd' : 'lazytrae');
    const project = path.join(temporaryRoot, 'project');
    fs.mkdirSync(path.join(project, '.git'), { recursive: true });
    const onboard = require('node:child_process').spawnSync(binary, ['onboard', '--host', 'ide'], { cwd: project, encoding: 'utf8' });
    const initdeep = require('node:child_process').spawnSync(binary, ['initdeep', '--host', 'ide'], { cwd: project, encoding: 'utf8' });

    assert.equal(onboard.status, 0, onboard.stderr);
    assert.equal(initdeep.status, 0, initdeep.stderr);
    assert.equal(fs.existsSync(path.join(project, '.trae', 'commands', 'lazy-init-deep.md')), true);
  } finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }); }
});

test('packed CLI re-init refuses to overwrite a modified managed command', () => {
  // Given: a project initialized by the installed package, with a caller edit in one managed command.
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-packed-reinit-'));
  try {
    const [packageInfo] = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', temporaryRoot]));
    const installRoot = path.join(temporaryRoot, 'install');
    run(npm, ['install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund', '--offline', '--package-lock=false', path.join(temporaryRoot, packageInfo.filename)]);
    const binary = path.join(installRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'lazytrae.cmd' : 'lazytrae');
    const project = path.join(temporaryRoot, 'project');
    fs.mkdirSync(path.join(project, '.git'), { recursive: true });
    const firstInit = require('node:child_process').spawnSync(binary, ['init', '--host', 'ide'], { cwd: project, encoding: 'utf8' });
    assert.equal(firstInit.status, 0, firstInit.stderr);
    const command = path.join(project, '.trae', 'commands', 'lazy-init-deep.md');
    fs.appendFileSync(command, '\ncaller note\n');

    // When: the installed CLI is run again without an explicit overwrite request.
    const reinit = require('node:child_process').spawnSync(binary, ['init', '--host', 'ide'], { cwd: project, encoding: 'utf8' });

    // Then: the caller edit survives and the CLI refuses the unsafe re-init.
    assert.equal(reinit.status, 1, `${reinit.stdout}${reinit.stderr}`);
    assert.match(`${reinit.stdout}${reinit.stderr}`, /refused to overwrite 1 modified command files .*resolve ownership before retrying/);
    assert.doesNotMatch(`${reinit.stdout}${reinit.stderr}`, /--force/);
    assert.match(fs.readFileSync(command, 'utf8'), /caller note/);

    const forced = require('node:child_process').spawnSync(binary, ['init', '--host', 'ide', '--force'], { cwd: project, encoding: 'utf8' });
    assert.equal(forced.status, 1, `${forced.stdout}${forced.stderr}`);
    assert.match(`${forced.stdout}${forced.stderr}`, /force is not supported/);
    assert.match(fs.readFileSync(command, 'utf8'), /caller note/);
  } finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }); }
});

test('doctor reports redacted provider and approval status after onboarding', () => {
  // Given: an initialized project and an environment credential.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-doctor-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-home-'));
  fs.mkdirSync(path.join(project, '.git'));
  const environment = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, 'config'),
    CONTEXT7_API_KEY: 'SENTINEL_NEVER_PRINT_1bf3',
  };
  try {
    assert.equal(runCli(['init'], { cwd: project, env: environment }).status, 0);

    // When: doctor checks the installed project.
    const doctor = runCli(['doctor'], { cwd: project, env: environment });

    // Then: it identifies the provider policy surface while retaining credential redaction.
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Provider status/);
    assert.match(doctor.stdout, /Approval status/);
    assert.doesNotMatch(`${doctor.stdout}${doctor.stderr}`, /SENTINEL_NEVER_PRINT_1bf3/);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall preserves caller-owned indexes and modified package assets', () => {
  // Given: a project with an InitDeep-style install plus caller-owned artifacts.
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-release-uninstall-'));
  fs.mkdirSync(path.join(project, '.git'));
  try {
    assert.equal(runCli(['init'], { cwd: project }).status, 0);
    const modified = path.join(project, '.trae', 'commands', 'lazy-init-deep.md');
    const index = path.join(project, '.codegraph', 'codegraph.db');
    fs.appendFileSync(modified, '\ncaller note\n');
    fs.mkdirSync(path.dirname(index), { recursive: true });
    fs.writeFileSync(index, 'caller-owned');

    // When: normal uninstall removes package-owned assets.
    const removed = runCli(['uninstall', '--yes'], { cwd: project });

    // Then: it does not guess at or delete caller-owned paths.
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(fs.existsSync(modified), true);
    assert.equal(fs.readFileSync(index, 'utf8'), 'caller-owned');
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});
