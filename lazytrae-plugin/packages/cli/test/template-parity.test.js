const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT, runCli } = require('./test-helpers');

function readFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.DS_Store') return [];
    const relativePath = path.join(prefix, entry.name);
    return entry.isDirectory()
      ? readFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  }).sort();
}

const EXACT_NPM_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function assertSafeMcpDefaults(mcpServers) {
  for (const [name, server] of Object.entries(mcpServers)) {
    if (server.disabled) {
      assert.equal(
        Object.hasOwn(server, 'command'),
        false,
        `${name} is disabled but still declares an executable command`,
      );
      assert.equal(
        Object.hasOwn(server, 'args'),
        false,
        `${name} is disabled but still declares executable arguments`,
      );
      continue;
    }
    if (server.command !== 'npx') continue;
    const packageName = server.args.find(argument =>
      typeof argument === 'string' && argument.startsWith('@'),
    );
    const version = packageName?.slice(packageName.lastIndexOf('@') + 1) ?? '';
    assert.match(
      packageName ?? '',
      /^@[^@/]+\/[^@/]+@.+$/,
      `${name} must pin its npx package to an exact version or be disabled`,
    );
    assert.match(
      version,
      EXACT_NPM_VERSION,
      `${name} must use an exact npm version, not a range or mutable tag`,
    );
  }
}

test('templates mirror every repository .trae artifact', () => {
  const source = readFiles(path.join(REPO_ROOT, '.trae'));
  const templates = readFiles(path.join(REPO_ROOT, 'packages', 'cli', 'templates'))
    .filter(relativePath => !['AGENTS.md', 'config.json'].includes(relativePath))
    .filter(relativePath => !['evidence', 'schemas', 'state'].includes(relativePath.split(path.sep)[0]));

  assert.deepEqual(templates, source);
  for (const relativePath of source) {
    assert.equal(
      fs.readFileSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', relativePath), 'utf8'),
      fs.readFileSync(path.join(REPO_ROOT, '.trae', relativePath), 'utf8'),
      `${relativePath} diverges from .trae`,
    );
  }
});

test('generated onboarding guide uses stable Markdown references', () => {
  const guide = fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'AGENTS.md'),
    'utf8',
  );
  const localMarkdownLinks = [...guide.matchAll(/\]\((?!https?:\/\/)([^)#]+\.md)(?:#[^)]*)?\)/g)]
    .map(match => match[1]);

  assert.deepEqual(
    localMarkdownLinks,
    [],
    'the installed guide must not link to documentation absent from a consumer project',
  );
});

test('MCP templates have no unbounded active npx defaults', () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, '.trae', 'mcp.json'), 'utf8'),
  );

  assertSafeMcpDefaults(config.mcpServers);

  const lazytrae = config.mcpServers.lazytrae;
  assert.deepEqual(
    { command: lazytrae.command, args: lazytrae.args },
    { command: 'lazytrae', args: ['mcp'] },
    'the generated configuration must retain the LazyTrae MCP entrypoint',
  );
});

test('MCP default guard rejects ranges, mutable tags, and disabled executables', () => {
  for (const selector of ['^1.2.3', '~1.2.3', 'latest', 'next']) {
    assert.throws(
      () => assertSafeMcpDefaults({
        optional: { command: 'npx', args: ['-y', `@example/mcp@${selector}`] },
      }),
      /exact npm version/,
      `must reject ${selector}`,
    );
  }
  assert.throws(
    () => assertSafeMcpDefaults({
      manual: { disabled: true, command: 'echo', args: ['placeholder'] },
    }),
    /disabled but still declares an executable command/,
  );
});

test('public CLI version banners match the package version', () => {
  const version = require('../package.json').version;
  const expected = `v${version}`;
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-version-uninstall-'));
  fs.mkdirSync(path.join(fixture, '.git'));
  try {
    for (const args of [[], ['init'], ['sync'], ['doctor'], ['uninstall', '--yes']]) {
      const result = runCli(args, { cwd: fixture });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(expected.replaceAll('.', '\\.')));
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('fresh init is self-contained for doctor, sync, and context recovery', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-fresh-install-'));
  fs.mkdirSync(path.join(fixture, '.git'));

  try {
    const init = runCli(['init'], { cwd: fixture });
    assert.equal(init.status, 0, init.stderr);
    assert.match(init.stdout, /LazyTrae Tool Load Check/);
    assert.match(init.stdout, /Load check passed/);
    const installedMcp = JSON.parse(
      fs.readFileSync(path.join(fixture, '.trae', 'mcp.json'), 'utf8'),
    );
    assert.deepEqual(
      {
        command: installedMcp.mcpServers.lazytrae.command,
        args: installedMcp.mcpServers.lazytrae.args,
      },
      { command: 'lazytrae', args: ['mcp'] },
      'init must retain the LazyTrae MCP entrypoint',
    );
    for (const relativePath of readFiles(path.join(REPO_ROOT, '.trae'))) {
      assert.equal(
        fs.readFileSync(path.join(fixture, '.trae', relativePath), 'utf8'),
        fs.readFileSync(path.join(REPO_ROOT, '.trae', relativePath), 'utf8'),
        `${relativePath} was not installed from the template`,
      );
    }

    fs.rmSync(path.join(fixture, '.trae', 'commands', 'lazy-start-work.md'));
    const incompleteLoad = runCli(['load-check'], { cwd: fixture });
    assert.equal(incompleteLoad.status, 1);
    assert.match(incompleteLoad.stdout, /FAIL commands: 8\/9/);

    const repairBeforeDoctor = runCli(['sync'], { cwd: fixture });
    assert.equal(repairBeforeDoctor.status, 0, repairBeforeDoctor.stderr);

    const doctor = runCli(['doctor'], { cwd: fixture });
    assert.equal(doctor.status, 0, doctor.stdout);
    assert.doesNotMatch(doctor.stdout, /packages\/mcp\/src\//);

    const marked = runCli(['hook', 'user-prompt-submit'], {
      cwd: fixture,
      input: JSON.stringify({ prompt: 'The context_length_exceeded marker appeared.' }),
    });
    assert.equal(marked.status, 0, marked.stderr);
    assert.match(marked.stdout, /Context pressure detected/);
    const recovered = runCli(['hook', 'recover-context'], { cwd: fixture });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.match(recovered.stdout, /Post-compact recovery needed/);

    fs.rmSync(path.join(fixture, '.trae', 'hooks', 'context-recovery.sh'));
    fs.rmSync(path.join(fixture, '.trae', 'hooks.json'));
    fs.rmSync(path.join(fixture, '.trae', 'mcp.json'));
    fs.rmSync(path.join(fixture, '.lazytrae', 'state', 'active-loop.json'));
    const sessionsBeforeSync = fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'sessions.json'), 'utf8');
    const sync = runCli(['sync'], { cwd: fixture });
    assert.equal(sync.status, 0, sync.stderr);
    for (const relativePath of [
      '.trae/hooks/context-recovery.sh',
      '.trae/hooks.json',
      '.trae/mcp.json',
      '.lazytrae/state/active-loop.json',
    ]) {
      assert.equal(fs.existsSync(path.join(fixture, relativePath)), true, `${relativePath} was not restored`);
    }
    assert.equal(
      fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'sessions.json'), 'utf8'),
      sessionsBeforeSync,
      'sync must not overwrite consumer session state',
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
