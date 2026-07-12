const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT } = require('./test-helpers');

function readTemplate(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', relativePath), 'utf8');
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
