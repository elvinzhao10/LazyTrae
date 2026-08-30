'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

function projectFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-traecli-candidate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# caller authority\n');
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'sessions.json'), `${JSON.stringify({
    schema_version: 1, current_session_id: 'session-1', sessions: {}, compaction_state: {},
  }, null, 2)}\n`);
  return root;
}

function writeExecutable(root, body) {
  const target = path.join(root, 'traecli');
  fs.writeFileSync(target, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return target;
}

function digest(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

function writeFixture(root, runner) {
  const target = path.join(root, 'probe.json');
  fs.writeFileSync(target, `${JSON.stringify({
    schema_version: 2,
    contract_version: '2.0.0',
    product: 'trae',
    host: 'cli',
    region: 'global',
    edition: 'enterprise',
    capabilities: [{ name: 'structured-runner', status: 'accessible', runner }],
  }, null, 2)}\n`);
  return target;
}

function writeRequest(root, overrides = {}) {
  const target = path.join(root, `request-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(target, `${JSON.stringify({
    schema_version: 1,
    mode: 'session',
    session_id: 'session-1',
    worktree: root,
    prompt: 'inspect; touch /tmp/must-not-run',
    mcp: { servers: [] },
    acp: { agent: null },
    ...overrides,
  }, null, 2)}\n`);
  return target;
}

function runCandidate(root, args) {
  return runCli(['traecli-candidate', ...args, '--json'], { cwd: root });
}

test('generates an inert receipt-owned candidate tree with canonical asset parity', (t) => {
  // Given: a caller-owned project with an authoritative root AGENTS file.
  const root = projectFixture(t);
  const authority = fs.readFileSync(path.join(root, 'AGENTS.md'));

  // When: the real CLI generates the TraeCode CLI candidate.
  const result = runCandidate(root, ['generate']);

  // Then: candidate assets are inspectable and inert while root authority is untouched.
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'pending');
  assert.equal(report.invoked, false);
  assert.deepEqual(fs.readFileSync(path.join(root, 'AGENTS.md')), authority);
  const candidate = path.join(root, '.traecli', 'candidates', 'lazytrae');
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'pending');
  assert.equal(manifest.authority.instructions, 'AGENTS.md');
  assert.equal(manifest.runners.every((runner) => runner.argv === null && runner.status === 'pending'), true);
  for (const kind of ['commands', 'agents', 'skills']) {
    assert.deepEqual(
      fs.readdirSync(path.join(candidate, kind)).sort(),
      fs.readdirSync(path.resolve(__dirname, '..', 'templates', kind)).sort(),
    );
  }
});

test('preserves caller-modified candidate output and refuses to invoke stale assets', (t) => {
  // Given: a generated tree whose caller changes one candidate command.
  const root = projectFixture(t);
  assert.equal(runCandidate(root, ['generate']).status, 0);
  const target = path.join(root, '.traecli', 'candidates', 'lazytrae', 'commands', 'lazy-handoff.md');
  fs.appendFileSync(target, '\ncaller edit\n');
  const before = fs.readFileSync(target);

  // When: generation repeats and an invocation is requested.
  const regenerated = runCandidate(root, ['generate']);
  const request = writeRequest(root);
  const attempted = runCandidate(root, ['run', '--request', request]);

  // Then: caller bytes survive and the stale candidate cannot activate.
  assert.equal(regenerated.status, 0, regenerated.stderr || regenerated.stdout);
  assert.deepEqual(fs.readFileSync(target), before);
  assert.equal(attempted.status, 2);
  assert.match(JSON.parse(attempted.stdout).detail, /modified output/);
});

test('invokes only fixture-proven argv after an exact accessible probe', (t) => {
  // Given: a generated candidate and a pinned fake TraeCode CLI with a structured-runner fixture.
  const root = projectFixture(t);
  assert.equal(runCandidate(root, ['generate']).status, 0);
  const log = path.join(root, 'argv.log');
  const input = path.join(root, 'input.json');
  const executable = writeExecutable(root, [
    `printf '%s\\n' "$*" >> "${log}"`,
    `if [ "$1" = "--version" ]; then printf 'TraeCode CLI 7.8.9 region=global edition=enterprise\\n'; exit 0; fi`,
    `if [ "$1" = "--help" ]; then printf 'TraeCode CLI help\\n'; exit 0; fi`,
    `cat > "${input}"`,
    `printf '{"schema_version":1,"status":"success","session_id":"session-1","worktree":"%s"}\\n' "$PWD"`,
  ].join('\n'));
  const fixture = writeFixture(root, {
    protocol: 'stdin-json-v1', argv: ['structured', '--json'], timeout_ms: 1000,
    modes: ['session', 'worktree', 'mcp', 'acp'],
  });
  const request = writeRequest(root);

  // When: the real CLI runs the structured request through the verified binary.
  const result = runCandidate(root, [
    'run', '--request', request, '--executable', executable,
    '--expected-sha256', digest(executable), '--fixture', fixture,
  ]);

  // Then: only probe argv plus the exact fixture argv ran and prompt data stayed on stdin.
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).status, 'success');
  assert.deepEqual(fs.readFileSync(log, 'utf8').trim().split('\n'), ['--version', '--help', 'structured --json']);
  assert.equal(JSON.parse(fs.readFileSync(input, 'utf8')).prompt, 'inspect; touch /tmp/must-not-run');
});

test('unverified, malformed, and wrong-boundary requests remain pending without invocation', (t) => {
  // Given: a generated tree and a fake executable with an execution marker.
  const root = projectFixture(t);
  assert.equal(runCandidate(root, ['generate']).status, 0);
  const marker = path.join(root, 'invoked');
  const executable = writeExecutable(root, [
    `if [ "$1" = "--version" ] || [ "$1" = "--help" ]; then printf 'Not TraeCode CLI\\n'; exit 0; fi`,
    `touch "${marker}"`,
  ].join('\n'));
  const fixture = writeFixture(root, {
    protocol: 'stdin-json-v1', argv: ['structured'], timeout_ms: 1000, modes: ['session'],
  });
  const malformed = path.join(root, 'malformed.json');
  fs.writeFileSync(malformed, '{bad json\n');
  const wrongSession = writeRequest(root, { session_id: 'session-other' });
  const wrongWorktree = writeRequest(root, { worktree: path.dirname(root) });

  // When: each invalid or unverified request reaches the CLI boundary.
  const results = [
    runCandidate(root, ['run', '--request', malformed]),
    runCandidate(root, ['run', '--request', wrongSession]),
    runCandidate(root, ['run', '--request', wrongWorktree]),
    runCandidate(root, [
      'run', '--request', writeRequest(root), '--executable', executable,
      '--expected-sha256', digest(executable), '--fixture', fixture,
    ]),
  ];

  // Then: all remain non-successful and the structured argv is never invoked.
  assert.equal(results.every((result) => result.status === 2), true);
  assert.equal(fs.existsSync(marker), false);
});

test('bounds MCP execution and rejects malformed structured output', (t) => {
  // Given: generated candidates and pinned runners that hang or return invalid JSON.
  const root = projectFixture(t);
  assert.equal(runCandidate(root, ['generate']).status, 0);
  const hanging = writeExecutable(root, [
    `if [ "$1" = "--version" ]; then printf 'TraeCode CLI 7.8.9\\n'; exit 0; fi`,
    `if [ "$1" = "--help" ]; then printf 'TraeCode CLI help\\n'; exit 0; fi`,
    'sleep 2',
  ].join('\n'));
  const fixture = writeFixture(root, {
    protocol: 'stdin-json-v1', argv: ['structured'], timeout_ms: 100,
    modes: ['mcp'],
  });
  const mcpRequest = writeRequest(root, { mode: 'mcp', mcp: { servers: ['lazytrae'] } });

  // When: the MCP runner exceeds its fixture-proven bound.
  const timedOut = runCandidate(root, [
    'run', '--request', mcpRequest, '--executable', hanging,
    '--expected-sha256', digest(hanging), '--fixture', fixture,
  ]);

  // Then: the request remains pending with a timeout observable.
  assert.equal(timedOut.status, 2);
  assert.match(JSON.parse(timedOut.stdout).detail, /timed out/);

  fs.writeFileSync(hanging, [
    '#!/bin/sh',
    `if [ "$1" = "--version" ]; then printf 'TraeCode CLI 7.8.9\\n'; exit 0; fi`,
    `if [ "$1" = "--help" ]; then printf 'TraeCode CLI help\\n'; exit 0; fi`,
    `printf 'not-json\\n'`,
  ].join('\n'), { mode: 0o755 });

  // When: the same exact runner protocol returns malformed structured output.
  const malformed = runCandidate(root, [
    'run', '--request', mcpRequest, '--executable', hanging,
    '--expected-sha256', digest(hanging), '--fixture', fixture,
  ]);

  // Then: malformed output is inert rather than treated as success.
  assert.equal(malformed.status, 2);
  assert.match(JSON.parse(malformed.stdout).detail, /output is malformed/);
});

test('dirty projects and repeated ACP requests still use only the proven argv', (t) => {
  // Given: a dirty project, generated candidates, and an exact ACP-capable runner fixture.
  const root = projectFixture(t);
  fs.writeFileSync(path.join(root, 'caller-dirty.txt'), 'preserve\n');
  assert.equal(runCandidate(root, ['generate']).status, 0);
  const log = path.join(root, 'repeat.log');
  const executable = writeExecutable(root, [
    `printf '%s\\n' "$*" >> "${log}"`,
    `if [ "$1" = "--version" ]; then printf 'TraeCode CLI 7.8.9\\n'; exit 0; fi`,
    `if [ "$1" = "--help" ]; then printf 'TraeCode CLI help\\n'; exit 0; fi`,
    'cat >/dev/null',
    `printf '{"schema_version":1,"status":"success","session_id":"session-1","worktree":"%s"}\\n' "$PWD"`,
  ].join('\n'));
  const fixture = writeFixture(root, {
    protocol: 'stdin-json-v1', argv: ['acp-exact'], timeout_ms: 1000, modes: ['acp'],
  });
  const request = writeRequest(root, { mode: 'acp', acp: { agent: 'explorer' } });
  const invocation = [
    'run', '--request', request, '--executable', executable,
    '--expected-sha256', digest(executable), '--fixture', fixture,
  ];

  // When: the same request is invoked twice.
  const first = runCandidate(root, invocation);
  const second = runCandidate(root, invocation);

  // Then: both pass, dirty caller data survives, and each run uses only the exact fixture argv.
  assert.deepEqual([first.status, second.status], [0, 0]);
  assert.equal(fs.readFileSync(path.join(root, 'caller-dirty.txt'), 'utf8'), 'preserve\n');
  assert.deepEqual(fs.readFileSync(log, 'utf8').trim().split('\n'), [
    '--version', '--help', 'acp-exact', '--version', '--help', 'acp-exact',
  ]);
});
