const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { materializeHook } = require('../src/lib/local-launcher');
const { REPO_ROOT, makeFixture, makeGitFixture, runCli } = require('./test-helpers');
const LOCAL_LAUNCHER = path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'lazytrae.js');

function readFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.DS_Store') return [];
    const relativePath = path.join(prefix, entry.name);
    return entry.isDirectory()
      ? readFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  }).sort();
}

function readTraeTemplateFiles() {
  return readFiles(path.join(REPO_ROOT, 'packages', 'cli', 'templates'))
    .filter(relativePath => !['AGENTS.md', 'config.json', 'hooks.json'].includes(relativePath))
    .filter(relativePath => !['evidence', 'schemas', 'state'].includes(relativePath.split(path.sep)[0]));
}

function expectedTemplate(relativePath) {
  const content = fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', relativePath),
    'utf8',
  );
  return relativePath === path.join('hooks', 'user-prompt-submit.sh')
    ? materializeHook(content)
    : content;
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

function assertMaterializedMcp(project) {
  const server = JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'))
    .mcpServers.lazytrae;
  assert.deepEqual(
    { command: server.command, args: server.args },
    { command: 'node', args: [LOCAL_LAUNCHER, '--root', fs.realpathSync(project), 'mcp'] },
  );
  assert.match(server._lazytrae.fingerprint, /^sha256:[a-f0-9]{64}$/);
}

test('test fixtures bootstrap managed files from package templates', () => {
  const fixture = makeFixture('lazytrae-template-fixture-');

  try {
    assert.deepEqual(readFiles(path.join(fixture, '.trae')), readTraeTemplateFiles());
    for (const relativePath of readTraeTemplateFiles()) {
      if (relativePath === 'mcp.json') {
        assertMaterializedMcp(fixture);
        continue;
      }
      assert.equal(
        fs.readFileSync(path.join(fixture, '.trae', relativePath), 'utf8'),
        expectedTemplate(relativePath),
        `${relativePath} was not bootstrapped from its package template`,
      );
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('fresh install matches every managed package template', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-template-install-'));
  fs.mkdirSync(path.join(fixture, '.git'));

  try {
    const init = runCli(['init'], { cwd: fixture });
    assert.equal(init.status, 0, init.stderr);
    const templates = readTraeTemplateFiles();
    assert.deepEqual(readFiles(path.join(fixture, '.trae')), templates);
    for (const relativePath of templates) {
      if (relativePath === 'mcp.json') {
        assertMaterializedMcp(fixture);
        continue;
      }
      assert.equal(
        fs.readFileSync(path.join(fixture, '.trae', relativePath), 'utf8'),
        expectedTemplate(relativePath),
        `${relativePath} was not installed from its package template`,
      );
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
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
  const templateContents = fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'mcp.json'),
    'utf8',
  );
  assert.equal(
    fs.readFileSync(path.join(REPO_ROOT, '.trae', 'mcp.json'), 'utf8'),
    templateContents,
    'the checked-in project mirror must match the path-neutral MCP template',
  );
  const config = JSON.parse(templateContents);

  assertSafeMcpDefaults(config.mcpServers);

  const lazytrae = config.mcpServers.lazytrae;
  assert.deepEqual(
    { command: lazytrae.command, args: lazytrae.args },
    {
      command: 'node',
      args: ['__LAZYTRAE_RELEASE_LAUNCHER__', '--root', '__LAZYTRAE_PROJECT_ROOT__', 'mcp'],
    },
    'the static template must defer consumer paths to init or sync materialization',
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
  const fixture = makeGitFixture('lazytrae-fresh-install-');

  try {
    const init = runCli(['init'], { cwd: fixture });
    assert.equal(init.status, 0, init.stderr);
    assert.match(init.stdout, /LazyTrae Tool Load Check/);
    assert.match(init.stdout, /Load check passed/);
    assertMaterializedMcp(fixture);
    assert.equal(spawnSync('git', ['add', '.'], { cwd: fixture }).status, 0);
    assert.equal(spawnSync('git', ['commit', '-qm', 'post-init fixture revision'], { cwd: fixture }).status, 0);
    for (const relativePath of readTraeTemplateFiles()) {
      if (relativePath === 'mcp.json') continue;
      assert.equal(
        fs.readFileSync(path.join(fixture, '.trae', relativePath), 'utf8'),
        expectedTemplate(relativePath),
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
    const markedLines = marked.stdout.trim().split('\n');
    assert.equal(markedLines.length, 1);
    assert.equal(JSON.parse(markedLines[0]).lazytraeAdaptive.kind, 'workflow-decision');
    assert.doesNotMatch(marked.stdout, /Context pressure detected|Post-compact recovery/);
    const recovered = runCli(['hook', 'recover-context'], { cwd: fixture });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.match(recovered.stdout, /Post-compact recovery needed/);

    fs.rmSync(path.join(fixture, '.trae', 'hooks', 'context-recovery.sh'));
    fs.rmSync(path.join(fixture, '.trae', 'mcp.json'));
    fs.rmSync(path.join(fixture, '.lazytrae', 'state', 'active-loop.json'));
    const sessionsBeforeSync = fs.readFileSync(path.join(fixture, '.lazytrae', 'state', 'sessions.json'), 'utf8');
    const sync = runCli(['sync'], { cwd: fixture });
    assert.equal(sync.status, 0, sync.stderr);
    for (const relativePath of [
      '.trae/hooks/context-recovery.sh',
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
