const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const os = require('node:os');
const { REPO_ROOT, runCli } = require('./test-helpers');

function readTemplate(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', relativePath), 'utf8');
}

function readInitDeepSkills() {
  const relativePath = path.join('.trae', 'skills', 'lazy-init-deep', 'SKILL.md');
  return [
    readTemplate(path.join('skills', 'lazy-init-deep', 'SKILL.md')),
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'),
    fs.readFileSync(path.resolve(REPO_ROOT, '..', relativePath), 'utf8'),
  ];
}

test('onboarding documents all host routes without claiming host discovery', () => {
  const agents = readTemplate('AGENTS.md');

  assert.match(agents, /Trae IDE/, 'IDE route must be documented');
  assert.match(agents, /Trae Work/, 'Work route must be documented');
  assert.match(agents, /Trae CLI/, 'CLI route must be documented');
  assert.match(agents, /lazytrae init --host ide\|work\|cli/);
  assert.match(agents, /lazytrae work install/);
  assert.match(agents, /lazytrae work status/);
  assert.match(agents, /package readiness/);
  assert.match(agents, /not host discovery, MCP connection, or a running session/);
});

test('InitDeep repairs core assets but never provisions optional integrations', () => {
  const command = readTemplate('commands/lazy-init-deep.md');
  const skill = readTemplate('skills/lazy-init-deep/SKILL.md');

  assert.match(command, /core LazyTrae assets only/);
  assert.match(skill, /core LazyTrae assets only/);
  assert.match(skill, /Do NOT run `lazytrae tooling/);
  assert.match(skill, /Do NOT enable optional MCP\s+capabilities/);
  assert.doesNotMatch(skill, /npm install|npx /);
});

test('InitDeep records package-readiness evidence without claiming a host or MCP connection', () => {
  // Given: the package template and both checked-in installed skill mirrors.
  const skills = readInitDeepSkills();

  // When: each skill is checked against the current InitDeep evidence contract.
  for (const skill of skills) {
    // Then: the contract requires a load check first, core inventory verification, and all evidence keys.
    assert.ok(skill.indexOf('lazytrae load-check') < skill.indexOf('### Phase 1'));
    assert.match(skill, /verify skills, commands, agents, hooks, and the MCP declaration/i);
    assert.match(skill, /readiness_result/);
    assert.match(skill, /readiness_host/);
    assert.match(skill, /capability_statuses/);
    assert.match(skill, /optional_policy/);
    assert.match(skill, /receipt_state/);
    assert.match(skill, /evidence_paths/);
    assert.match(skill, /leave optional capabilities unchanged unless separately explicitly requested/i);
    assert.match(skill, /does not establish host discovery or a live MCP connection/i);
    assert.doesNotMatch(skill, /(?:proves?|verifies?|confirms?) (?:a )?(?:live )?(?:host (?:discovery|connection)|MCP connection)/i);
  }
  assert.equal(skills[1], skills[0], 'plugin installed skill must match the package template');
  assert.equal(skills[2], skills[0], 'repository installed skill must match the package template');
});

test('init appends removable onboarding guidance to an existing user AGENTS.md', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-existing-agents-'));
  const userContent = '# Project rules\n\nKeep this exact text.\n';
  try {
    fs.mkdirSync(path.join(fixture, '.git'));
    fs.writeFileSync(path.join(fixture, 'AGENTS.md'), userContent, 'utf8');

    const init = runCli(['init', '--host', 'ide'], { cwd: fixture });

    assert.equal(init.status, 0, init.stderr);
    const installed = fs.readFileSync(path.join(fixture, 'AGENTS.md'), 'utf8');
    assert.match(installed, /<!-- lazytrae:managed:start:onboarding -->/);
    assert.match(installed, /## `onboard` protocol/);
    assert.equal(installed.slice(0, userContent.length), userContent);

    const uninstall = runCli(['uninstall', '--yes'], { cwd: fixture });

    assert.equal(uninstall.status, 0, uninstall.stderr);
    assert.equal(fs.readFileSync(path.join(fixture, 'AGENTS.md'), 'utf8'), userContent);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
