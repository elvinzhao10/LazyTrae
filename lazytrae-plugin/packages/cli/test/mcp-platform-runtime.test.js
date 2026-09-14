const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

for (const command of ['doctor', 'init', 'sync']) {
  test(`${command} rejects invalid caller MCP command and preserves declaration`, () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'trae-platform-'));
    try {
      fs.mkdirSync(path.join(project, '.git'));
      assert.equal(runCli(['init'], { cwd: project }).status, 0);
      const destination = path.join(project, '.trae/mcp.json');
      const config = JSON.parse(fs.readFileSync(destination, 'utf8'));
      config.mcpServers.caller = { command: 'node server.js' };
      const before = JSON.stringify(config, null, 2);
      fs.writeFileSync(destination, before);
      const result = runCli([command], { cwd: project });
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, /MCP_COMMAND_NOT_SPACE_FREE/);
      assert.equal(fs.readFileSync(destination, 'utf8'), before);
    } finally { fs.rmSync(project, { recursive: true, force: true }); }
  });
}

test('init and sync retain valid HTTP, spaced args and disabled placeholders', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'trae-platform-valid-'));
  try {
    fs.mkdirSync(path.join(project, '.git'));
    fs.mkdirSync(path.join(project, '.trae'));
    const destination = path.join(project, '.trae/mcp.json');
    const caller = {
      local: { command: 'node', args: ['/path with spaces/server.js'] },
      remote: { type: 'http', url: 'https://example.test/mcp', headers: { Authorization: 'literal' } },
      off: { disabled: true, command: '', env: { TOKEN: '${SECRET}' } },
    };
    fs.writeFileSync(destination, JSON.stringify({ mcpServers: caller }));
    for (const command of ['init', 'sync', 'doctor']) {
      const result = runCli([command], { cwd: project });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    const actual = JSON.parse(fs.readFileSync(destination, 'utf8')).mcpServers;
    for (const [name, server] of Object.entries(caller)) assert.deepEqual(actual[name], server);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});
