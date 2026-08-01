'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { makeGitFixture, runCli } = require('./test-helpers');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const EXPECTED_MAX_HOOK_INPUT_BYTES = 1024 * 1024;

function directiveLines(output) {
  return output.split('\n').filter((line) => line.startsWith('{"lazytraeAdaptive"'));
}

function makeGeneratedHookFixture(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const release = path.join(root, 'release');
  const project = path.join(root, 'project');
  fs.cpSync(PACKAGE_ROOT, release, { recursive: true });
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  const launcher = path.join(release, 'bin', 'lazytrae.js');
  const initialized = spawnSync(process.execPath, [
    launcher, '--root', project, 'init', '--host', 'ide',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { launcher, project };
}

test('oversized direct hook input is rejected before prompt processing without raw disclosure', (t) => {
  // Given: a valid hook event whose encoded bytes exceed the input boundary.
  const root = makeGitFixture('lazytrae-hook-input-bound-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const rawMarker = 'RAW_OVERSIZED_HOOK_MARKER';
  const input = JSON.stringify({
    prompt: `${rawMarker}${'x'.repeat(EXPECTED_MAX_HOOK_INPUT_BYTES)}`,
  });
  assert.equal(Buffer.byteLength(input, 'utf8') > EXPECTED_MAX_HOOK_INPUT_BYTES, true);

  // When: the direct hook receives the oversized event.
  const result = runCli(['hook', 'user-prompt-submit'], {
    cwd: root,
    input,
    env: { ...process.env, LAZYTRAE_ADAPTIVE_ONLY: '1' },
  });

  // Then: it remains advisory, emits one non-executable decision, and discloses no input bytes.
  assert.equal(result.status, 0, result.stderr);
  assert.equal(directiveLines(result.stdout).length, 1);
  const directive = JSON.parse(directiveLines(result.stdout)[0]).lazytraeAdaptive;
  assert.equal(directive.dispatch, 'blocked:malformed-input');
  assert.equal(directive.requestDigest, null);
  assert.deepEqual(directive.workflowSurfaces, []);
  assert.equal(result.stdout.includes(rawMarker), false);
  assert.equal(result.stderr.includes(rawMarker), false);
});

test('generated hook rejects oversized input before materializing it or invoking the release launcher', (t) => {
  // Given: a generated hook and a release-path spy that records any launcher invocation.
  const { launcher, project } = makeGeneratedHookFixture(
    t,
    'lazytrae-generated-hook-input-bound-',
  );
  const sentinel = path.join(project, 'launcher-executed');
  fs.writeFileSync(launcher, [
    "'use strict';",
    `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'executed\\n');`,
    "process.stdout.write(JSON.stringify({ lazytraeAdaptive: { kind: 'workflow-decision' } }) + '\\n');",
    '',
  ].join('\n'));
  const rawMarker = 'RAW_GENERATED_OVERSIZED_MARKER';
  const input = Buffer.from(JSON.stringify({
    prompt: `${rawMarker}${'x'.repeat(EXPECTED_MAX_HOOK_INPUT_BYTES)}`,
  }));
  assert.equal(input.byteLength > EXPECTED_MAX_HOOK_INPUT_BYTES, true);

  // When: the actual installed shell boundary receives the oversized event.
  const result = spawnSync('/bin/bash', [
    path.join(project, '.trae', 'hooks', 'user-prompt-submit.sh'),
  ], { cwd: project, input, encoding: 'utf8' });

  // Then: the shell emits one malformed decision without invoking any launcher.
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(sentinel), false, 'release launcher was invoked');
  const directives = directiveLines(result.stdout);
  assert.equal(directives.length, 1);
  assert.equal(result.stdout, `${directives[0]}\n`);
  const directive = JSON.parse(directives[0]).lazytraeAdaptive;
  assert.equal(directive.dispatch, 'blocked:malformed-input');
  assert.equal(directive.requestDigest, null);
  assert.equal(result.stdout.includes(rawMarker), false);
  assert.equal(result.stderr.includes(rawMarker), false);
});

test('direct and generated hooks reject malformed UTF-8 as one non-executable directive', (t) => {
  // Given: invalid UTF-8 inside an otherwise valid JSON prompt string.
  const directRoot = makeGitFixture('lazytrae-hook-invalid-utf8-direct-');
  t.after(() => fs.rmSync(directRoot, { recursive: true, force: true }));
  const { project } = makeGeneratedHookFixture(t, 'lazytrae-hook-invalid-utf8-generated-');
  const input = Buffer.concat([
    Buffer.from('{"prompt":"invalid-'),
    Buffer.from([0xff]),
    Buffer.from('-utf8"}'),
  ]);

  // When: both public hook routes receive the same malformed byte stream.
  const direct = runCli(['hook', 'user-prompt-submit'], { cwd: directRoot, input });
  const installed = spawnSync('/bin/bash', [
    path.join(project, '.trae', 'hooks', 'user-prompt-submit.sh'),
  ], { cwd: project, input, encoding: 'utf8' });

  // Then: replacement decoding never turns attacker bytes into a normal decision.
  for (const [surface, result] of [['direct', direct], ['installed', installed]]) {
    assert.equal(result.status, 0, `${surface}: ${result.stderr}`);
    const directives = directiveLines(result.stdout);
    assert.equal(directives.length, 1, surface);
    assert.equal(result.stdout, `${directives[0]}\n`, surface);
    const directive = JSON.parse(directives[0]).lazytraeAdaptive;
    assert.equal(directive.dispatch, 'blocked:malformed-input', surface);
    assert.equal(directive.requestDigest, null, surface);
    assert.deepEqual(directive.workflowSurfaces, [], surface);
  }
});

test('direct and generated hooks reject raw NUL before shell normalization', (t) => {
  // Given: a raw NUL inside an otherwise valid JSON prompt string.
  const directRoot = makeGitFixture('lazytrae-hook-nul-direct-');
  t.after(() => fs.rmSync(directRoot, { recursive: true, force: true }));
  const { project } = makeGeneratedHookFixture(t, 'lazytrae-hook-nul-generated-');
  const input = Buffer.concat([
    Buffer.from('{"prompt":"fi'),
    Buffer.from([0x00]),
    Buffer.from('x typo"}'),
  ]);

  // When: both public hook routes receive the same malformed byte stream.
  const direct = runCli(['hook', 'user-prompt-submit'], { cwd: directRoot, input });
  const installed = spawnSync('/bin/bash', [
    path.join(project, '.trae', 'hooks', 'user-prompt-submit.sh'),
  ], { cwd: project, input, encoding: 'utf8' });

  // Then: neither surface can normalize the event into an executable decision.
  for (const [surface, result] of [['direct', direct], ['installed', installed]]) {
    assert.equal(result.status, 0, `${surface}: ${result.stderr}`);
    const directives = directiveLines(result.stdout);
    assert.equal(directives.length, 1, surface);
    assert.equal(result.stdout, `${directives[0]}\n`, surface);
    const directive = JSON.parse(directives[0]).lazytraeAdaptive;
    assert.equal(directive.dispatch, 'blocked:malformed-input', surface);
    assert.equal(directive.requestDigest, null, surface);
    assert.deepEqual(directive.workflowSurfaces, [], surface);
  }
});
