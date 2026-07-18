const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const os = require('node:os');
const { REPO_ROOT, runCli } = require('./test-helpers');
const REPOSITORY_ROOT = path.resolve(REPO_ROOT, '..');

function readTemplate(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', relativePath), 'utf8');
}

function readInitDeepSkills() {
  const relativePath = path.join('.trae', 'skills', 'lazy-init-deep', 'SKILL.md');
  return [
    readTemplate(path.join('skills', 'lazy-init-deep', 'SKILL.md')),
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'),
  ];
}

const BARE_INITDEEP_COMMAND = /(?:^|[\s`"'])lazytrae (?:load-check|init|sync|work install)\b/m;

function assertLocalInitDeepGuidance(content, source) {
  assert.doesNotMatch(content, BARE_INITDEEP_COMMAND, source);
  assert.match(content, /\.trae\/mcp\.json/, source);
  assert.match(content, /mcpServers\.lazytrae/, source);
  assert.match(content, /command[^\n]*node/, source);
  assert.match(content, /node <absolute-release-launcher[^\n]*--root <absolute-project-root/, source);
}

test('onboarding documents all host routes without claiming host discovery', () => {
  const agents = readTemplate('AGENTS.md');

  assert.match(agents, /Trae IDE/, 'IDE route must be documented');
  assert.match(agents, /Trae Work/, 'Work route must be documented');
  assert.match(agents, /Trae CLI/, 'CLI route must be documented');
  assert.match(agents, /__LAZYTRAE_LOCAL_COMMAND__/);
  assert.match(agents, /init --host ide\|cli/);
  assert.match(agents, /__LAZYTRAE_LOCAL_COMMAND__ init --host work/);
  assert.match(agents, /Settings → MCP/);
  assert.match(agents, /package readiness/);
  assert.match(agents, /never proves host discovery[\s\S]*MCP connection/);
});

test('local-first onboarding protocol covers every stage and host readiness boundary', () => {
  const routeDocs = [
    path.join(REPOSITORY_ROOT, 'AGENTS.md'),
    path.join(REPOSITORY_ROOT, 'README.md'),
    path.join(REPOSITORY_ROOT, 'docs', '03-install-and-host-verification.md'),
    path.join(REPOSITORY_ROOT, 'docs', 'reference', 'host-routes.md'),
    path.join(REPOSITORY_ROOT, 'lazytrae-plugin', 'README.md'),
    path.join(REPOSITORY_ROOT, 'lazytrae-plugin', 'packages', 'cli', 'README.md'),
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'AGENTS.md'),
  ];

  // Given: each shipped user-facing onboarding surface.
  for (const documentPath of routeDocs) {
    const content = fs.readFileSync(documentPath, 'utf8');

    // When: the surface is checked against the local-first onboarding contract.
    assert.match(content, /permanent[\s\S]{0,240}(?:open|link)[\s\S]{0,240}https:\/\/github\.com\/elvinzhao10\/LazyTrae[\s\S]{0,160}onboard/i, documentPath);
    assert.match(content, /package[\s\n]+readiness/i, documentPath);
    assert.match(content, /host[\s\n]+readiness/i, documentPath);
    assert.match(content, /approval/i, documentPath);
    assert.match(content, /(?:one[\s\S]{0,30}exact|exactly[\s\S]{0,30}one)[\s\S]{0,100}action[\s\S]{0,100}wait/i, documentPath);
    assert.match(content, /Computer Use/i, documentPath);
    assert.match(content, /reload|new session/i, documentPath);
    assert.match(content, /real (?:LazyTrae )?(?:Skill|command)|one (?:real )?(?:Skill|command)/i, documentPath);
    assert.match(content, /expected MCP|core MCP/i, documentPath);
    assert.match(content, /pending/i, documentPath);
  }

  const hostRoutes = fs.readFileSync(path.join(REPOSITORY_ROOT, 'docs', 'reference', 'host-routes.md'), 'utf8');
  assert.match(hostRoutes, /Trae IDE[\s\S]*\.trae\/mcp\.json[\s\S]*generated[\s\S]*command: node/i);
  assert.match(hostRoutes, /Trae Work[\s\S]*Skills copy\/import[\s\S]*manual/i);
  assert.match(hostRoutes, /Trae CLI[\s\S]*trae-cli mcp add-json/i);

  const readme = fs.readFileSync(path.join(REPOSITORY_ROOT, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /npm install --global/i);
  assert.match(readme, /absolute launcher/i);
});

test('InitDeep repairs core assets but never provisions optional integrations', () => {
  const command = readTemplate('commands/lazy-init-deep.md');
  const skill = readTemplate('skills/lazy-init-deep/SKILL.md');

  assert.match(command, /core LazyTrae assets only/);
  assert.match(skill, /core LazyTrae assets only/);
  assert.match(skill, /Do NOT invoke the release-owned local command with `tooling/);
  assert.match(skill, /Do NOT enable optional MCP\s+capabilities/);
  assert.doesNotMatch(skill, /npm install|npx /);
});

test('InitDeep records package-readiness evidence without claiming a host or MCP connection', () => {
  // Given: the package template and its checked-in plugin mirror.
  const skills = readInitDeepSkills();

  // When: each skill is checked against the current InitDeep evidence contract.
  for (const skill of skills) {
    // Then: the contract requires a load check first, core inventory verification, and all evidence keys.
    assert.ok(skill.indexOf('load-check --host') < skill.indexOf('### Phase 1'));
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
});

test('InitDeep managed guidance uses the project release-owned launcher without PATH fallback', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-initdeep-local-guidance-'));
  try {
    fs.mkdirSync(path.join(fixture, '.git'));
    const initialized = runCli(['init', '--host', 'ide'], { cwd: fixture });
    assert.equal(initialized.status, 0, initialized.stderr);

    const skillSources = [
      ['skill template', readTemplate('skills/lazy-init-deep/SKILL.md')],
      ['skill mirror', fs.readFileSync(path.join(REPO_ROOT, '.trae', 'skills', 'lazy-init-deep', 'SKILL.md'), 'utf8')],
      ['installed skill', fs.readFileSync(path.join(fixture, '.trae', 'skills', 'lazy-init-deep', 'SKILL.md'), 'utf8')],
    ];
    for (const [source, content] of skillSources) assertLocalInitDeepGuidance(content, source);

    const commandSources = [
      ['command template', readTemplate('commands/lazy-init-deep.md')],
      ['command mirror', fs.readFileSync(path.join(REPO_ROOT, '.trae', 'commands', 'lazy-init-deep.md'), 'utf8')],
      ['installed command', fs.readFileSync(path.join(fixture, '.trae', 'commands', 'lazy-init-deep.md'), 'utf8')],
    ];
    for (const [source, content] of commandSources) {
      assert.doesNotMatch(content, BARE_INITDEEP_COMMAND, source);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('missing hook remediation names the release-owned local init command', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-hook-local-remediation-'));
  try {
    fs.mkdirSync(path.join(fixture, '.git'));
    const result = runCli(['hook', 'stop'], { cwd: fixture });
    const launcher = fs.realpathSync(path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'lazytrae.js'));
    const expected = `node '${launcher}' --root '${fs.realpathSync(fixture)}' init`;

    assert.equal(result.status, 1);
    assert.equal(result.stderr.includes(`Run "${expected}" to install hook scripts.`), true);
    assert.doesNotMatch(result.stderr, /Run "lazytrae init"/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
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
