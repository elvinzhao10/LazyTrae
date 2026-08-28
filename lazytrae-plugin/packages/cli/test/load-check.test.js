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

test('load-check reports v1.2.0 package readiness separately from unverified IDE registration', () => {
  withFixture('lazytrae-load-check-ready-', fixture => {
    const result = runCli(['load-check', '--host', 'ide'], { cwd: fixture });

    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /LazyTrae Tool Load Check — v1\.2\.0 Package Readiness/);
    assert.match(result.stdout, /PASS Machine status v2: version=1\.2\.0/);
    assert.doesNotMatch(result.stdout, /v0\.17/);
    assert.doesNotMatch(result.stdout, /v0\.16/);
    assert.match(result.stdout, /PENDING hooks\.json event mappings: 0\/6/);
    assert.match(result.stdout, /PASS hook executability: 9\/9/);
    assert.match(result.stdout, /PASS LazyTrae MCP declaration: node with absolute release-owned launcher/);
    assert.match(result.stdout, /IDE registration: NOT VERIFIED/);
    assert.match(result.stdout, /Package readiness passed/);
  });
});

test('load-check help identifies the v1.2.0 package readiness check', () => {
  const result = runCli(['load-check', '--help']);

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /Check v1\.2\.0 package readiness after initialization\./);
  assert.doesNotMatch(result.stdout, /v0\.17/);
});

test('load-check keeps an unverified hook schema pending when hooks.json is absent', () => {
  withFixture('lazytrae-load-check-missing-hooks-', fixture => {
    const result = runCli(['load-check'], { cwd: fixture });

    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /PENDING hooks\.json event mappings: 0\/6/);
  });
});

test('load-check fails when a hooks.json event points to the wrong script', () => {
  withFixture('lazytrae-load-check-corrupt-hooks-', fixture => {
    const hooksPath = path.join(fixture, '.trae', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'templates', 'hooks.json'), 'utf8'));
    hooks.hooks.Notification = [{
      type: 'command', command: 'bash "${PROJECT_DIR}/.trae/hooks/notification.sh"', timeout: 10,
    }];
    hooks.hooks.UserPromptSubmit[0].command = 'bash "${PROJECT_DIR}/.trae/hooks/stop.sh"';
    fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n');

    const result = runCli(['load-check'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL hooks\.json event mappings: 5\/6 \(UserPromptSubmit must invoke user-prompt-submit\.sh\)/);
  });
});

test('load-check fails when a required hook is not executable', () => {
  withFixture('lazytrae-load-check-hook-mode-', fixture => {
    fs.chmodSync(path.join(fixture, '.trae', 'hooks', 'stop.sh'), 0o644);

    const result = runCli(['load-check'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /FAIL hook executability: 8\/9 \(not executable: stop\.sh\)/);
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
    assert.match(result.stdout, /FAIL LazyTrae MCP declaration: .*modified.*preserved/i);
    assert.match(result.stdout, /CLI MCP ROUTE: CONFIGURATION JSON ONLY/);
  });
});

test('load-check fails when canonical readiness reports malformed tooling state', () => {
  withFixture('lazytrae-load-check-malformed-tooling-state-', fixture => {
    const statePath = path.join(fixture, '.lazytrae', 'state', 'tooling.json');
    fs.writeFileSync(statePath, '{bad-json\n');

    const result = runCli(['load-check', '--host', 'ide'], { cwd: fixture });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Capability readiness .*failed-optional=9/);
    assert.match(
      result.stdout,
      /Package readiness failed\. Run node .*bin\/lazytrae\.js.* --root .* sync, then re-run this check\./,
    );
    assert.doesNotMatch(result.stdout, /Run lazytrae sync/);
    assert.equal(fs.readFileSync(statePath, 'utf8'), '{bad-json\n');
  });
});
