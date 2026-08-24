'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { promoteRelease } = require('./core');
const { LifecycleError, workspacePreserved } = require('./errors');
const { CONTRACT_DIGESTS, PRODUCTS, VERSION, verifyStagedPackage } = require('./package-verifier');
const {
  prepareBootstrapProductRoot,
  quarantineEmptyProductRoot,
  removeQuarantinedProductRoot,
} = require('./paths');
const { receiptFor } = require('./receipt');
const { acquireLock, readActive } = require('./state');

function parseOfficialSource(source, product) {
  const spec = PRODUCTS[product];
  if (!spec || typeof source !== 'string') throw new LifecycleError('INVALID_ORIGIN', 'unknown product or source');
  const match = /^https:\/\/github\.com\/elvinzhao10\/(LazyTrae|LazyBuddy)(?:\.git|\/tree\/([A-Za-z0-9][A-Za-z0-9._/-]*))?$/.exec(source);
  const ref = match && match[2] ? match[2] : `v${VERSION}`;
  const invalidRef = !match || match[1] !== product || ref.includes('//') || ref.endsWith('/')
    || ref.split('/').some((part) => part === '.' || part === '..' || part.endsWith('.lock'));
  if (invalidRef) throw new LifecycleError('INVALID_ORIGIN', 'source must be a canonical official HTTPS GitHub URL');
  return {
    canonicalOrigin: `https://github.com/elvinzhao10/${product}.git`,
    product,
    ref,
    repository: `elvinzhao10/${product}`,
  };
}

function run(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 4 * 1024 * 1024,
    timeout: options.timeoutMs,
  });
  if (result.error && result.error.code === 'ENOENT') {
    throw new LifecycleError('PREREQUISITE_MISSING', `required executable is unavailable: ${command}`, result.error);
  }
  if (result.error) throw new LifecycleError(options.code, `${options.label} did not complete`, result.error);
  if (result.status !== 0) {
    throw new LifecycleError(options.code, `${options.label} failed with exit ${result.status}: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function gitCommand(gitPath, args, options) {
  return run(gitPath, ['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'http.followRedirects=false', ...args], {
    ...options,
    code: 'GIT_FAILED',
  });
}

function rows(output) {
  if (output === '') return [];
  return output.split('\n').map((line) => {
    const match = /^([0-9a-f]{40})\t(.+)$/.exec(line);
    if (!match) throw new LifecycleError('GIT_FAILED', 'Git returned malformed revision data');
    return { sha: match[1], ref: match[2] };
  });
}

function resolveRevision(remote, ref, gitPath, timeoutMs) {
  if (/^[0-9a-f]{40}$/.test(ref)) return { fetchRef: ref, sha: ref };
  const common = { label: 'Git revision resolution', timeoutMs };
  const heads = rows(gitCommand(gitPath, ['ls-remote', '--heads', remote, `refs/heads/${ref}`], common));
  const tags = rows(gitCommand(gitPath, ['ls-remote', '--tags', remote, `refs/tags/${ref}`, `refs/tags/${ref}^{}`], common));
  if (heads.length > 0 && tags.length > 0) throw new LifecycleError('AMBIGUOUS_REF', 'branch and tag share the selected name');
  if (heads.length === 1) return { fetchRef: `refs/heads/${ref}`, sha: heads[0].sha };
  if (tags.length > 0) {
    const peeled = tags.find((row) => row.ref.endsWith('^{}'));
    return { fetchRef: `refs/tags/${ref}`, sha: peeled ? peeled.sha : tags[0].sha };
  }
  throw new LifecycleError('REVISION_NOT_FOUND', 'selected revision was not found');
}

function confirmationResult(parsed, sha) {
  return {
    canonical_origin: parsed.canonicalOrigin,
    commit_sha: sha,
    required_confirmation: sha,
    status: 'revision_confirmation_required',
    test: { status: 'not_run' },
    version: VERSION,
  };
}

function acquireBootstrapLock(paths, operation, prepared, deadline) {
  let current = prepared;
  while (true) {
    try {
      return { lock: acquireLock(paths, operation, current.identity, paths.bootstrapLock, 'bootstrap'), prepared: current };
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        current = prepareBootstrapProductRoot({ installRoot: paths.installRoot, product: paths.product, deadline });
        continue;
      }
      if (!error || error.code !== 'LOCKED' || current.ownership === null || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
}

function bootstrapProduct(paths, operation, options) {
  const deadline = Date.now() + (options.timeoutMs || 30_000);
  let prepared = prepareBootstrapProductRoot({ installRoot: paths.installRoot, product: paths.product, deadline });
  const acquired = acquireBootstrapLock(paths, operation, prepared, deadline);
  const lock = acquired.lock;
  prepared = acquired.prepared;
  let completed = false;
  let quarantine = null;
  let failure = null;
  let result;
  try {
    const postLock = prepareBootstrapProductRoot({ installRoot: paths.installRoot, product: paths.product, deadline });
    if (postLock.identity.dev !== prepared.identity.dev || postLock.identity.ino !== prepared.identity.ino) {
      throw workspacePreserved(paths, [
        { kind: 'bootstrap_workspace', lastKnownPath: paths.productRoot },
      ], 'product root identity changed after lifecycle lock acquisition');
    }
    result = bootstrapRelease(paths, options);
    completed = true;
  } catch (error) {
    failure = error.code === 'WORKSPACE_PRESERVED' && prepared.ownership !== null
      ? workspacePreserved(paths, [
        { kind: 'bootstrap_workspace', lastKnownPath: paths.productRoot },
        { kind: 'lifecycle_lock', lastKnownPath: paths.bootstrapLock },
      ], error.message, error)
      : error;
  } finally {
    try {
      if (!failure || failure.code !== 'WORKSPACE_PRESERVED') {
        if (!completed) quarantine = quarantineEmptyProductRoot(paths, prepared.ownership);
        lock.release(paths.bootstrapLock);
        if (quarantine !== null) removeQuarantinedProductRoot(paths, quarantine);
      }
    } catch (error) {
      if (failure === null || error.code === 'WORKSPACE_PRESERVED') failure = error;
    }
  }
  if (failure !== null) throw failure;
  return result;
}

function bootstrapRelease(paths, options) {
  const parsed = parseOfficialSource(options.sourceUrl, paths.product);
  if (Object.hasOwn(options, 'allowLocalFixture') || Object.hasOwn(options, 'transportRemote')) {
    throw new LifecycleError('INVALID_ORIGIN', 'bootstrap transport must use the canonical official origin');
  }
  const remote = parsed.canonicalOrigin;
  const gitPath = options.gitPath || 'git';
  const runtimePath = options.runtimePath || process.execPath;
  const timeoutMs = options.timeoutMs || 30_000;
  const nodeVersion = run(runtimePath, ['--version'], {
    code: 'PREREQUISITE_MISSING',
    label: 'Node.js LTS prerequisite',
    timeoutMs,
  });
  const nodeMajor = Number(/^v(\d+)\./.exec(nodeVersion)?.[1]);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 20 || nodeMajor % 2 !== 0) {
    throw new LifecycleError('PREREQUISITE_MISSING', 'Node.js LTS 20 or newer is required');
  }
  const gitVersion = gitCommand(gitPath, ['--version'], { label: 'Git prerequisite', timeoutMs });
  const revision = resolveRevision(remote, parsed.ref, gitPath, timeoutMs);
  const active = readActive(paths);
  const activeSha = active && active.active_release.startsWith(`${VERSION}-`)
    ? receiptFor(paths, active.active_release).receipt.commit_sha
    : null;
  if (options.confirmRevision !== undefined && options.confirmRevision !== revision.sha) {
    throw new LifecycleError('REVISION_CONFIRMATION_MISMATCH', 'revision confirmation does not match resolved SHA');
  }
  if (active && active.active_release.startsWith(`${VERSION}-`)
    && activeSha !== revision.sha
    && options.confirmRevision !== revision.sha) return confirmationResult(parsed, revision.sha);
  if (activeSha === revision.sha) {
    return {
      canonical_origin: parsed.canonicalOrigin,
      commit_sha: revision.sha,
      prerequisites: { git: gitVersion, node: nodeVersion },
      release_id: active.active_release,
      status: 'unchanged',
      test: { status: 'previously_passed' },
      version: VERSION,
    };
  }
  const releaseId = `${VERSION}-${revision.sha.slice(0, 12)}`;
  const stagingPath = path.join(paths.staging, `${releaseId}-${process.pid}-${crypto.randomUUID()}`);
  try {
    fs.mkdirSync(stagingPath);
    gitCommand(gitPath, ['init', stagingPath], { label: 'Git staging initialization', timeoutMs });
    gitCommand(gitPath, ['-C', stagingPath, 'fetch', '--depth=1', '--no-tags', remote, revision.fetchRef], {
      label: 'Git staged fetch',
      timeoutMs,
    });
    const fetched = gitCommand(gitPath, ['-C', stagingPath, 'rev-parse', 'FETCH_HEAD^{commit}'], {
      label: 'Git staged revision verification',
      timeoutMs,
    });
    if (fetched !== revision.sha) throw new LifecycleError('REVISION_CHANGED', 'mutable revision changed during staging');
    gitCommand(gitPath, ['-C', stagingPath, 'checkout', '--detach', revision.sha], { label: 'Git staged checkout', timeoutMs });
    fs.rmSync(path.join(stagingPath, '.git'), { recursive: true });
    const verified = verifyStagedPackage(stagingPath, paths.product);
    const testOutput = run(runtimePath, [path.join(stagingPath, verified.selfTest)], {
      code: 'SELF_TEST_FAILED',
      cwd: stagingPath,
      label: 'staged package self-test',
      timeoutMs,
    });
    const promoted = promoteRelease(paths, {
      commitSha: revision.sha,
      entrypoint: verified.entrypoint,
      manifestRelativePath: verified.manifest,
      origin: parsed.canonicalOrigin,
      releaseId,
      runtimePath,
      stagingPath,
      version: VERSION,
    });
    return {
      canonical_origin: parsed.canonicalOrigin,
      commit_sha: revision.sha,
      prerequisites: { git: gitVersion, node: nodeVersion },
      release_id: promoted.releaseId,
      status: 'ready',
      test: { output: testOutput, status: 'passed' },
      version: VERSION,
    };
  } catch (error) {
    if (fs.existsSync(stagingPath)) fs.rmSync(stagingPath, { recursive: true });
    throw error;
  }
}

module.exports = {
  CONTRACT_DIGESTS,
  VERSION,
  bootstrapProduct,
  bootstrapRelease,
  parseOfficialSource,
  resolveRevision,
  verifyStagedPackage,
};
