'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'lazytrae.js');
const ALL_GATES = [
  'targeted-tests',
  'dependency-tests',
  'contract-tests',
  'paired-full-suites',
  'independent-review',
  'security-review',
  'real-surface',
  'final-assertions',
];

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function makeScenario() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-risk-project-'));
  const controls = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-risk-controls-'));
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'clean\n');
  git(root, ['init', '-q']);
  git(root, ['add', 'tracked.txt']);
  git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  const recorder = path.join(controls, 'recorder.js');
  const log = path.join(controls, 'invocations.ndjson');
  fs.writeFileSync(recorder, [
    "const fs = require('node:fs');",
    "const [log, gate, behavior, actor] = process.argv.slice(2);",
    "fs.appendFileSync(log, JSON.stringify({ gate, actor }) + '\\n');",
    "if (behavior === 'hang') setTimeout(() => {}, 60000);",
    "else process.exit(behavior === 'fail' ? 7 : 0);",
  ].join('\n'));
  return { root, controls, recorder, log };
}

function commandFor(scenario, gate, behavior = 'pass', actor = 'primary') {
  return { command: process.execPath, args: [scenario.recorder, scenario.log, gate, behavior, actor], actor };
}

function runScenario(scenario, override = {}, planOverride = {}, spawnOptions = {}) {
  const input = {
    taskCategory: 'quick',
    changedPaths: ['src/format-label.js'],
    riskFlags: [],
    capabilityFresh: true,
    evidenceFresh: true,
    dirtyTree: false,
    priorOutcomes: [],
    ...override,
  };
  const gates = Object.fromEntries(ALL_GATES.map((gate) => [gate, [commandFor(scenario, gate)]]));
  gates['paired-full-suites'] = [
    commandFor(scenario, 'paired-full-suites', 'pass', 'primary'),
    commandFor(scenario, 'paired-full-suites', 'pass', 'secondary'),
  ];
  const inputPath = path.join(scenario.controls, 'input.json');
  const planPath = path.join(scenario.controls, 'plan.json');
  fs.writeFileSync(inputPath, JSON.stringify(input));
  fs.writeFileSync(planPath, JSON.stringify({ timeoutMs: 1000, gates, ...planOverride }));
  const result = spawnSync(process.execPath, [
    CLI,
    '--root', scenario.root,
    'verify',
    '--risk-input', inputPath,
    '--gate-plan', planPath,
    '--json',
  ], { encoding: 'utf8', timeout: 10000, ...spawnOptions });
  const report = result.stdout.trim() ? JSON.parse(result.stdout) : null;
  return { result, report };
}

test('Given the shipped CLI, when verification help is requested, then the established entrypoint remains available', () => {
  // Given / When
  const result = spawnSync(process.execPath, [CLI, 'verify', '--help'], { encoding: 'utf8' });

  // Then
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: lazytrae verify/);
});

test('Given direct, affected, and release inputs, when shipped verification runs, then only selected real gates execute', (t) => {
  const table = [
    [{}, 'direct', ['targeted-tests', 'final-assertions'], 1],
    [{ riskFlags: ['dependency'] }, 'affected', ['targeted-tests', 'dependency-tests', 'contract-tests', 'final-assertions'], 1],
    [{ riskFlags: ['release'] }, 'comprehensive', ALL_GATES, 2],
  ];
  for (const [override, level, expectedGates, actorCount] of table) {
    const scenario = makeScenario();
    t.after(() => fs.rmSync(scenario.root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(scenario.controls, { recursive: true, force: true }));

    const { result, report } = runScenario(scenario, override);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(report.policy.level, level);
    assert.deepEqual([...new Set(report.gate_outcomes.map(({ gate_id: gate }) => gate))], expectedGates);
    assert.equal(report.actor_count, actorCount);
    assert.equal(report.passed, true);
    assert.equal(fs.readFileSync(scenario.log, 'utf8').trim().split('\n').length, report.cost.gate_invocations);
  }
});

test('Given a selected gate fails or hangs, when shipped verification runs, then actual outcomes fail closed', (t) => {
  for (const behavior of ['fail', 'hang']) {
    const scenario = makeScenario();
    t.after(() => fs.rmSync(scenario.root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(scenario.controls, { recursive: true, force: true }));
    const targeted = commandFor(scenario, 'targeted-tests', behavior);

    const { result, report } = runScenario(scenario, {}, {
      timeoutMs: 50,
      gates: {
        'targeted-tests': [targeted],
        'final-assertions': [commandFor(scenario, 'final-assertions')],
      },
    });

    assert.equal(result.status, 1);
    assert.equal(report.passed, false);
    assert.equal(report.policy.level, 'comprehensive');
    assert.equal(report.gate_outcomes[0].outcome, 'failed');
    assert.equal(report.gate_outcomes[0].timed_out, behavior === 'hang');
    assert.equal(report.gate_outcomes.some(({ gate_id: gate }) => gate === 'real-surface'), true);
    assert.equal(report.gate_outcomes.at(-1).gate_id, 'final-assertions');
  }
});

test('Given escalation signals, when shipped verification runs, then comprehensive gates actually execute', (t) => {
  const cases = [
    { priorOutcomes: [{ gateId: 'targeted', outcome: 'failed', assertionId: 'a' }] },
    { priorOutcomes: [{ gateId: 'targeted', outcome: 'flaky' }, { gateId: 'targeted', outcome: 'flaky' }] },
    { priorOutcomes: [{ gateId: 'targeted', outcome: 'flaky', assertionId: 'same' }, { gateId: 'targeted', outcome: 'flaky', assertionId: 'same' }] },
    { capabilityFresh: false },
    { evidenceFresh: false },
    { changedPaths: ['contracts/public.schema.json'] },
    { changedPaths: ['package.json'] },
    { changedPaths: ['src/lib/lifecycle/state.js'] },
    { changedPaths: ['src/lib/security-policy.js'] },
    { changedPaths: ['src/hosts/traecode-adapter.js'] },
    { changedPaths: ['src/lib/state-transaction.js'] },
    { riskFlags: ['cross-repo'] },
    { riskFlags: ['concurrency'] },
    { riskFlags: ['security'] },
    { riskFlags: ['release'] },
    { riskFlags: ['not-valid'] },
    { reportedCostSuccess: true, priorOutcomes: [{ gateId: 'targeted', outcome: 'failed', assertionId: 'a' }] },
  ];
  for (const override of cases) {
    const scenario = makeScenario();
    t.after(() => fs.rmSync(scenario.root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(scenario.controls, { recursive: true, force: true }));

    const { result, report } = runScenario(scenario, override);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(report.policy.level, 'comprehensive', JSON.stringify(override));
    assert.equal(report.gate_outcomes.some(({ gate_id: gate }) => gate === 'real-surface'), true);
    assert.equal(report.cost.full_suite_invocations, 2);
  }
});

test('Given an actually dirty worktree, when shipped verification runs, then comprehensive gates execute despite a clean input claim', (t) => {
  const scenario = makeScenario();
  t.after(() => fs.rmSync(scenario.root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(scenario.controls, { recursive: true, force: true }));
  fs.writeFileSync(path.join(scenario.root, 'tracked.txt'), 'dirty\n');

  const { result, report } = runScenario(scenario, { dirtyTree: false });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.policy.level, 'comprehensive');
  assert.ok(report.policy.reasonCodes.includes('dirty-tree'));
  assert.equal(report.gate_outcomes.some(({ gate_id: gate }) => gate === 'security-review'), true);
});

test('Given a dirty worktree and a PATH-spoofed clean Git probe, when shipped verification runs, then comprehensive gates execute', (t) => {
  const scenario = makeScenario();
  t.after(() => fs.rmSync(scenario.root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(scenario.controls, { recursive: true, force: true }));
  fs.writeFileSync(path.join(scenario.root, 'tracked.txt'), 'dirty\n');

  const fakeBin = path.join(scenario.controls, 'fake-bin');
  const fakeGit = path.join(fakeBin, 'git');
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(fakeGit, '#!/bin/sh\nprintf ""\nexit 0\n');
  fs.chmodSync(fakeGit, 0o755);

  const { result, report } = runScenario(scenario, { dirtyTree: false }, {}, {
    env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}` },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.policy.level, 'comprehensive');
  assert.ok(report.policy.reasonCodes.includes('dirty-tree'));
  assert.deepEqual([...new Set(report.gate_outcomes.map(({ gate_id: gate }) => gate))], ALL_GATES);
  assert.equal(report.actor_count, 2);
  assert.equal(fs.readFileSync(scenario.log, 'utf8').trim().split('\n').length, report.cost.gate_invocations);
});
