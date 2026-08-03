'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { makeCompletionFixture } = require('./test-helpers');

const CLI = path.resolve(__dirname, '..', 'bin', 'lazytrae.js');

function fixture(t) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-ide-assets-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, '.git'));
  return project;
}

function probe(t) {
  const probePath = path.join(fixture(t), 'verified-ide-probe.json');
  fs.writeFileSync(probePath, `${JSON.stringify({
    schema_version: 2,
    contract_version: '2.0.0',
    product: 'trae',
    host: 'ide',
    status: 'accessible',
    host_readiness: 'pending',
    capabilities: [{
      name: 'ide-hook-configuration-v1',
      status: 'accessible',
      schema_version: 1,
      execution: 'sandbox',
      events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'],
      scopes: ['project', 'global'],
    }],
  }, null, 2)}\n`);
  return probePath;
}

function run(project, args, input) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: project, input, encoding: 'utf8' });
}

test('unknown IDE hook schema writes no hook configuration', (t) => {
  // Given: a real empty project and no verified IDE capability probe.
  const project = fixture(t);

  // When: the real CLI initializes the IDE route.
  const result = spawnSync(process.execPath, [CLI, 'init', '--host', 'ide'], {
    cwd: project,
    encoding: 'utf8',
  });

  // Then: semantic assets install, but no guessed hook schema is persisted.
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(project, '.trae', 'hooks.json')), false);
});

test('verified IDE generation preserves user configuration and emits both Skill destinations', (t) => {
  // Given: explicit project/global user configuration, root prose, and a schema-verifying probe.
  const project = fixture(t);
  const verifiedProbe = probe(t);
  const globalRoot = fs.mkdtempSync('/private/tmp/lazytrae-global-hooks-');
  t.after(() => fs.rmSync(globalRoot, { recursive: true, force: true }));
  const globalHooks = path.join(globalRoot, 'hooks.json');
  fs.mkdirSync(path.join(project, '.trae'), { recursive: true });
  fs.writeFileSync(path.join(project, 'AGENTS.md'), '# User root guidance\n');
  fs.writeFileSync(path.join(project, '.trae', 'hooks.json'), '{"hooks":{"UserEvent":[{"type":"command","command":"user"}]},"userKey":"project"}\n');
  fs.writeFileSync(path.join(project, '.trae', 'mcp.json'), '{"mcpServers":{"user":{"command":"user"}},"userKey":"mcp"}\n');
  fs.writeFileSync(globalHooks, '{"hooks":{"GlobalEvent":[{"type":"command","command":"global"}]},"userKey":"global"}\n');

  // When: the real IDE initializer compiles and merges its verified surfaces.
  const result = run(project, ['init', '--host', 'ide', '--ide-probe', verifiedProbe, '--global-hooks', globalHooks]);

  // Then: one canonical Skill byte stream reaches both hosts and caller-owned data survives.
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const canonical = fs.readFileSync(path.join(project, '.trae', 'skills', 'lazy-debugging', 'SKILL.md'));
  assert.deepEqual(fs.readFileSync(path.join(project, '.agents', 'skills', 'lazy-debugging', 'SKILL.md')), canonical);
  const projectHooks = JSON.parse(fs.readFileSync(path.join(project, '.trae', 'hooks.json'), 'utf8'));
  const global = JSON.parse(fs.readFileSync(globalHooks, 'utf8'));
  const mcp = JSON.parse(fs.readFileSync(path.join(project, '.trae', 'mcp.json'), 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(
    path.join(project, '.lazytrae', 'trae-ide-config-receipt.v1.json'),
    'utf8',
  ));
  assert.equal(projectHooks.userKey, 'project');
  assert.equal(projectHooks.hooks.UserEvent[0].command, 'user');
  assert.equal(projectHooks.hooks.Notification[0].command.includes('notification.sh'), true);
  assert.equal(global.userKey, 'global');
  assert.equal(global.hooks.GlobalEvent[0].command, 'global');
  assert.equal(mcp.userKey, 'mcp');
  assert.equal(mcp.mcpServers.user.command, 'user');
  assert.equal(receipt.entries.project.path, '.trae/hooks.json');
  assert.equal(receipt.entries.global.path, globalHooks);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /^# User root guidance/m);
  for (const command of fs.readdirSync(path.join(project, '.trae', 'commands'))) {
    assert.match(fs.readFileSync(path.join(project, '.trae', 'commands', command), 'utf8'), /^---\ndescription: .+\nargument-hint:/);
  }
});

test('modified managed Hook configuration conflicts without changing caller bytes', (t) => {
  // Given: an unreceipted caller definition for a harness-owned Hook event.
  const project = fixture(t);
  const verifiedProbe = probe(t);
  const hooksPath = path.join(project, '.trae', 'hooks.json');
  fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
  fs.writeFileSync(hooksPath, '{"hooks":{"Notification":[{"type":"command","command":"caller"}]}}\n');
  const before = fs.readFileSync(hooksPath);
  const beforeEntries = fs.readdirSync(project).sort();

  // When: verified installation attempts to claim the same semantic key.
  const result = run(project, ['init', '--host', 'ide', '--ide-probe', verifiedProbe]);

  // Then: the merge refuses and preserves the exact caller bytes.
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /JSON merge conflict/);
  assert.deepEqual(fs.readFileSync(hooksPath), before);
  assert.deepEqual(fs.readdirSync(project).sort(), beforeEntries);
});

test('malformed root markers and linked Hook targets refuse before host configuration mutation', (t) => {
  // Given: separate malformed-guidance, linked-probe, and linked-config projects.
  const malformed = fixture(t);
  fs.writeFileSync(path.join(malformed, 'AGENTS.md'), '<!-- lazytrae:managed:start:onboarding -->\n');
  const linkedProbeProject = fixture(t);
  const linkedProbeTarget = probe(t);
  const linkedProbe = path.join(fixture(t), 'linked-probe.json');
  fs.symlinkSync(linkedProbeTarget, linkedProbe);
  const linked = fixture(t);
  const verifiedProbe = probe(t);
  const outside = path.join(fixture(t), 'outside-hooks.json');
  fs.writeFileSync(outside, '{}\n');
  fs.mkdirSync(path.join(linked, '.trae'), { recursive: true });
  fs.symlinkSync(outside, path.join(linked, '.trae', 'hooks.json'));

  // When: all real initializer invocations preflight their inputs and destinations.
  const malformedResult = run(malformed, ['init', '--host', 'ide']);
  const linkedProbeResult = run(linkedProbeProject, ['init', '--host', 'ide', '--ide-probe', linkedProbe]);
  const linkedResult = run(linked, ['init', '--host', 'ide', '--ide-probe', verifiedProbe]);

  // Then: all fail closed and preserve user-owned bytes outside the target.
  assert.notEqual(malformedResult.status, 0);
  assert.match(malformedResult.stderr, /malformed managed markers/);
  assert.equal(fs.existsSync(path.join(malformed, '.agents')), false);
  assert.notEqual(linkedProbeResult.status, 0);
  assert.match(`${linkedProbeResult.stdout}${linkedProbeResult.stderr}`, /probe.*symlink/i);
  assert.deepEqual(fs.readdirSync(linkedProbeProject), ['.git']);
  assert.notEqual(linkedResult.status, 0);
  assert.match(`${linkedResult.stdout}${linkedResult.stderr}`, /symlink/i);
  assert.equal(fs.readFileSync(outside, 'utf8'), '{}\n');
  assert.deepEqual(fs.readdirSync(linked).sort(), ['.git', '.trae']);
});

test('Notification is advisory and cannot satisfy a blocked completion gate', (t) => {
  // Given: a real initialized project whose canonical work gate is blocked.
  const project = makeCompletionFixture('lazytrae-notification-advisory-', false);
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const before = run(project, ['completion-status']);
  assert.match(before.stdout, /^blocked/m);

  // When: Notification claims success through the real hook dispatcher.
  const notification = run(project, ['hook', 'notification'], '{"status":"success","message":"done"}\n');

  // Then: dispatch remains nonblocking while the hard completion gate stays blocked.
  assert.equal(notification.status, 0, notification.stderr || notification.stdout);
  assert.match(notification.stdout, /advisory status only/);
  assert.match(run(project, ['completion-status']).stdout, /^blocked/m);
});
