'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { classifyAdaptiveDecision } = require('../src/lib/adaptive-decision');
const { validateAdaptiveSnapshot } = require('../src/lib/adaptive-snapshot');
const {
  computeRevisionFingerprint,
  processAdaptivePrompt,
} = require('../src/lib/adaptive-runtime');
const { makeFixture, readLoopState, runCli } = require('./test-helpers');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PLUGIN_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SHA = /^sha256:[0-9a-f]{64}$/;

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function declarationFingerprint(server) {
  const payload = Object.fromEntries(
    Object.entries(server).filter(([key]) => key !== '_lazytrae'),
  );
  return digest(JSON.stringify(payload));
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function makeGitFixture(prefix = 'lazytrae-adaptive-runtime-') {
  const root = makeFixture(prefix);
  fs.rmSync(path.join(root, '.git'), { recursive: true, force: true });
  fs.writeFileSync(path.join(root, '.gitignore'), [
    '.lazytrae/state/',
    '.lazytrae/logs/',
    '.lazytrae/loop/',
    '',
  ].join('\n'));
  runGit(root, ['init', '-q']);
  runGit(root, ['config', 'user.email', 'adaptive@example.invalid']);
  runGit(root, ['config', 'user.name', 'Adaptive Test']);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'baseline\n');
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-qm', 'fixture']);
  return root;
}

function activateLoop(root, additions = {}) {
  const statePath = path.join(root, '.lazytrae', 'state', 'active-loop.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  Object.assign(state, {
    run_id: 'run-adaptive-test',
    loop_state: 'active',
    brief_path: '.lazytrae/loop/run-adaptive-test/brief.md',
    goals_path: '.lazytrae/loop/run-adaptive-test/goals.json',
    ledger_path: '.lazytrae/loop/run-adaptive-test/ledger.jsonl',
    ...additions,
  });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  const loopDir = path.join(root, '.lazytrae', 'loop', 'run-adaptive-test');
  fs.mkdirSync(loopDir, { recursive: true });
  fs.writeFileSync(path.join(loopDir, 'brief.md'), 'Adaptive runtime fixture.\n');
  fs.writeFileSync(path.join(loopDir, 'goals.json'), '[]\n');
  fs.writeFileSync(path.join(loopDir, 'ledger.jsonl'), '');
}

function writeCurrentIdeProbe(root) {
  const probeDir = path.join(root, '.lazytrae', 'state', 'host-probes');
  fs.mkdirSync(probeDir, { recursive: true });
  fs.writeFileSync(path.join(probeDir, 'trae-ide.json'), `${JSON.stringify({
    schema_version: 2,
    contract_version: '2.0.0',
    product: 'trae',
    host: 'ide',
    status: 'accessible',
    detail: 'bounded fixture probe',
    region: 'unknown',
    edition: 'unknown',
    capabilities: [],
    observed_argv: [],
    host_readiness: 'pending',
    binary: { path: '/fixture/trae-ide', sha256: 'a'.repeat(64) },
  })}\n`);
}

function directiveLines(output) {
  return output.split('\n').filter((line) => line.startsWith('{"lazytraeAdaptive"'));
}

test('exact UTF-8 request digest and canonical camelCase snapshot are produced', () => {
  // Given: two prompts that collided under the previous 80-character slug.
  const prefix = 'repair-the-account-route-'.repeat(5);
  const first = `${prefix}alpha token=TOP_SECRET`;
  const second = `${prefix}beta token=TOP_SECRET`;

  // When: each prompt is classified.
  const a = classifyAdaptiveDecision(first);
  const b = classifyAdaptiveDecision(second);

  // Then: exact hashes differ, validate canonically, and disclose no prompt bytes.
  assert.equal(a.snapshot.requestDigest, digest(first));
  assert.equal(b.snapshot.requestDigest, digest(second));
  assert.notEqual(a.snapshot.requestDigest, b.snapshot.requestDigest);
  assert.equal(validateAdaptiveSnapshot(a.snapshot), true);
  assert.equal('escalation_count' in a.snapshot, false);
  assert.equal(JSON.stringify(a.snapshot).includes('TOP_SECRET'), false);
});

test('continuation requires request, revision, scope, and host compatibility', () => {
  // Given: a prior compatible decision with an advanced current stage.
  const prompt = 'Continue the bounded migration';
  const identity = {
    revisionFingerprint: { status: 'available', digest: digest('revision') },
    scopeFingerprint: digest('scope'),
    hostFingerprint: digest('host'),
  };
  const first = classifyAdaptiveDecision(prompt, { ...identity, decisionId: 'decision-original' });
  const prior = { ...first.snapshot, currentStage: 'verify' };

  // When: all identity fields match, then the host identity changes.
  const resumed = classifyAdaptiveDecision(prompt, { ...identity, priorSnapshot: prior });
  const changed = classifyAdaptiveDecision(prompt, {
    ...identity,
    priorSnapshot: prior,
    hostFingerprint: digest('different-host'),
  });

  // Then: only the compatible decision resumes.
  assert.equal(resumed.snapshot.decisionId, 'decision-original');
  assert.equal(resumed.snapshot.currentStage, 'verify');
  assert.notEqual(changed.snapshot.decisionId, 'decision-original');
  assert.match(changed.reasons.join(' '), /stale|changed|reclassif/i);
});

test('revision fingerprints stay deterministic across clean and dirty Git material', (t) => {
  // Given: a clean committed project.
  const root = makeGitFixture('lazytrae-adaptive-fingerprint-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = computeRevisionFingerprint(root);
  const cleanRepeat = computeRevisionFingerprint(root);

  // When: tracked, staged, and untracked material change in sequence.
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'working\n');
  const working = computeRevisionFingerprint(root);
  const workingRepeat = computeRevisionFingerprint(root);
  runGit(root, ['add', 'tracked.txt']);
  const staged = computeRevisionFingerprint(root);
  const stagedRepeat = computeRevisionFingerprint(root);
  fs.writeFileSync(path.join(root, 'untracked.txt'), 'untracked\n');
  const untracked = computeRevisionFingerprint(root);
  const untrackedRepeat = computeRevisionFingerprint(root);

  // Then: every material class has one available digest and each change is represented.
  for (const value of [clean, working, staged, untracked]) {
    assert.equal(value.status, 'available');
    assert.match(value.digest, SHA);
  }
  assert.deepEqual(cleanRepeat, clean);
  assert.deepEqual(workingRepeat, working);
  assert.deepEqual(stagedRepeat, staged);
  assert.deepEqual(untrackedRepeat, untracked);
  assert.equal(new Set([clean.digest, working.digest, staged.digest, untracked.digest]).size, 4);
});

test('active-loop persistence is atomic, canonical, and preserves unrelated fields', (t) => {
  // Given: an initialized Git project with one active loop and an unrelated field.
  const root = makeGitFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root, { unrelated_future_field: { keep: true } });

  // When: a normal prompt enters the adaptive runtime.
  const result = processAdaptivePrompt({ repoRoot: root, prompt: 'Fix one typo in one file.' });
  const state = readLoopState(root);

  // Then: one directive is presented and only the canonical adaptive block is added.
  assert.equal(result.directive.dispatch, 'presented-to-host');
  assert.equal(result.directive.hostExecution, 'not-observed');
  assert.equal(result.directive.persistence, 'updated:active-loop');
  assert.deepEqual(state.unrelated_future_field, { keep: true });
  assert.equal(validateAdaptiveSnapshot(state.adaptive), true);
  assert.equal(state.adaptive.requestDigest, digest('Fix one typo in one file.'));
});

test('corrupt persisted adaptive snapshot reclassifies without crashing or leaking nested fields', () => {
  const root = makeGitFixture('lazytrae-adaptive-corrupt-loop-');
  try {
    activateLoop(root, { unrelated_future_field: { keep: true } });
    const prompt = 'Fix one typo in one file.';
    const first = processAdaptivePrompt({ repoRoot: root, prompt });
    const statePath = path.join(root, '.lazytrae', 'state', 'active-loop.json');
    const corrupted = readLoopState(root);
    corrupted.adaptive.mode = 'corrupted';
    corrupted.adaptive.extra = true;
    fs.writeFileSync(statePath, `${JSON.stringify(corrupted, null, 2)}\n`);

    const result = processAdaptivePrompt({ repoRoot: root, prompt });
    const repaired = readLoopState(root);

    assert.equal(result.directive.continuation.status, 'reclassified');
    assert.notEqual(result.snapshot.decisionId, first.snapshot.decisionId);
    assert.equal(validateAdaptiveSnapshot(result.snapshot), true);
    assert.equal('extra' in repaired.adaptive, false);
    assert.deepEqual(repaired.unrelated_future_field, { keep: true });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('no active loop skips persistence and does not create lifecycle state', (t) => {
  // Given: an initialized project whose loop is idle.
  const root = makeGitFixture('lazytrae-adaptive-no-loop-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const before = fs.readFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'), 'utf8');

  // When: a prompt is classified.
  const result = processAdaptivePrompt({ repoRoot: root, prompt: 'Fix one typo.' });

  // Then: the directive is emitted without creating or activating a loop.
  assert.equal(result.directive.dispatch, 'presented-to-host');
  assert.equal(result.directive.persistence, 'skipped:no-active-loop');
  assert.equal(fs.readFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'), 'utf8'), before);
});

test('fresh init creates managed runtime ignores so adaptive persistence can resume', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-adaptive-fresh-init-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  runGit(root, ['init', '-q']);
  runGit(root, ['config', 'user.email', 'adaptive@example.invalid']);
  runGit(root, ['config', 'user.name', 'Adaptive Test']);
  const initialized = runCli(['init'], { cwd: root });
  assert.equal(initialized.status, 0, initialized.stderr);
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  for (const entry of ['.lazytrae/state/', '.lazytrae/logs/', '.lazytrae/loop/']) {
    assert.equal(ignore.includes(entry), true, entry);
  }
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'baseline\n');
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-qm', 'fixture']);
  activateLoop(root);
  writeCurrentIdeProbe(root);
  const first = processAdaptivePrompt({ repoRoot: root, prompt: 'Continue the initialized task.' });
  const second = processAdaptivePrompt({ repoRoot: root, prompt: 'Continue the initialized task.' });
  assert.equal(second.directive.continuation.status, 'resumed');
  assert.equal(second.snapshot.decisionId, first.snapshot.decisionId);
});

test('non-Git active loop never resumes an unavailable revision', (t) => {
  const root = makeFixture('lazytrae-adaptive-non-git-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.rmSync(path.join(root, '.git'), { recursive: true, force: true });
  activateLoop(root);
  const prompt = 'Fix one typo in one file.';
  const first = processAdaptivePrompt({ repoRoot: root, prompt });
  const second = processAdaptivePrompt({ repoRoot: root, prompt });
  assert.deepEqual(first.snapshot.revisionFingerprint, { status: 'unavailable', digest: null });
  assert.deepEqual(second.snapshot.revisionFingerprint, { status: 'unavailable', digest: null });
  assert.equal(second.directive.continuation.status, 'reclassified');
  assert.notEqual(second.snapshot.decisionId, first.snapshot.decisionId);
  assert.equal(first.directive.dispatch, 'blocked:revision-unavailable');
  assert.equal(second.directive.dispatch, 'blocked:revision-unavailable');
  assert.deepEqual(second.directive.workflowSurfaces, []);
});

test('verified package assets dispatch from a deterministic tracked-dirty revision', (t) => {
  // Given: a fully initialized package fixture whose tracked content changed.
  const root = makeGitFixture('lazytrae-adaptive-dirty-dispatch-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = computeRevisionFingerprint(root);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'dirty revision\n');
  const dirty = computeRevisionFingerprint(root);
  const dirtyRepeat = computeRevisionFingerprint(root);

  // When: the prompt enters the installed adaptive runtime.
  const result = processAdaptivePrompt({ repoRoot: root, prompt: 'Fix one typo.' });

  // Then: the authoritative dirty fingerprint remains available and permits dispatch.
  assert.equal(dirty.status, 'available');
  assert.match(dirty.digest, SHA);
  assert.notEqual(dirty.digest, clean.digest);
  assert.deepEqual(dirtyRepeat, dirty);
  assert.equal(result.directive.hostQualification, 'package-assets-verified');
  assert.deepEqual(result.snapshot.revisionFingerprint, dirty);
  assert.equal(result.directive.dispatch, 'presented-to-host');
  assert.equal(result.directive.persistence, 'skipped:no-active-loop');
});

test('unsafe active-loop state stops dispatch even when revision and assets are verified', (t) => {
  // Given: a clean initialized fixture whose active-loop file is a symlink escape.
  const root = makeGitFixture('lazytrae-adaptive-unsafe-state-');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-adaptive-unsafe-outside-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const outsideState = path.join(outside, 'active-loop.json');
  fs.writeFileSync(outsideState, '{}\n');
  const activeState = path.join(root, '.lazytrae', 'state', 'active-loop.json');
  fs.rmSync(activeState);
  fs.symlinkSync(outsideState, activeState);

  // When: the prompt enters the installed adaptive runtime.
  const result = processAdaptivePrompt({ repoRoot: root, prompt: 'Fix one typo.' });

  // Then: the unsafe persistence result is also a dispatch stop.
  assert.equal(result.directive.hostQualification, 'package-assets-verified');
  assert.equal(result.directive.persistence, 'skipped:unsafe-state');
  assert.equal(result.directive.dispatch, 'blocked:unsafe-state');
  assert.deepEqual(result.directive.workflowSurfaces, []);
});

test('post-escalation blocker stops dispatch and exposes the required decision', (t) => {
  // Given: an active loop that has consumed both automatic escalations.
  const root = makeGitFixture('lazytrae-adaptive-escalation-stop-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  const prompt = 'Fix the failing test.';
  const first = processAdaptivePrompt({
    repoRoot: root,
    prompt,
    context: {
      scope_revealed_broader: true,
      signals: { verification_failure: true },
    },
  });
  assert.equal(first.snapshot.escalationCount, 2);
  assert.equal(first.snapshot.blocker, null);

  // When: verification still fails after the escalation bound.
  const blocked = processAdaptivePrompt({
    repoRoot: root,
    prompt,
    context: { signals: { verification_failure: true } },
  });

  // Then: no begin-work action or workflow is presented.
  assert.notEqual(blocked.snapshot.blocker, null);
  assert.equal(blocked.directive.dispatch, 'blocked:escalation-bound');
  assert.deepEqual(blocked.directive.workflowSurfaces, []);
  assert.equal(blocked.snapshot.nextAction, blocked.snapshot.blocker.nextRequiredDecision);
});

test('approval-required action and forged host capability fail closed', (t) => {
  // Given: a project with an active loop but missing installed capability assets.
  const root = makeGitFixture('lazytrae-adaptive-forged-host-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  fs.rmSync(path.join(root, '.trae', 'skills'), { recursive: true, force: true });

  // When: the prompt requests installation and remote data egress.
  const result = processAdaptivePrompt({
    repoRoot: root,
    prompt: 'Install a provider and upload this repository to a remote service.',
  });

  // Then: dispatch is blocked and the forged capability set is degraded, never full-host.
  assert.equal(result.directive.dispatch, 'blocked:approval-required');
  assert.equal(result.directive.hostQualification, 'degraded');
  assert.deepEqual(result.directive.workflowSurfaces, []);
  assert.deepEqual(result.directive.approval.requiredClasses.sort(), [
    'install-or-download',
    'remote-data-egress',
  ]);
});

test('approval-blocked direct and installed hooks emit only their adaptive directive', (t) => {
  // Given: a fresh initialized project and a request that needs installation approval.
  const root = makeGitFixture('lazytrae-adaptive-approval-hook-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = JSON.stringify({ prompt: 'install a provider and use ultrawork' });

  // When: Trae invokes the generated installed hook.
  const installed = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
    cwd: root,
    input,
    encoding: 'utf8',
  });
  const direct = runCli(['hook', 'user-prompt-submit'], { cwd: root, input });

  // Then: each blocked decision is the only output; no legacy directive executes.
  for (const [surface, result] of [['installed', installed], ['direct', direct]]) {
    assert.equal(result.status, 0, `${surface}: ${result.stderr}`);
    const directives = directiveLines(result.stdout);
    assert.equal(directives.length, 1, surface);
    assert.equal(JSON.parse(directives[0]).lazytraeAdaptive.dispatch, 'blocked:approval-required', surface);
    assert.equal(result.stdout, `${directives[0]}\n`, surface);
    assert.doesNotMatch(result.stdout, /ULTRAWORK MODE ENABLED|LazyTrae workflow keyword detected/, surface);
  }
});

test('host-unverified direct and generated hooks emit only their adaptive directive', () => {
  const root = makeGitFixture('lazytrae-adaptive-host-unverified-hook-');
  try {
    const skillPath = path.join(root, '.trae', 'skills', 'lazy-start-work', 'SKILL.md');
    fs.writeFileSync(skillPath, '# tampered regular package asset\n');
    const input = JSON.stringify({ prompt: 'ulw: fix one typo in one file.' });

    const installed = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
      cwd: root,
      input,
      encoding: 'utf8',
    });
    const direct = runCli(['hook', 'user-prompt-submit'], { cwd: root, input });

    for (const [surface, result] of [['installed', installed], ['direct', direct]]) {
      assert.equal(result.status, 0, `${surface}: ${result.stderr}`);
      const directives = directiveLines(result.stdout);
      assert.equal(directives.length, 1, surface);
      const directive = JSON.parse(directives[0]).lazytraeAdaptive;
      assert.equal(directive.approval.status, 'not-required', surface);
      assert.equal(directive.hostQualification, 'degraded', surface);
      assert.equal(directive.dispatch, 'blocked:host-unverified', surface);
      assert.equal(result.stdout, `${directives[0]}\n`, surface);
      assert.doesNotMatch(result.stdout, /ULTRAWORK MODE ENABLED|LazyTrae workflow keyword detected/, surface);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('affirmative named workflows emit one complete directive on direct and generated hooks', (t) => {
  // Given: clean fresh-init fixtures for execution and long-horizon named workflows.
  const cases = [
    ['lazy-start-work', 'assisted'],
    ['lazy-ultrawork', 'orchestrated'],
  ];
  const roots = cases.map(([workflow]) => makeGitFixture(`lazytrae-adaptive-one-${workflow}-`));
  t.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

  for (let index = 0; index < cases.length; index += 1) {
    const [workflow, mode] = cases[index];
    const root = roots[index];
    const input = JSON.stringify({ prompt: `Use ${workflow} for this task.` });

    // When: both real hook surfaces receive the same affirmative named request.
    const installed = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
      cwd: root,
      input,
      encoding: 'utf8',
    });
    const direct = runCli(['hook', 'user-prompt-submit'], { cwd: root, input });

    // Then: the full stdout is exactly one adaptive directive on both surfaces.
    for (const [surface, result] of [['installed', installed], ['direct', direct]]) {
      assert.equal(result.status, 0, `${workflow}:${surface}:${result.stderr}`);
      const directives = directiveLines(result.stdout);
      assert.equal(directives.length, 1, `${workflow}:${surface}`);
      assert.equal(result.stdout, `${directives[0]}\n`, `${workflow}:${surface}`);
      const directive = JSON.parse(directives[0]).lazytraeAdaptive;
      assert.equal(directive.mode, mode, `${workflow}:${surface}`);
      assert.equal(directive.dispatch, 'presented-to-host', `${workflow}:${surface}`);
      assert.deepEqual(directive.workflowSurfaces, [workflow], `${workflow}:${surface}`);
    }
  }
});

test('negated and incidental lazy-ulw-loop mentions emit only direct adaptive output', (t) => {
  const prompts = [
    'Do not use lazy-ulw-loop. Fix one typo.',
    'Discuss lazy-ulw-loop as an example, then fix one typo.',
  ];
  const roots = prompts.map((_, index) => makeGitFixture(`lazytrae-adaptive-loop-negative-${index}-`));
  t.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

  for (let index = 0; index < prompts.length; index += 1) {
    const input = JSON.stringify({ prompt: prompts[index] });
    const root = roots[index];
    const installed = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
      cwd: root,
      input,
      encoding: 'utf8',
    });
    const direct = runCli(['hook', 'user-prompt-submit'], { cwd: root, input });

    for (const [surface, result] of [['installed', installed], ['direct', direct]]) {
      assert.equal(result.status, 0, `${surface}: ${result.stderr}`);
      const directives = directiveLines(result.stdout);
      assert.equal(directives.length, 1, `${surface}: directive count`);
      const directive = JSON.parse(directives[0]).lazytraeAdaptive;
      assert.equal(directive.mode, 'direct', `${surface}: mode`);
      assert.equal(directive.explicitWorkflow, null, `${surface}: explicit workflow`);
      assert.equal(result.stdout, `${directives[0]}\n`, `${surface}: legacy output`);
      assert.doesNotMatch(result.stdout, /ULTRAWORK MODE ENABLED|LazyTrae workflow keyword detected/, `${surface}: legacy output`);
    }
  }
});

test('generated hook launcher fallback is the only directive for named workflow input', (t) => {
  // Given: a fresh-init hook whose declared launcher no longer validates.
  const root = makeGitFixture('lazytrae-adaptive-invalid-launcher-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declarationPath = path.join(root, '.trae', 'mcp.json');
  const declaration = JSON.parse(fs.readFileSync(declarationPath, 'utf8'));
  declaration.mcpServers.lazytrae.args[0] = path.join(root, 'missing', 'lazytrae.js');
  fs.writeFileSync(declarationPath, `${JSON.stringify(declaration, null, 2)}\n`);

  // When: the generated hook receives a named workflow prompt.
  const result = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
    cwd: root,
    input: JSON.stringify({ prompt: 'Use lazy-ultrawork for this task.' }),
    encoding: 'utf8',
  });

  // Then: the blocked fallback is complete and legacy output does not follow it.
  assert.equal(result.status, 0, result.stderr);
  const directives = directiveLines(result.stdout);
  assert.equal(directives.length, 1);
  assert.equal(result.stdout, `${directives[0]}\n`);
  assert.equal(
    JSON.parse(directives[0]).lazytraeAdaptive.dispatch,
    'blocked:host-unverified',
  );
});

test('generated hook rejects a self-consistent project-forged launcher without executing it', (t) => {
  // Given: project-owned MCP metadata, package identity, and a forged launcher all agree.
  const root = makeGitFixture('lazytrae-adaptive-forged-launcher-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const forgedRelease = path.join(root, 'forged-release');
  const forgedLauncher = path.join(forgedRelease, 'bin', 'lazytrae.js');
  const sentinel = path.join(root, 'forged-launcher-executed');
  fs.mkdirSync(path.dirname(forgedLauncher), { recursive: true });
  fs.writeFileSync(
    path.join(forgedRelease, 'package.json'),
    `${JSON.stringify({ name: 'lazytrae-ai', version: '1.0.3' })}\n`,
  );
  fs.writeFileSync(forgedLauncher, [
    "'use strict';",
    `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'executed\\n');`,
    "process.stdout.write(JSON.stringify({ lazytraeAdaptive: { kind: 'workflow-decision', mode: 'forged' } }) + '\\n');",
    '',
  ].join('\n'));
  const declarationPath = path.join(root, '.trae', 'mcp.json');
  const declaration = JSON.parse(fs.readFileSync(declarationPath, 'utf8'));
  const server = declaration.mcpServers.lazytrae;
  server.args[0] = fs.realpathSync(forgedLauncher);
  server._lazytrae.fingerprint = declarationFingerprint(server);
  fs.writeFileSync(declarationPath, `${JSON.stringify(declaration, null, 2)}\n`);

  // When: the generated installed hook handles a normal prompt.
  const result = spawnSync('bash', [path.join(root, '.trae', 'hooks', 'user-prompt-submit.sh')], {
    cwd: root,
    input: JSON.stringify({ prompt: 'Fix one typo in one file.' }),
    encoding: 'utf8',
  });

  // Then: only trusted release code may run; project-forged identity is irrelevant.
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(sentinel), false, 'the forged launcher executed');
  const directives = directiveLines(result.stdout);
  assert.equal(directives.length, 1);
  assert.equal(result.stdout, `${directives[0]}\n`);
  const directive = JSON.parse(directives[0]).lazytraeAdaptive;
  assert.notEqual(directive.mode, 'forged');
  assert.equal(directive.dispatch, 'blocked:host-unverified');
});

test('context pressure has one directive and one intentional recovery mutation per public route', (t) => {
  // Given: equivalent direct/generated projects and the adaptive-only child route used by the wrapper.
  const directRoot = makeGitFixture('lazytrae-context-direct-');
  const installedRoot = makeGitFixture('lazytrae-context-installed-');
  const adaptiveOnlyRoot = makeGitFixture('lazytrae-context-adaptive-only-');
  const roots = [directRoot, installedRoot, adaptiveOnlyRoot];
  t.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));
  const input = JSON.stringify({ prompt: 'The context_length_exceeded marker appeared.' });
  const sessionsPath = (root) => path.join(root, '.lazytrae', 'state', 'sessions.json');
  const adaptiveOnlyBefore = fs.readFileSync(sessionsPath(adaptiveOnlyRoot), 'utf8');

  // When: callers use the direct CLI, generated hook, and wrapper-internal adaptive-only child.
  const direct = runCli(['hook', 'user-prompt-submit'], { cwd: directRoot, input });
  const installed = spawnSync('bash', [path.join(installedRoot, '.trae', 'hooks', 'user-prompt-submit.sh')], {
    cwd: installedRoot,
    input,
    encoding: 'utf8',
  });
  const adaptiveOnly = runCli(['hook', 'user-prompt-submit'], {
    cwd: adaptiveOnlyRoot,
    input,
    env: { ...process.env, LAZYTRAE_ADAPTIVE_ONLY: '1' },
  });

  // Then: public routes emit only the same decision; the wrapper child cannot mutate before validation.
  for (const [surface, result] of [['direct', direct], ['installed', installed], ['adaptive-only', adaptiveOnly]]) {
    assert.equal(result.status, 0, `${surface}: ${result.stderr}`);
    const directives = directiveLines(result.stdout);
    assert.equal(directives.length, 1, `${surface}: directive count`);
    assert.equal(result.stdout, `${directives[0]}\n`, `${surface}: stdout`);
    assert.doesNotMatch(result.stdout, /Context pressure detected|Post-compact recovery/, surface);
  }
  assert.deepEqual(
    JSON.parse(directiveLines(installed.stdout)[0]),
    JSON.parse(directiveLines(direct.stdout)[0]),
  );
  assert.equal(fs.readFileSync(sessionsPath(adaptiveOnlyRoot), 'utf8'), adaptiveOnlyBefore);
  for (const [surface, root] of [['direct', directRoot], ['installed', installedRoot]]) {
    const state = JSON.parse(fs.readFileSync(sessionsPath(root), 'utf8')).compaction_state;
    assert.equal(state.post_compact_recovery_needed, true, surface);
    assert.equal(state.compaction_count, 1, surface);
    assert.equal(state.recovery_events.length, 1, surface);
    assert.equal(state.recovery_events[0].action, 'marked', surface);
  }
});

test('installed hook, direct hook, and run intake emit one identical adaptive directive', (t) => {
  // Given: equivalent fresh initialized projects with active loops.
  const installedRoot = makeGitFixture('lazytrae-adaptive-installed-hook-');
  const directRoot = makeGitFixture('lazytrae-adaptive-direct-hook-');
  const runRoot = makeGitFixture('lazytrae-adaptive-direct-run-');
  t.after(() => [installedRoot, directRoot, runRoot].forEach((root) => {
    fs.rmSync(root, { recursive: true, force: true });
  }));
  for (const root of [installedRoot, directRoot, runRoot]) {
    activateLoop(root);
  }
  const input = JSON.stringify({ prompt: 'Fix one typo in one file.' });

  // When: Trae invokes the installed shell hook and the CLI dispatches directly.
  const installed = spawnSync('bash', [path.join(installedRoot, '.trae', 'hooks', 'user-prompt-submit.sh')], {
    cwd: installedRoot,
    input,
    encoding: 'utf8',
  });
  const direct = runCli(['hook', 'user-prompt-submit'], { cwd: directRoot, input });
  const run = runCli(['run', 'Fix one typo in one file.'], {
    cwd: runRoot,
    env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
  });

  // Then: each route emits exactly one machine-consumable decision with the same policy result.
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(direct.status, 0, direct.stderr);
  assert.equal(directiveLines(installed.stdout).length, 1);
  assert.equal(directiveLines(direct.stdout).length, 1);
  assert.equal(directiveLines(run.stdout).length, 1);
  const installedDirective = JSON.parse(directiveLines(installed.stdout)[0]).lazytraeAdaptive;
  const directDirective = JSON.parse(directiveLines(direct.stdout)[0]).lazytraeAdaptive;
  const runDirective = JSON.parse(directiveLines(run.stdout)[0]).lazytraeAdaptive;
  assert.deepEqual(installedDirective, directDirective);
  assert.deepEqual(installedDirective, runDirective);
});

test('malformed hook input remains advisory but emits no executable decision', (t) => {
  // Given/When: the direct hook receives malformed JSON.
  const root = makeGitFixture('lazytrae-adaptive-malformed-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = runCli(['hook', 'user-prompt-submit'], { cwd: root, input: '{bad-json' });

  // Then: the hook exits zero and emits one fail-closed directive.
  assert.equal(result.status, 0);
  assert.equal(directiveLines(result.stdout).length, 1);
  const directive = JSON.parse(directiveLines(result.stdout)[0]).lazytraeAdaptive;
  assert.equal(directive.dispatch, 'blocked:malformed-input');
  assert.deepEqual(directive.workflowSurfaces, []);
});

test('stale active-loop decision is reclassified with diagnostic-only prior evidence', (t) => {
  const root = makeGitFixture('lazytrae-adaptive-stale-loop-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  const prompt = 'Fix one typo without leaking SENSITIVE_PROMPT_TEXT.';
  processAdaptivePrompt({ repoRoot: root, prompt });
  const first = readLoopState(root).adaptive;
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'material revision change\n');
  const secondResult = processAdaptivePrompt({ repoRoot: root, prompt });
  const second = readLoopState(root).adaptive;
  const ledger = fs.readFileSync(path.join(root, secondResult.snapshot
    ? '.lazytrae/loop/run-adaptive-test/ledger.jsonl'
    : 'missing'), 'utf8');
  const event = JSON.parse(ledger.trim().split('\n').at(-1));
  assert.equal(secondResult.directive.continuation.status, 'reclassified');
  assert.notEqual(second.decisionId, first.decisionId);
  assert.equal(event.mutation, 'adaptive-decision-reclassified');
  assert.equal(event.details.prior_completion, 'rejected');
  assert.equal(event.details.prior_decision_id, first.decisionId);
  assert.equal(event.details.changed_material.includes('revisionFingerprint'), true);
  assert.equal(ledger.includes('SENSITIVE_PROMPT_TEXT'), false);
});

test('unchanged active-loop intake resumes the compatible decision', (t) => {
  const root = makeGitFixture('lazytrae-adaptive-resume-loop-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  writeCurrentIdeProbe(root);
  const first = processAdaptivePrompt({ repoRoot: root, prompt: 'Continue this bounded task.' });
  const second = processAdaptivePrompt({ repoRoot: root, prompt: 'Continue this bounded task.' });
  assert.equal(second.directive.continuation.status, 'resumed');
  assert.equal(second.snapshot.decisionId, first.snapshot.decisionId);
  assert.equal(second.directive.persistence, 'updated:active-loop');
});

test('native probe binary mutation reclassifies the installed continuation', (t) => {
  const root = makeGitFixture('lazytrae-adaptive-native-probe-change-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  writeCurrentIdeProbe(root);
  const prompt = 'Continue this bounded task.';
  const first = processAdaptivePrompt({ repoRoot: root, prompt });
  const probePath = path.join(root, '.lazytrae', 'state', 'host-probes', 'trae-ide.json');
  const probe = JSON.parse(fs.readFileSync(probePath, 'utf8'));
  probe.binary.sha256 = 'b'.repeat(64);
  fs.writeFileSync(probePath, `${JSON.stringify(probe)}\n`);

  const changed = processAdaptivePrompt({ repoRoot: root, prompt });

  assert.equal(changed.directive.continuation.status, 'reclassified');
  assert.notEqual(changed.snapshot.decisionId, first.snapshot.decisionId);
  assert.notEqual(changed.snapshot.hostFingerprint, first.snapshot.hostFingerprint);

  const unavailable = processAdaptivePrompt({
    repoRoot: root,
    prompt,
    context: { marketplace_version: 'not-a-version' },
  });
  assert.equal(unavailable.directive.continuation.status, 'reclassified');
  assert.notEqual(unavailable.snapshot.decisionId, changed.snapshot.decisionId);
});

test('marketplace version mutation reclassifies the installed continuation', (t) => {
  const root = makeGitFixture('lazytrae-adaptive-marketplace-change-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  writeCurrentIdeProbe(root);
  const prompt = 'Continue this bounded task.';
  const first = processAdaptivePrompt({
    repoRoot: root,
    prompt,
    context: { marketplace_version: '1.0.0' },
  });

  const changed = processAdaptivePrompt({
    repoRoot: root,
    prompt,
    context: { marketplace_version: '2.0.0' },
  });

  assert.equal(changed.directive.continuation.status, 'reclassified');
  assert.notEqual(changed.snapshot.decisionId, first.snapshot.decisionId);
  assert.notEqual(changed.snapshot.hostFingerprint, first.snapshot.hostFingerprint);
});

test('unavailable native probe cannot resume the installed continuation', (t) => {
  const root = makeGitFixture('lazytrae-adaptive-native-probe-missing-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  activateLoop(root);
  writeCurrentIdeProbe(root);
  const prompt = 'Continue this bounded task.';
  const first = processAdaptivePrompt({ repoRoot: root, prompt });
  fs.rmSync(path.join(root, '.lazytrae', 'state', 'host-probes', 'trae-ide.json'));

  const unavailable = processAdaptivePrompt({ repoRoot: root, prompt });

  assert.equal(unavailable.directive.continuation.status, 'reclassified');
  assert.notEqual(unavailable.snapshot.decisionId, first.snapshot.decisionId);
});

test('source and installation template hook stay byte-identical', () => {
  // Given/When/Then: both shipped hook copies are the same executable behavior.
  const source = fs.readFileSync(path.join(PLUGIN_ROOT, '.trae', 'hooks', 'user-prompt-submit.sh'));
  const template = fs.readFileSync(path.join(PACKAGE_ROOT, 'templates', 'hooks', 'user-prompt-submit.sh'));
  assert.deepEqual(source, template);
});
