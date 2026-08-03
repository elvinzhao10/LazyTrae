const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { writeBundle } = require('../src/lib/deterministic-skill-bundle');
const { runCli } = require('./test-helpers');

test('work profile refuses ambiguous client and execution selection', () => {
  // Given: no client or execution context was selected.
  // When: a profile descriptor is requested.
  const result = runCli(['work', 'profile']);

  // Then: the CLI refuses instead of selecting a context implicitly.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--client and --execution are required/);
});

test('work profile refuses every upload attempt', () => {
  // Given: an explicit cloud profile and an upload-shaped option.
  // When: a caller asks the package to upload it.
  const result = runCli([
    'work', 'profile', '--client', 'web', '--execution', 'cloud', '--upload',
  ]);

  // Then: the request fails closed without invoking a host or account action.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /upload.*not supported/i);
});

test('work profile matrix describes every client and execution pair without host actions', () => {
  // Given: explicit local Skills storage and every client/execution pair.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-matrix-'));
  const pairs = ['desktop:local', 'desktop:cloud', 'web:local', 'web:cloud', 'mobile:local', 'mobile:cloud'];
  try {
    // When: each descriptor is emitted through the real CLI.
    const descriptors = pairs.map(pair => {
      const [client, execution] = pair.split(':');
      const args = ['work', 'profile', '--client', client, '--execution', execution];
      if (pair === 'desktop:local') args.push('--skills-dir', root);
      const result = runCli(args);
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    });

    // Then: the matrix is total and only desktop/local has an invoking local route.
    assert.deepEqual(descriptors.map(value => `${value.client_context}:${value.execution_context}`), pairs);
    assert.equal(descriptors[0].native_mode, 'invoke-documented');
    assert.deepEqual(descriptors.slice(1).map(value => value.native_mode), Array(5).fill('descriptor-only'));
    assert.equal(descriptors.every(value => Object.values(value.host_actions).every(action => action === false)), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work bundle is deterministic and contains only canonical Skill content', () => {
  // Given: one explicit desktop/local Skills path and two bundle destinations.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-bundle-'));
  const first = path.join(root, 'first.skill');
  const second = path.join(root, 'second.skill');
  const args = ['work', 'bundle', '--client', 'desktop', '--execution', 'local', '--skills-dir', root];
  try {
    // When: the same canonical Skills are bundled twice.
    const firstResult = runCli([...args, '--output', first]);
    const secondResult = runCli([...args, '--output', second]);

    // Then: bytes/checksums match and the archive does not disclose checkout paths or secrets.
    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    const firstBytes = fs.readFileSync(first);
    const secondBytes = fs.readFileSync(second);
    assert.deepEqual(firstBytes, secondBytes);
    assert.equal(JSON.parse(firstResult.stdout).sha256, crypto.createHash('sha256').update(firstBytes).digest('hex'));
    assert.match(firstBytes.toString('utf8'), /manifest\.json/);
    assert.match(firstBytes.toString('utf8'), /lazy-ulw-plan\/SKILL\.md/);
    assert.doesNotMatch(firstBytes.toString('utf8'), /\/private\/tmp\/|\/Users\/|BEGIN .*PRIVATE KEY|AKIA[0-9A-Z]{16}/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work bundle leaves no partial output for hostile canonical sources', () => {
  // Given: a canonical-shaped source whose SKILL.md traverses through a symlink and a prior output.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-hostile-'));
  const source = path.join(root, 'skills');
  const outside = path.join(root, 'outside.md');
  const output = path.join(root, 'bundle.skill');
  fs.mkdirSync(path.join(source, 'lazy-hostile'), { recursive: true });
  fs.writeFileSync(outside, 'outside\n');
  fs.symlinkSync(outside, path.join(source, 'lazy-hostile', 'SKILL.md'));
  fs.writeFileSync(output, 'preserve\n');
  try {
    // When: bundle construction examines the hostile source.
    assert.throws(() => writeBundle(source, output), /regular, unlinked|incomplete or linked/);

    // Then: the existing output remains intact and no temporary bundle survives.
    assert.equal(fs.readFileSync(output, 'utf8'), 'preserve\n');
    assert.deepEqual(fs.readdirSync(root).filter(name => name.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work profile gates local worktrees on an accessible capability probe', () => {
  // Given: an explicit Git worktree-shaped directory and a verified local-worktree probe.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-worktree-'));
  const skills = path.join(root, 'skills');
  const worktree = path.join(root, 'project');
  const probe = path.join(root, 'probe.json');
  fs.mkdirSync(skills);
  fs.mkdirSync(path.join(worktree, '.git'), { recursive: true });
  fs.writeFileSync(probe, JSON.stringify({
    schema_version: 1,
    product: 'trae',
    host: 'work',
    status: 'accessible',
    capabilities: [{ name: 'local-worktree', status: 'accessible' }],
  }));
  const base = ['work', 'profile', '--client', 'desktop', '--execution', 'local', '--skills-dir', skills, '--worktree', worktree];
  try {
    // When: the same profile is requested without and with the verified probe.
    const rejected = runCli(base);
    const accepted = runCli([...base, '--probe', probe]);

    // Then: the unprobed claim is refused and the verified local path is explicit.
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /require an absolute --probe/);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(JSON.parse(accepted.stdout).worktree, { mode: 'local-probe-verified', path: fs.realpathSync(worktree) });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work profile refuses guessed local paths and cloud worktree claims', () => {
  // Given: local and cloud profiles without valid context-specific paths.
  // When: the CLI receives a guessed local path and a cloud worktree claim.
  const guessed = runCli(['work', 'profile', '--client', 'desktop', '--execution', 'local']);
  const cloud = runCli(['work', 'profile', '--client', 'desktop', '--execution', 'cloud', '--worktree', '/tmp']);

  // Then: neither profile is emitted.
  assert.equal(guessed.status, 1);
  assert.match(guessed.stderr, /--skills-dir must be an explicit absolute path/);
  assert.equal(cloud.status, 1);
  assert.match(cloud.stderr, /only for the desktop\/local profile/);
});

test('work bundle rejects credential-shaped canonical content without creating output', () => {
  // Given: a canonical-shaped Skill containing a credential value.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-secret-'));
  const source = path.join(root, 'skills');
  const output = path.join(root, 'bundle.skill');
  fs.mkdirSync(path.join(source, 'lazy-hostile'), { recursive: true });
  fs.writeFileSync(path.join(source, 'lazy-hostile', 'SKILL.md'), 'api_key = exposed-value\n');
  try {
    // When: the source is passed to the deterministic bundle boundary.
    assert.throws(() => writeBundle(source, output), /path or credential-shaped value/);

    // Then: no artifact or partial temporary file is created.
    assert.equal(fs.existsSync(output), false);
    assert.deepEqual(fs.readdirSync(root).filter(name => name.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('work bundle refuses descriptor-only profiles and symlinked outputs', () => {
  // Given: explicit local storage, a symlink output, and cloud/mobile bundle requests.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-work-output-link-'));
  const victim = path.join(root, 'victim.skill');
  const linked = path.join(root, 'linked.skill');
  fs.writeFileSync(victim, 'preserve\n');
  fs.symlinkSync(victim, linked);
  const local = ['work', 'bundle', '--client', 'desktop', '--execution', 'local', '--skills-dir', root, '--output', linked];
  try {
    // When: each invalid bundle request is made through the real CLI.
    const symlinked = runCli(local);
    const cloud = runCli(['work', 'bundle', '--client', 'web', '--execution', 'cloud', '--output', path.join(root, 'cloud.skill')]);
    const mobile = runCli(['work', 'bundle', '--client', 'mobile', '--execution', 'local', '--output', path.join(root, 'mobile.skill')]);

    // Then: all fail closed and the linked target remains unchanged.
    assert.equal(symlinked.status, 1);
    assert.match(symlinked.stderr, /symlinked bundle output/);
    assert.equal(cloud.status, 1);
    assert.equal(mobile.status, 1);
    assert.match(`${cloud.stderr}\n${mobile.stderr}`, /descriptor-only/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'preserve\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
