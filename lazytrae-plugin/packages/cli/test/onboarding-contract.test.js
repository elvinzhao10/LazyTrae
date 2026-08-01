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
const PORTABLE_LOCAL_COMMAND = 'node "<install-root>/LazyTrae/launcher.js" --root "<project-root>"';

function assertNoUnsafeOnboardingClaims(content, source) {
  assert.doesNotMatch(content, /\/Users\/(?:[^/< >]+)\//, `${source} must not contain a developer-specific absolute path`);
  assert.doesNotMatch(
    content,
    /^\s*(?:\$\s+)?lazytrae\s+(?:init|sync|load-check|doctor|verify|work)\b/im,
    `${source} must not prescribe a bare PATH launcher`,
  );
  assert.doesNotMatch(content, /\btrae-cli\s+mcp\s+add-json\b/i, `${source} must not prescribe the undocumented add-json route`);
  assert.doesNotMatch(
    content,
    /\bLazyTrae supports (?:Trae IDE|Trae Work|Trae CLI)\b/i,
    `${source} must not make an unqualified Trae support claim`,
  );
  assert.doesNotMatch(
    content,
    /(?:copied|cloned|linked|manifest|load-check|package files?)[^.]{0,180}(?:host[- ]ready|host readiness\s*(?::|is)?\s*(?:ready|pass|full))/i,
    `${source} must not turn copied package evidence into host readiness`,
  );
}

function assertLocalInitDeepGuidance(content, source) {
  assert.doesNotMatch(content, BARE_INITDEEP_COMMAND, source);
  assert.match(content, /\.trae\/mcp\.json/, source);
  assert.match(content, /mcpServers\.lazytrae/, source);
  assert.match(content, /command[^\n]*node/, source);
  assert.match(content, /node "<absolute-release-launcher[^\n]*--root "<absolute-project-root/, source);
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
    assert.match(content, /Node\.js LTS 20/i, documentPath);
    assert.match(content, /\bGit\b/, documentPath);
    assert.match(content, /https:\/\/github\.com\/elvinzhao10\/LazyTrae/, documentPath);
    assert.match(content, /\bonboard\b/i, documentPath);
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
  assert.match(hostRoutes, /Trae CLI[\s\S]*load-check --host cli[\s\S]*documented\/manual/i);
  assert.doesNotMatch(hostRoutes, /trae-cli mcp add-json/i);

  const readme = fs.readFileSync(path.join(REPOSITORY_ROOT, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /npm install --global/i);
  assert.match(readme, /stable launcher/i);
});

test('root and installed AGENTS share one portable local-first protocol', () => {
  const rootGuide = fs.readFileSync(path.join(REPOSITORY_ROOT, 'AGENTS.md'), 'utf8');
  const installedTemplate = readTemplate('AGENTS.md');
  const renderedTemplate = installedTemplate.replaceAll('__LAZYTRAE_LOCAL_COMMAND__', PORTABLE_LOCAL_COMMAND);

  assert.equal(rootGuide, renderedTemplate);
  assertNoUnsafeOnboardingClaims(rootGuide, 'root AGENTS.md');
  assertNoUnsafeOnboardingClaims(installedTemplate, 'installed AGENTS.md template');
});

test('every shipped host route is portable, JSON-first, and evidence-qualified', () => {
  const hostRouteDocs = [
    path.join(REPOSITORY_ROOT, 'AGENTS.md'),
    path.join(REPOSITORY_ROOT, 'README.md'),
    path.join(REPOSITORY_ROOT, 'docs', '03-install-and-host-verification.md'),
    path.join(REPOSITORY_ROOT, 'docs', '10-host-capability-matrix.md'),
    path.join(REPOSITORY_ROOT, 'docs', 'reference', 'host-routes.md'),
    path.join(REPOSITORY_ROOT, 'lazytrae-plugin', 'README.md'),
    path.join(REPOSITORY_ROOT, 'lazytrae-plugin', 'packages', 'cli', 'README.md'),
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'AGENTS.md'),
  ];

  for (const documentPath of hostRouteDocs) {
    const content = fs.readFileSync(documentPath, 'utf8');
    assertNoUnsafeOnboardingClaims(content, documentPath);
    assert.match(content, /documented package\s+route/i, documentPath);
    assert.match(content, /observed prerelease\s+route/i, documentPath);
    assert.match(content, /HOST\s+READINESS:\s*PENDING/i, documentPath);
    assert.match(content, /load-check\s+--host\s+work/i, documentPath);
    assert.match(content, /LAZYTRAE_MCP_JSON_BEGIN/i, documentPath);
    assert.match(content, /Settings → MCP/i, documentPath);
    assert.match(content, /load-check\s+--host\s+cli/i, documentPath);
    assert.match(content, /(?:no|does not assume a) public universal MCP registration\s+command/i, documentPath);
  }
});

test('unsafe copied onboarding claims are rejected by the documentation contract', () => {
  const invalidDocuments = [
    ['bare launcher', 'lazytrae load-check --host ide', /bare PATH launcher/],
    ['developer path', 'node /Users/alice/Desktop/LazyTrae/bin/lazytrae.js doctor', /developer-specific absolute path/],
    ['unsupported CLI command', 'trae-cli mcp add-json lazytrae {}', /undocumented add-json route/],
    ['unqualified support', 'LazyTrae supports Trae Work.', /unqualified Trae support claim/],
    ['copied files imply host readiness', 'Copied package files mean host readiness: ready.', /copied package evidence/],
  ];

  for (const [source, content, expected] of invalidDocuments) {
    assert.throws(() => assertNoUnsafeOnboardingClaims(content, source), expected);
  }
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
