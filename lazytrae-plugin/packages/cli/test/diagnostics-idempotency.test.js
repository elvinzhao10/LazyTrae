const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { formatReadinessSummary } = require('../src/lib/lazyseries-capability-readiness');
const { runCli } = require('./test-helpers');

function makeProject(prefix = 'lazytrae-diagnostics-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  return root;
}

function removeProject(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('init followed by sync is idempotent for the managed onboarding block', () => {
  const project = makeProject('lazytrae-idempotent spaces-');
  try {
    fs.writeFileSync(path.join(project, 'AGENTS.md'), '# User rules\n\nKeep this.\n');
    const initialized = runCli(['init', '--host', 'ide'], { cwd: project });
    assert.equal(initialized.status, 0, initialized.stderr);

    const beforeSync = fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    const synced = runCli(['sync'], { cwd: project });

    assert.equal(synced.status, 0, synced.stderr);
    assert.match(synced.stdout, /AGENTS\.md managed blocks \(no changes\)/);
    assert.equal(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), beforeSync);
  } finally {
    removeProject(project);
  }
});

test('doctor recognizes the canonical onboarding managed block', () => {
  const project = makeProject('lazytrae-doctor-managed-');
  try {
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
    const doctor = runCli(['doctor'], { cwd: project });

    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /AGENTS\.md managed blocks\s+PASS/);
    assert.match(doctor.stdout, /onboarding/);
  } finally {
    removeProject(project);
  }
});

test('doctor warns on a malformed managed marker without discarding user content', () => {
  const project = makeProject('lazytrae-doctor-malformed-managed-');
  try {
    fs.writeFileSync(path.join(project, 'AGENTS.md'), '# User rules\n\nKeep this.\n');
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
    const agentsPath = path.join(project, 'AGENTS.md');
    const malformed = fs.readFileSync(agentsPath, 'utf8').replace(
      '<!-- lazytrae:managed:end:onboarding -->',
      '<!-- lazytrae:managed:end:other -->',
    );
    fs.writeFileSync(agentsPath, malformed);

    const doctor = runCli(['doctor'], { cwd: project });

    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /AGENTS\.md managed blocks\s+WARN/);
    assert.match(doctor.stdout, /Malformed managed block markers: onboarding, other/);
    assert.match(fs.readFileSync(agentsPath, 'utf8'), /# User rules[\s\S]*Keep this\./);
  } finally {
    removeProject(project);
  }
});

test('doctor warns on duplicate balanced managed blocks instead of reporting a false pass', () => {
  const project = makeProject('lazytrae-doctor-duplicate-managed-');
  try {
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
    const agentsPath = path.join(project, 'AGENTS.md');
    const content = fs.readFileSync(agentsPath, 'utf8');
    const blockStart = content.indexOf('<!-- lazytrae:managed:start:onboarding -->');
    const blockEnd = content.indexOf('<!-- lazytrae:managed:end:onboarding -->')
      + '<!-- lazytrae:managed:end:onboarding -->'.length;
    fs.writeFileSync(agentsPath, `${content}\n${content.slice(blockStart, blockEnd)}\n`);

    const doctor = runCli(['doctor'], { cwd: project });

    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /AGENTS\.md managed blocks\s+WARN/);
    assert.match(doctor.stdout, /Malformed managed block markers: onboarding/);
  } finally {
    removeProject(project);
  }
});

test('doctor warns on crossed managed markers instead of reporting a false pass', () => {
  const project = makeProject('lazytrae-doctor-crossed-managed-');
  try {
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
    fs.writeFileSync(
      path.join(project, 'AGENTS.md'),
      '# User rules\n\nKeep this.\n'
        + '<!-- lazytrae:managed:start:onboarding -->\n'
        + 'ambiguous body\n'
        + '<!-- lazytrae:managed:start:other -->\n'
        + '<!-- lazytrae:managed:end:onboarding -->\n'
        + '<!-- lazytrae:managed:end:other -->\n',
    );

    const doctor = runCli(['doctor'], { cwd: project });

    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /AGENTS\.md managed blocks\s+WARN/);
    assert.match(doctor.stdout, /Malformed managed block markers: onboarding, other/);
    assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /# User rules[\s\S]*Keep this\./);
  } finally {
    removeProject(project);
  }
});

test('readiness summary names every member in each status group', () => {
  const summary = formatReadinessSummary([
    { status: 'host-ready', provider: 'ripgrep' },
    { status: 'missing', provider: 'lsp' },
    { status: 'missing', provider: 'codegraph' },
    { status: 'disabled', provider: 'context7' },
  ]);

  assert.match(summary, /host-ready=1 \[ripgrep\]/);
  assert.match(summary, /missing=2 \[lsp, codegraph\]/);
  assert.match(summary, /disabled=1 \[context7\]/);
});

test('invalid Git pointer is a warning and does not block project setup', () => {
  const project = makeProject('lazytrae-invalid-git-pointer-');
  try {
    fs.rmSync(path.join(project, '.git'), { recursive: true, force: true });
    fs.writeFileSync(path.join(project, '.git'), 'gitdir: /path/that/does/not/exist\n');
    const initialized = runCli(['init', '--host', 'ide'], { cwd: project });

    assert.equal(initialized.status, 0, initialized.stderr);
    assert.match(initialized.stdout, /Warnings:[\s\S]*Git metadata pointer target is missing/i);
    assert.ok(fs.existsSync(path.join(project, '.trae', 'skills')));

    const doctor = runCli(['doctor'], { cwd: project });
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Git metadata.*WARN|WARN.*Git metadata|invalid Git/i);
  } finally {
    removeProject(project);
  }
});

test('consumer doctor describes the release runtime without an alarming source-tree warning', () => {
  const project = makeProject('lazytrae-doctor-runtime-');
  try {
    assert.equal(runCli(['init', '--host', 'ide'], { cwd: project }).status, 0);
    const doctor = runCli(['doctor'], { cwd: project });

    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /MCP runtime[\s\S]*release-owned LazyTrae CLI/);
    assert.doesNotMatch(doctor.stdout, /Uses the installed lazytrae CLI; source-package checks skipped/);
  } finally {
    removeProject(project);
  }
});

test('nested invocation with spaces preserves user configuration across repeated onboarding', () => {
  const project = makeProject('lazytrae-nested spaces-');
  const nested = path.join(project, 'packages', 'app');
  try {
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(project, 'AGENTS.md'), '# User rules\n\nDo not remove.\n');
    fs.writeFileSync(path.join(project, '.gitignore'), 'dist/\n');
    fs.mkdirSync(path.join(project, '.lazytrae'), { recursive: true });
    fs.writeFileSync(path.join(project, '.lazytrae', 'config.json'), JSON.stringify({ schema_version: 1, user_setting: 'keep' }) + '\n');

    const first = runCli(['init', '--host', 'ide'], { cwd: nested });
    const second = runCli(['init', '--host', 'ide'], { cwd: nested });
    const synced = runCli(['sync'], { cwd: nested });

    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(synced.status, 0, synced.stderr);
    assert.match(second.stdout, /AGENTS\.md \(no changes needed\)/);
    assert.match(synced.stdout, /AGENTS\.md managed blocks \(no changes\)/);
    assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /Do not remove\./);
    assert.match(fs.readFileSync(path.join(project, '.gitignore'), 'utf8'), /^dist\/\n/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, '.lazytrae', 'config.json'), 'utf8')), {
      schema_version: 1,
      user_setting: 'keep',
    });
  } finally {
    removeProject(project);
  }
});
