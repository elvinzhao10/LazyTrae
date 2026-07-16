const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { run: init } = require('../src/commands/init');
const { run: sync } = require('../src/commands/sync');
const { updateMcpDeclaration } = require('../src/lib/tooling-state');
const { makeFixture, runCli } = require('./test-helpers');

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'templates', 'mcp.json');

function makeProject(prefix) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(project, '.git'));
  fs.mkdirSync(path.join(project, '.trae'));
  return project;
}

function withRenameEperm(destinationPath, action) {
  const originalRename = fs.renameSync;
  const resolvedDestinationPath = path.join(fs.realpathSync(path.dirname(destinationPath)), path.basename(destinationPath));
  fs.renameSync = (sourcePath, targetPath) => {
    if (targetPath === destinationPath || targetPath === resolvedDestinationPath) {
      const error = new Error('operation not permitted');
      error.code = 'EPERM';
      throw error;
    }
    return originalRename(sourcePath, targetPath);
  };
  try {
    return action();
  } finally {
    fs.renameSync = originalRename;
  }
}

function tempFilesFor(destinationPath) {
  const directory = path.dirname(destinationPath);
  const base = path.basename(destinationPath);
  return fs.readdirSync(directory).filter(name => name.startsWith(`${base}.`) && name.endsWith('.tmp'));
}

function withProjectDirectory(project, action) {
  const previousDirectory = process.cwd();
  process.chdir(project);
  try {
    return action();
  } finally {
    process.chdir(previousDirectory);
  }
}

function captureConsole(action) {
  const originalLog = console.log;
  const output = [];
  console.log = (...values) => output.push(values.join(' '));
  try {
    action();
  } finally {
    console.log = originalLog;
  }
  return output.join('\n');
}

test('MCP declaration writer updates a normal project declaration', () => {
  const project = makeProject('lazytrae-work-mcp-normal-');
  const destinationPath = path.join(project, '.trae', 'mcp.json');
  try {
    const result = updateMcpDeclaration(project, TEMPLATE_PATH, destinationPath);

    assert.deepEqual(result, { status: 'updated' });
    const config = JSON.parse(fs.readFileSync(destinationPath, 'utf8'));
    assert.equal(config.mcpServers.lazytrae.command, 'lazytrae');
    assert.deepEqual(config.mcpServers.lazytrae.args, ['mcp']);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('MCP declaration writer preserves a user file and removes its temp file when rename is EPERM', () => {
  const project = makeProject('lazytrae-work-mcp-eperm-');
  const destinationPath = path.join(project, '.trae', 'mcp.json');
  const userDeclaration = '{\n  "mcpServers": { "user": { "command": "user-server" } }\n}\n';
  fs.writeFileSync(destinationPath, userDeclaration);
  try {
    const result = withRenameEperm(destinationPath, () =>
      updateMcpDeclaration(project, TEMPLATE_PATH, destinationPath));

    assert.deepEqual(result, { status: 'unavailable_existing' });
    assert.equal(fs.readFileSync(destinationPath, 'utf8'), userDeclaration);
    assert.deepEqual(tempFilesFor(destinationPath), []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('sync reports a preserved existing protected MCP declaration without changing it', () => {
  const fixture = makeFixture('lazytrae-work-sync-mcp-eperm-');
  const destinationPath = path.join(fixture, '.trae', 'mcp.json');
  const userDeclaration = '{\n  "mcpServers": { "user": { "command": "user-server" } }\n}\n';
  fs.writeFileSync(destinationPath, userDeclaration);
  try {
    const output = withRenameEperm(destinationPath, () => withProjectDirectory(fixture, () => captureConsole(() => sync([]))));

    assert.match(output, /protected destination; existing declaration preserved; complete MCP registration manually with your host/);
    assert.doesNotMatch(output, /Trae Work|Settings → MCP/);
    assert.equal(fs.readFileSync(destinationPath, 'utf8'), userDeclaration);
    assert.deepEqual(tempFilesFor(destinationPath), []);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('sync reports an unwritten protected MCP declaration without claiming a host-specific action', () => {
  const fixture = makeFixture('lazytrae-sync-mcp-eperm-absent-');
  const destinationPath = path.join(fixture, '.trae', 'mcp.json');
  fs.rmSync(destinationPath);
  try {
    const output = withRenameEperm(destinationPath, () => withProjectDirectory(fixture, () => captureConsole(() => sync([]))));

    assert.match(output, /protected destination; declaration was not written; complete MCP registration manually with your host/);
    assert.doesNotMatch(output, /existing declaration preserved|Trae Work|Settings → MCP/);
    assert.equal(fs.existsSync(destinationPath), false);
    assert.deepEqual(tempFilesFor(destinationPath), []);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

function assertProtectedInitUsesGenericHostAction(host) {
  const project = makeProject(`lazytrae-${host}-init-mcp-eperm-`);
  const destinationPath = path.join(project, '.trae', 'mcp.json');
  const previousExitCode = process.exitCode;
  try {
    const output = withRenameEperm(destinationPath, () => withProjectDirectory(project, () =>
      captureConsole(() => init(['--host', host]))));

    assert.match(output, /protected destination; declaration was not written; complete MCP registration manually with your host/);
    assert.doesNotMatch(output, /Trae Work|Settings → MCP/);
    assert.equal(fs.existsSync(destinationPath), false);
    assert.deepEqual(tempFilesFor(destinationPath), []);
  } finally {
    process.exitCode = previousExitCode;
    fs.rmSync(project, { recursive: true, force: true });
  }
}

test('IDE init reports a generic protected MCP declaration', () => {
  assertProtectedInitUsesGenericHostAction('ide');
});

test('CLI init reports a generic protected MCP declaration', () => {
  assertProtectedInitUsesGenericHostAction('cli');
});

test('init distinguishes protected existing declarations for every host', () => {
  for (const host of ['ide', 'work', 'cli']) {
    const project = makeProject(`lazytrae-${host}-init-mcp-eperm-existing-`);
    const destinationPath = path.join(project, '.trae', 'mcp.json');
    const userDeclaration = '{\n  "mcpServers": { "user": { "command": "user-server" } }\n}\n';
    const skillsDir = host === 'work' ? fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-init-mcp-skills-')) : null;
    const previousExitCode = process.exitCode;
    fs.writeFileSync(destinationPath, userDeclaration);
    try {
      const args = ['--host', host];
      if (skillsDir) args.push('--skills-dir', skillsDir);
      const output = withRenameEperm(destinationPath, () => withProjectDirectory(project, () => captureConsole(() => init(args))));

      assert.match(output, /protected destination; existing declaration preserved/);
      assert.equal(fs.readFileSync(destinationPath, 'utf8'), userDeclaration);
      assert.deepEqual(tempFilesFor(destinationPath), []);
      if (host === 'work') {
        assert.match(output, /Trae Work requires manual Settings → MCP registration/);
      } else {
        assert.match(output, /complete MCP registration manually with your host/);
        assert.doesNotMatch(output, /Trae Work|Settings → MCP/);
      }
    } finally {
      process.exitCode = previousExitCode;
      fs.rmSync(project, { recursive: true, force: true });
      if (skillsDir) fs.rmSync(skillsDir, { recursive: true, force: true });
    }
  }
});

test('Work init reports an unwritten protected MCP declaration and keeps package readiness truthful', () => {
  const project = makeProject('lazytrae-work-init-mcp-eperm-');
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-init-mcp-skills-'));
  const destinationPath = path.join(project, '.trae', 'mcp.json');
  const previousExitCode = process.exitCode;
  try {
    const output = withRenameEperm(destinationPath, () => withProjectDirectory(project, () =>
      captureConsole(() => init(['--host', 'work', '--skills-dir', skillsDir]))));

    assert.match(output, /protected destination; declaration was not written; Trae Work requires manual Settings → MCP registration/);
    assert.match(output, /SKIP LazyTrae MCP declaration: Trae Work requires manual Settings → MCP registration/);
    assert.match(output, /Package readiness passed/);
    assert.equal(fs.existsSync(destinationPath), false);
    assert.deepEqual(tempFilesFor(destinationPath), []);
  } finally {
    process.exitCode = previousExitCode;
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});

test('Work load-check passes package readiness without a project MCP declaration', () => {
  const fixture = makeFixture('lazytrae-work-load-check-no-mcp-');
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-load-check-skills-'));
  try {
    const install = runCli(['work', 'install', '--skills-dir', skillsDir]);
    assert.equal(install.status, 0, install.stderr);
    fs.rmSync(path.join(fixture, '.trae', 'mcp.json'));

    const result = runCli(['load-check', '--host', 'work', '--skills-dir', skillsDir], { cwd: fixture });

    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /SKIP LazyTrae MCP declaration: Trae Work requires manual Settings → MCP registration/);
    assert.match(result.stdout, /Package readiness passed/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
});
