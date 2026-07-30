'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = childProcess;
const test = require('node:test');
const {
  LifecycleError,
  bootstrapProduct,
  bootstrapRelease,
  parseOfficialSource,
  prepareProductRoot,
} = require('../src/lib/lifecycle');

const OFFICIAL = 'https://github.com/elvinzhao10/LazyTrae.git';
const FIXTURE_CONTRACTS = path.resolve(__dirname, '..', 'contracts');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function writeFixtureFiles(root, selfTest = "process.stdout.write('self-test-ok\\n');\n") {
  const packageRoot = path.join(root, 'lazytrae-plugin', 'packages', 'cli');
  const contracts = path.join(packageRoot, 'contracts');
  fs.mkdirSync(path.join(packageRoot, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(contracts, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'package.json'), '{"name":"lazytrae-ai","version":"1.0.3"}\n');
  fs.writeFileSync(path.join(packageRoot, 'bin', 'lazytrae.js'), "console.log('fixture-launch-ok')\n");
  fs.writeFileSync(path.join(packageRoot, 'scripts', 'lifecycle-self-test.js'), selfTest);
  for (const name of ['lazy-harness-lifecycle.v1.schema.json', 'lazy-harness-lifecycle.v1.example.json']) {
    const bytes = fs.readFileSync(path.join(FIXTURE_CONTRACTS, name));
    fs.writeFileSync(path.join(contracts, name), bytes);
    fs.writeFileSync(
      path.join(contracts, `${name}.sha256`),
      `${crypto.createHash('sha256').update(bytes).digest('hex')}  ${name}\n`,
    );
  }
}

function fixture() {
  const sandbox = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lazytrae bootstrap '));
  const remote = path.join(sandbox, 'official fixture.git');
  const source = path.join(sandbox, 'source');
  fs.mkdirSync(source);
  git(source, ['init']);
  git(source, ['config', 'user.email', 'fixture@example.invalid']);
  git(source, ['config', 'user.name', 'Lifecycle Fixture']);
  writeFixtureFiles(source);
  git(source, ['add', 'lazytrae-plugin']);
  git(source, ['commit', '-m', 'fixture v1']);
  git(source, ['branch', '-M', 'main']);
  git(source, ['tag', 'v1.0.3']);
  git(sandbox, ['clone', '--bare', source, remote]);
  return {
    paths: prepareProductRoot({ installRoot: path.join(sandbox, 'durable root'), product: 'LazyTrae' }),
    remote,
    sandbox,
    source,
  };
}

function bootstrap(f, overrides = {}) {
  const realSpawnSync = childProcess.spawnSync;
  childProcess.spawnSync = (command, args, options) => realSpawnSync(
    command,
    args.map((arg) => arg === OFFICIAL ? f.remote : arg),
    options,
  );
  try {
    return bootstrapRelease(f.paths, {
      sourceUrl: 'https://github.com/elvinzhao10/LazyTrae/tree/main',
      ...overrides,
    });
  } finally {
    childProcess.spawnSync = realSpawnSync;
  }
}

function expectCode(action, code) {
  assert.throws(action, (error) => error instanceof LifecycleError && error.code === code);
}

test('parses only canonical official HTTPS source forms for the selected product', () => {
  // Given: the three documented source forms and hostile or ambiguous alternatives.
  const accepted = [
    ['https://github.com/elvinzhao10/LazyTrae', 'v1.0.3'],
    ['https://github.com/elvinzhao10/LazyTrae.git', 'v1.0.3'],
    ['https://github.com/elvinzhao10/LazyTrae/tree/release/v1.0.3', 'release/v1.0.3'],
  ];
  const rejected = [
    'http://github.com/elvinzhao10/LazyTrae',
    'https://github.com/elvinzhao10/LazyTrae/',
    'https://github.com/elvinzhao10/LazyTrae?ref=v1.0.3',
    'https://github.com/elvinzhao10/LazyTrae#readme',
    'https://user@github.com/elvinzhao10/LazyTrae',
    'https://github.com:443/elvinzhao10/LazyTrae',
    'https://github.com/elvinzhao10/LazyBuddy',
    'https://github.com/private/LazyTrae',
    'git@github.com:elvinzhao10/LazyTrae.git',
    '/tmp/LazyTrae',
    'https://github.com/elvinzhao10/LazyTrae/tree/../../main',
    'https://github.com/elvinzhao10/LazyTrae\n--upload-pack=owned',
  ];

  // When/Then: accepted forms normalize to one origin; every other form fails closed.
  for (const [input, ref] of accepted) {
    assert.deepEqual(parseOfficialSource(input, 'LazyTrae'), {
      canonicalOrigin: OFFICIAL,
      product: 'LazyTrae',
      ref,
      repository: 'elvinzhao10/LazyTrae',
    });
  }
  for (const input of rejected) expectCode(() => parseOfficialSource(input, 'LazyTrae'), 'INVALID_ORIGIN');
});

test('resolves, verifies, self-tests, and promotes a local fixture under an official identity', () => {
  // Given: a local Git transport containing the expected v1.0.3 package and contracts.
  const f = fixture();
  const expectedSha = git(f.source, ['rev-parse', 'HEAD']);

  // When: bootstrap resolves the official URL and stages from the test-only local transport.
  const result = bootstrap(f);
  fs.rmSync(f.source, { recursive: true });
  fs.rmSync(f.remote, { recursive: true });
  const launched = spawnSync(process.execPath, [f.paths.launcher], { encoding: 'utf8' });

  // Then: JSON reports the immutable identity/test and the durable release survives source deletion.
  assert.deepEqual({
    canonical_origin: result.canonical_origin,
    commit_sha: result.commit_sha,
    status: result.status,
    test_status: result.test.status,
    version: result.version,
  }, {
    canonical_origin: OFFICIAL,
    commit_sha: expectedSha,
    status: 'ready',
    test_status: 'passed',
    version: '1.0.3',
  });
  assert.equal(launched.status, 0, launched.stderr);
  assert.equal(launched.stdout.trim(), 'fixture-launch-ok');
  assert.match(result.prerequisites.git, /^git version /);
  assert.match(result.prerequisites.node, /^v\d+\./);
});

test('repo, tag, branch, and full-SHA sources resolve through Git to the same immutable commit', () => {
  // Given: one official-identity fixture exposed through every approved source form.
  const sources = [
    'https://github.com/elvinzhao10/LazyTrae',
    'https://github.com/elvinzhao10/LazyTrae/tree/v1.0.3',
    'https://github.com/elvinzhao10/LazyTrae/tree/main',
  ];

  // When/Then: each form stages the exact commit selected by Git.
  for (const sourceUrl of sources) {
    const f = fixture();
    const expectedSha = git(f.source, ['rev-parse', 'HEAD']);
    const selected = bootstrap(f, { sourceUrl });
    assert.equal(selected.commit_sha, expectedSha);
  }
  const f = fixture();
  const expectedSha = git(f.source, ['rev-parse', 'HEAD']);
  assert.equal(bootstrap(f, {
    sourceUrl: `https://github.com/elvinzhao10/LazyTrae/tree/${expectedSha}`,
  }).commit_sha, expectedSha);
});

test('same version at a different SHA requires an exact revision confirmation', () => {
  // Given: one active v1.0.3 release and a second commit at the same mutable branch.
  const f = fixture();
  const first = bootstrap(f);
  fs.appendFileSync(path.join(f.source, 'lazytrae-plugin', 'packages', 'cli', 'bin', 'lazytrae.js'), "// v2\n");
  git(f.source, ['add', 'lazytrae-plugin']);
  git(f.source, ['commit', '-m', 'fixture v2']);
  git(f.source, ['push', '--force', f.remote, 'main']);
  const secondSha = git(f.source, ['rev-parse', 'HEAD']);
  const activeBefore = fs.readFileSync(f.paths.active);

  // When: update is attempted without confirmation, then with the exact resolved SHA.
  const pending = bootstrap(f);

  // Then: the first attempt is machine-readable and non-mutating; exact confirmation promotes.
  assert.equal(pending.status, 'revision_confirmation_required');
  assert.equal(pending.required_confirmation, secondSha);
  assert.equal(pending.test.status, 'not_run');
  assert.deepEqual(fs.readFileSync(f.paths.active), activeBefore);
  const promoted = bootstrap(f, { confirmRevision: secondSha });
  assert.equal(promoted.status, 'ready');
  assert.equal(promoted.commit_sha, secondSha);
  assert.notEqual(promoted.release_id, first.release_id);
});

test('manifest, checksum, self-test, prerequisite, and clone failures preserve active state', async (t) => {
  for (const scenario of [
    ['missing manifest', (f) => fs.rmSync(path.join(f.source, 'lazytrae-plugin/packages/cli/package.json')), 'INVALID_MANIFEST'],
    ['bad checksum', (f) => fs.writeFileSync(path.join(f.source, 'lazytrae-plugin/packages/cli/contracts/lazy-harness-lifecycle.v1.schema.json.sha256'), `${'0'.repeat(64)}  lazy-harness-lifecycle.v1.schema.json\n`), 'CHECKSUM_MISMATCH'],
    ['misleading self-test success', (f) => fs.writeFileSync(path.join(f.source, 'lazytrae-plugin/packages/cli/scripts/lifecycle-self-test.js'), "console.log('PASS'); process.exit(7);\n"), 'SELF_TEST_FAILED'],
  ]) {
    await t.test(scenario[0], () => {
      const f = fixture();
      const first = bootstrap(f);
      fs.appendFileSync(path.join(f.source, 'README.md'), 'second revision\n');
      scenario[1](f);
      git(f.source, ['add', '.']);
      git(f.source, ['commit', '-m', scenario[0]]);
      git(f.source, ['push', '--force', f.remote, 'main']);
      const activeBefore = fs.readFileSync(f.paths.active);
      expectCode(() => bootstrap(f, { confirmRevision: git(f.source, ['rev-parse', 'HEAD']) }), scenario[2]);
      assert.deepEqual(fs.readFileSync(f.paths.active), activeBefore);
      assert.equal(JSON.parse(activeBefore).active_release, first.release_id);
      assert.deepEqual(fs.readdirSync(f.paths.staging), []);
    });
  }

  await t.test('missing Git', () => {
    const f = fixture();
    const activeBefore = fs.existsSync(f.paths.active) ? fs.readFileSync(f.paths.active) : null;
    expectCode(() => bootstrap(f, { gitPath: path.join(f.sandbox, 'missing-git') }), 'PREREQUISITE_MISSING');
    assert.equal(fs.existsSync(f.paths.active), activeBefore !== null);
  });

  await t.test('missing Node', () => {
    const f = fixture();
    expectCode(() => bootstrap(f, { runtimePath: path.join(f.sandbox, 'missing-node') }), 'PREREQUISITE_MISSING');
    assert.equal(fs.existsSync(f.paths.active), false);
  });

  await t.test('failed clone', () => {
    const f = fixture();
    fs.rmSync(f.remote, { recursive: true });
    expectCode(() => bootstrap(f), 'GIT_FAILED');
    assert.equal(fs.existsSync(f.paths.active), false);
    assert.deepEqual(fs.readdirSync(f.paths.staging), []);
  });

  for (const [name, source] of [
    ['hung self-test', 'setInterval(() => {}, 1000);\n'],
    ['interrupted self-test', "process.kill(process.pid, 'SIGTERM');\n"],
  ]) {
    await t.test(name, () => {
      const f = fixture();
      fs.writeFileSync(path.join(f.source, 'lazytrae-plugin/packages/cli/scripts/lifecycle-self-test.js'), source);
      git(f.source, ['add', '.']);
      git(f.source, ['commit', '-m', name]);
      git(f.source, ['push', '--force', f.remote, 'main']);
      expectCode(() => bootstrap(f, { timeoutMs: 1_000 }), 'SELF_TEST_FAILED');
      assert.equal(fs.existsSync(f.paths.active), false);
      assert.deepEqual(fs.readdirSync(f.paths.staging), []);
    });
  }
});

test('failed fresh bootstrap quarantines its root before a concurrent successful bootstrap', () => {
  // Given: a fresh product root and a concurrent bootstrap triggered at cleanup relocation.
  const f = fixture();
  fs.rmSync(f.paths.productRoot, { recursive: true });
  const missingGit = path.join(f.sandbox, 'missing-git');
  const realRenameSync = fs.renameSync;
  const realSpawnSync = childProcess.spawnSync;
  let concurrentResult;
  childProcess.spawnSync = (command, args, options) => realSpawnSync(
    command,
    args.map((arg) => arg === OFFICIAL ? f.remote : arg),
    options,
  );
  fs.renameSync = (source, target) => {
    const result = realRenameSync(source, target);
    if (source === f.paths.productRoot && concurrentResult === undefined) {
      assert.equal(
        fs.existsSync(path.join(target, 'locks', 'lifecycle.lock')),
        true,
        'cleanup relocated the product root after releasing its lifecycle lock',
      );
      concurrentResult = bootstrapProduct(f.paths, 'onboard', {
        sourceUrl: 'https://github.com/elvinzhao10/LazyTrae/tree/main',
      });
    }
    return result;
  };

  try {
    // When: missing-Git failure cleanup overlaps the second real bootstrap.
    expectCode(() => bootstrapProduct(f.paths, 'onboard', {
      gitPath: missingGit,
      sourceUrl: 'https://github.com/elvinzhao10/LazyTrae/tree/main',
    }), 'PREREQUISITE_MISSING');
  } finally {
    fs.renameSync = realRenameSync;
    childProcess.spawnSync = realSpawnSync;
  }

  // Then: the concurrent success occupies a new root and survives cleanup.
  assert.notEqual(concurrentResult, undefined, 'failed cleanup did not atomically quarantine its product root');
  assert.equal(concurrentResult.status, 'ready');
  assert.equal(fs.existsSync(f.paths.active), true);
  assert.equal(fs.existsSync(f.paths.launcher), true);
});

test('dirty source bytes, local transport bypass, and mismatched confirmations fail closed', () => {
  // Given: a committed official fixture plus uncommitted source bytes.
  const f = fixture();
  const entrypoint = path.join(f.source, 'lazytrae-plugin/packages/cli/bin/lazytrae.js');
  fs.writeFileSync(entrypoint, "console.log('dirty-untrusted')\n");

  // When: the local fixture transport is explicitly approved and bootstrapped.
  const clean = bootstrap(f);
  const installed = path.join(f.paths.releases, clean.release_id, 'lazytrae-plugin/packages/cli/bin/lazytrae.js');

  // Then: only committed bytes arrive, and bypass/confirmation ambiguity is rejected.
  assert.doesNotMatch(fs.readFileSync(installed, 'utf8'), /dirty-untrusted/);
  const bypass = fixture();
  expectCode(() => bootstrapRelease(bypass.paths, {
    sourceUrl: 'https://github.com/elvinzhao10/LazyTrae/tree/main',
    transportRemote: bypass.remote,
  }), 'INVALID_ORIGIN');
  fs.appendFileSync(path.join(bypass.source, 'README.md'), 'new revision\n');
  git(bypass.source, ['add', '.']);
  git(bypass.source, ['commit', '-m', 'new revision']);
  git(bypass.source, ['push', '--force', bypass.remote, 'main']);
  const wrong = 'f'.repeat(40);
  expectCode(() => bootstrap(bypass, { confirmRevision: wrong }), 'REVISION_CONFIRMATION_MISMATCH');
  assert.equal(fs.existsSync(bypass.paths.active), false);
});

test('exported bootstrap rejects caller-enabled local transport before Git access', () => {
  // Given: a caller-controlled local remote and a Git executable that would leave an access marker.
  const f = fixture();
  const marker = path.join(f.sandbox, 'git-accessed');
  const gitPath = path.join(f.sandbox, 'hostile-git');
  fs.writeFileSync(gitPath, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'accessed\\n');\n`, {
    mode: 0o755,
  });

  // When: the exported production API is called with the former fixture-bypass pair.
  expectCode(() => bootstrapRelease(f.paths, {
    allowLocalFixture: true,
    gitPath,
    sourceUrl: 'https://github.com/elvinzhao10/LazyTrae/tree/main',
    transportRemote: f.remote,
  }), 'INVALID_ORIGIN');

  // Then: the request is denied before any Git process can run.
  assert.equal(fs.existsSync(marker), false);
});

test('a mutable ref changing after resolution is rejected before package verification', () => {
  // Given: a Git shim that advances main after ls-remote resolves the old SHA.
  const f = fixture();
  fs.appendFileSync(path.join(f.source, 'README.md'), 'moved revision\n');
  git(f.source, ['add', '.']);
  git(f.source, ['commit', '-m', 'moved revision']);
  const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  const shim = path.join(f.sandbox, 'git shim');
  fs.writeFileSync(shim, `#!${process.execPath}
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const result = spawnSync(${JSON.stringify(realGit)}, args, { encoding: 'utf8' });
if (args.includes('ls-remote') && args.includes('--tags')) {
  spawnSync(${JSON.stringify(realGit)}, ['-C', ${JSON.stringify(f.source)}, 'push', '--force', ${JSON.stringify(f.remote)}, 'main']);
}
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status === null ? 1 : result.status);
`, { mode: 0o755 });

  // When/Then: the fetched commit differs from the resolved commit and no active state is written.
  expectCode(() => bootstrap(f, { gitPath: shim }), 'REVISION_CHANGED');
  assert.equal(fs.existsSync(f.paths.active), false);
  assert.deepEqual(fs.readdirSync(f.paths.staging), []);
});
