const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { updateMcpDeclaration } = require('../src/lib/mcp-declaration');
const { runCli } = require('./test-helpers');

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'templates', 'mcp.json');

function makeProject(prefix) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(project, '.git'));
  fs.mkdirSync(path.join(project, '.trae'));
  return project;
}

function declarationPath(project) {
  return path.join(project, '.trae', 'mcp.json');
}

function writeDeclaration(project, value) {
  const contents = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(declarationPath(project), contents);
  return contents;
}

function temporaryFiles(destination) {
  const prefix = `${path.basename(destination)}.`;
  return fs.readdirSync(path.dirname(destination))
    .filter(name => name.startsWith(prefix) && name.endsWith('.tmp'));
}

function withMethod(object, method, replacement, action) {
  const original = object[method];
  object[method] = replacement(original);
  try {
    return action();
  } finally {
    object[method] = original;
  }
}

test('exact legacy bare MCP declaration migrates to the local launcher without losing caller config', () => {
  // Given: the exact PATH-dependent declaration shipped before the local launcher contract.
  const project = makeProject('lazytrae-mcp-legacy-migration-');
  const destination = declarationPath(project);
  writeDeclaration(project, {
    callerTopLevel: { preserve: true },
    mcpServers: {
      lazytrae: { command: 'lazytrae', args: ['mcp'] },
      user_server: { command: 'user-mcp', args: ['serve'], env: { USER_SETTING: 'keep' } },
    },
  });
  try {
    // When: the current release refreshes the declaration.
    const result = updateMcpDeclaration(project, TEMPLATE_PATH, destination);

    // Then: only the exact legacy entry migrates and every caller-owned value survives.
    assert.equal(result.status, 'updated');
    const config = JSON.parse(fs.readFileSync(destination, 'utf8'));
    assert.deepEqual(config.callerTopLevel, { preserve: true });
    assert.deepEqual(config.mcpServers.user_server, {
      command: 'user-mcp', args: ['serve'], env: { USER_SETTING: 'keep' },
    });
    assert.equal(config.mcpServers.lazytrae.command, 'node');
    assert.equal(path.isAbsolute(config.mcpServers.lazytrae.args[0]), true);
    assert.equal(config.mcpServers.lazytrae.args.at(-1), 'mcp');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('modified same-name MCP declaration is preserved byte-for-byte with an actionable result', () => {
  // Given: a same-name entry that resembles the legacy shape but contains a caller modification.
  const project = makeProject('lazytrae-mcp-modified-name-');
  const destination = declarationPath(project);
  const before = writeDeclaration(project, {
    callerTopLevel: 'keep',
    mcpServers: {
      lazytrae: { command: 'lazytrae', args: ['mcp'], env: { CALLER_OWNED: 'yes' } },
      user_server: { command: 'user-mcp' },
    },
  });
  try {
    // When: synchronization inspects the ambiguous declaration.
    const result = updateMcpDeclaration(project, TEMPLATE_PATH, destination);

    // Then: it refuses migration without changing any byte.
    assert.equal(result.status, 'preserved_modified');
    assert.match(result.detail, /modified.*preserved.*rename|modified.*preserved.*remove/i);
    assert.equal(fs.readFileSync(destination, 'utf8'), before);
    assert.deepEqual(temporaryFiles(destination), []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('fingerprinted declaration with a caller edit is preserved byte-for-byte', () => {
  // Given: a generated declaration whose managed payload is edited without updating its fingerprint.
  const project = makeProject('lazytrae-mcp-fingerprint-modified-');
  const destination = declarationPath(project);
  try {
    assert.equal(updateMcpDeclaration(project, TEMPLATE_PATH, destination).status, 'updated');
    const config = JSON.parse(fs.readFileSync(destination, 'utf8'));
    config.mcpServers.lazytrae.args.push('--caller-edit');
    const before = writeDeclaration(project, config);

    // When: the declaration is refreshed.
    const result = updateMcpDeclaration(project, TEMPLATE_PATH, destination);

    // Then: the invalid fingerprint closes the managed overwrite path.
    assert.equal(result.status, 'preserved_modified');
    assert.equal(fs.readFileSync(destination, 'utf8'), before);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('malformed MCP JSON remains unchanged and reports repair guidance', () => {
  // Given: malformed caller input at the JSON boundary.
  const project = makeProject('lazytrae-mcp-malformed-');
  const destination = declarationPath(project);
  const before = writeDeclaration(project, '{ "mcpServers": { broken\n');
  try {
    // When/Then: update fails actionably without a partial file or temp artifact.
    assert.throws(
      () => updateMcpDeclaration(project, TEMPLATE_PATH, destination),
      /invalid .*mcp\.json.*repair|invalid .*mcp\.json.*remove/i,
    );
    assert.equal(fs.readFileSync(destination, 'utf8'), before);
    assert.deepEqual(temporaryFiles(destination), []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('MCP declaration read permission failure is actionable and non-destructive', () => {
  // Given: an existing declaration that cannot be opened for reading.
  const project = makeProject('lazytrae-mcp-read-permission-');
  const destination = declarationPath(project);
  const before = writeDeclaration(project, { mcpServers: { user_server: { command: 'user-mcp' } } });
  try {
    // When/Then: the read error is surfaced while the original bytes remain intact.
    assert.throws(
      () => withMethod(fs, 'openSync', original => (target, flags, ...rest) => {
        const readsOnly = (flags & fs.constants.O_WRONLY) === 0 && (flags & fs.constants.O_RDWR) === 0;
        if (path.resolve(target) === path.resolve(destination) && readsOnly) {
          const error = new Error('permission denied by test');
          error.code = 'EACCES';
          throw error;
        }
        return original(target, flags, ...rest);
      }, () => updateMcpDeclaration(project, TEMPLATE_PATH, destination)),
      /cannot read .*mcp\.json.*permission/i,
    );
    assert.equal(fs.readFileSync(destination, 'utf8'), before);
    assert.deepEqual(temporaryFiles(destination), []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('unexpected atomic rename failure leaves no partial MCP mutation', () => {
  // Given: a valid caller declaration and an atomic rename that fails with I/O error.
  const project = makeProject('lazytrae-mcp-atomic-failure-');
  const destination = declarationPath(project);
  const before = writeDeclaration(project, {
    mcpServers: { lazytrae: { command: 'lazytrae', args: ['mcp'] }, user_server: { command: 'user-mcp' } },
  });
  try {
    // When/Then: update reports the failed atomic operation and retains the exact original file.
    assert.throws(
      () => withMethod(fs, 'renameSync', original => (source, target) => {
        if (target === destination || path.basename(target) === path.basename(destination)) {
          const error = new Error('simulated I/O failure');
          error.code = 'EIO';
          throw error;
        }
        return original(source, target);
      }, () => updateMcpDeclaration(project, TEMPLATE_PATH, destination)),
      /atomic.*mcp\.json.*unchanged.*retry/i,
    );
    assert.equal(fs.readFileSync(destination, 'utf8'), before);
    assert.deepEqual(temporaryFiles(destination), []);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('uninstall removes only the generated MCP surface and preserves caller config', () => {
  // Given: a generated declaration with caller-owned top-level data and another MCP server.
  const project = makeProject('lazytrae-mcp-uninstall-owned-');
  const destination = declarationPath(project);
  try {
    assert.equal(runCli(['init'], { cwd: project }).status, 0);
    const config = JSON.parse(fs.readFileSync(destination, 'utf8'));
    config.callerTopLevel = { preserve: true };
    config.mcpServers.user_server = { command: 'user-mcp', args: ['serve'] };
    fs.writeFileSync(destination, `${JSON.stringify(config, null, 2)}\n`);

    // When: project uninstall removes verified LazyTrae assets.
    const uninstalled = runCli(['uninstall', '--yes'], { cwd: project });

    // Then: the generated core/placeholders leave while caller configuration remains.
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    const remaining = JSON.parse(fs.readFileSync(destination, 'utf8'));
    assert.deepEqual(remaining, {
      callerTopLevel: { preserve: true },
      mcpServers: { user_server: { command: 'user-mcp', args: ['serve'] } },
    });
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('uninstall preserves a modified generated same-name MCP entry byte-for-byte', () => {
  // Given: a fingerprinted declaration whose core entry was caller-modified.
  const project = makeProject('lazytrae-mcp-uninstall-modified-');
  const destination = declarationPath(project);
  try {
    assert.equal(runCli(['init'], { cwd: project }).status, 0);
    const config = JSON.parse(fs.readFileSync(destination, 'utf8'));
    config.mcpServers.lazytrae.args.push('--caller-edit');
    const before = writeDeclaration(project, config);

    // When: uninstall inspects the ambiguous same-name entry.
    const uninstalled = runCli(['uninstall', '--yes'], { cwd: project });

    // Then: no part of the MCP file is changed.
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    assert.equal(fs.readFileSync(destination, 'utf8'), before);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
