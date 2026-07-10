const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeFixture, runCli } = require('./test-helpers');

function withFixture(prefix, callback) {
  const fixture = makeFixture(prefix);
  try {
    callback(fixture);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

test('load-check reports v0.15 package readiness separately from unverified IDE registration', () => {
  withFixture('lazytrae-load-check-ready-', fixture => {
    const result = runCli(['load-check', '--host', 'ide'], { cwd: fixture });

    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /LazyTrae Tool Load Check — v0\.15 Package Readiness/);
    assert.match(result.stdout, /PASS hooks\.json event mappings: 5\/5/);
    assert.match(result.stdout, /PASS hook executability: 8\/8/);
    assert.match(result.stdout, /PASS LazyTrae MCP declaration: command "lazytrae" args \["mcp"\]/);
    assert.match(result.stdout, /IDE registration: NOT VERIFIED/);
    assert.match(result.stdout, /Package readiness passed/);
  });
});

test('load-check fails when hooks.json is deleted', () => {
  withFixture('lazytrae-load-check-missing-hooks-', fixture => {
    fs.rmSync(path.join(fixture, '.trae', 'hooks.json'));

    const result = runCli(['load-check'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL hooks\.json event mappings: 0\/5 \(missing \.trae\/hooks\.json\)/);
  });
});

test('load-check fails when a hooks.json event points to the wrong script', () => {
  withFixture('lazytrae-load-check-corrupt-hooks-', fixture => {
    const hooksPath = path.join(fixture, '.trae', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    hooks.hooks.UserPromptSubmit[0].command = 'bash "${PROJECT_DIR}/.trae/hooks/stop.sh"';
    fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n');

    const result = runCli(['load-check'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL hooks\.json event mappings: 4\/5 \(UserPromptSubmit must invoke user-prompt-submit\.sh\)/);
  });
});

test('load-check fails when a required hook is not executable', () => {
  withFixture('lazytrae-load-check-hook-mode-', fixture => {
    fs.chmodSync(path.join(fixture, '.trae', 'hooks', 'stop.sh'), 0o644);

    const result = runCli(['load-check'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL hook executability: 7\/8 \(not executable: stop\.sh\)/);
  });
});

test('load-check fails when lazytrae MCP command or args are malformed', () => {
  withFixture('lazytrae-load-check-malformed-mcp-', fixture => {
    const mcpPath = path.join(fixture, '.trae', 'mcp.json');
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    mcp.mcpServers.lazytrae = { command: 'other-server', args: ['serve'] };
    fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + '\n');

    const result = runCli(['load-check', '--host', 'cli'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL LazyTrae MCP declaration: expected command "lazytrae" args \["mcp"\]/);
    assert.match(result.stdout, /CLI registration: NOT VERIFIED/);
  });
});
