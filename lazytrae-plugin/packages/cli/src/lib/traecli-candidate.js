'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkAssets, installAssets, uninstallAssets } = require('./asset-ownership');
const { probeHost } = require('./host-probe');

const SOURCE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(SOURCE_ROOT, 'traecli-candidate-source-manifest.v1.json');
const RECEIPT_PATH = '.traecli/candidate-receipt.v1.json';
const MODES = new Set(['session', 'worktree', 'mcp', 'acp']);
const CLEAN_ENVIRONMENT = Object.freeze({ HOME: '/nonexistent', LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' });

function optionsFor(repoRoot) {
  return {
    sourceRoot: SOURCE_ROOT,
    manifestPath: MANIFEST_PATH,
    destinationRoot: repoRoot,
    receiptPath: path.join(repoRoot, RECEIPT_PATH),
  };
}

function generateCandidate(repoRoot) {
  const result = installAssets(optionsFor(repoRoot));
  return {
    schema_version: 1,
    status: 'pending',
    detail: 'Trae CLI candidates are configuration-only until an exact probe fixture verifies a structured runner',
    candidate_root: path.join(repoRoot, '.traecli', 'candidates', 'lazytrae'),
    receipt: result.receipt,
    written: result.written,
    invoked: false,
  };
}

function checkCandidate(repoRoot) {
  return checkAssets(optionsFor(repoRoot));
}

function uninstallCandidate(repoRoot) {
  return uninstallAssets(optionsFor(repoRoot));
}

function sha256(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

function regularJson(absolutePath, label) {
  if (!path.isAbsolute(absolutePath || '')) throw new Error(`${label} path must be absolute`);
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error(`${label} must be a regular unlinked file`);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is malformed: ${error.message}`);
  }
}

function parseRequest(requestPath, repoRoot) {
  const request = regularJson(requestPath, 'runner request');
  const keys = Object.keys(request).sort();
  const expectedKeys = ['acp', 'mcp', 'mode', 'prompt', 'schema_version', 'session_id', 'worktree'];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || request.schema_version !== 1 || !MODES.has(request.mode)
    || typeof request.session_id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(request.session_id)
    || typeof request.worktree !== 'string' || !path.isAbsolute(request.worktree)
    || typeof request.prompt !== 'string' || request.prompt.length < 1 || request.prompt.length > 65536
    || !request.mcp || !Array.isArray(request.mcp.servers) || Object.keys(request.mcp).length !== 1
    || !request.mcp.servers.every((server) => typeof server === 'string' && server.length > 0 && server.length <= 256)
    || !request.acp || Object.keys(request.acp).length !== 1
    || !(request.acp.agent === null || (typeof request.acp.agent === 'string' && request.acp.agent.length <= 256))) {
    throw new Error('runner request does not match schema version 1');
  }
  if (fs.realpathSync.native(request.worktree) !== fs.realpathSync.native(repoRoot)) {
    throw new Error('runner request worktree does not match the current project');
  }
  const sessions = regularJson(path.join(repoRoot, '.lazytrae', 'state', 'sessions.json'), 'sessions state');
  if (sessions.current_session_id !== request.session_id) throw new Error('runner request session does not match the current session');
  return request;
}

function parseRunner(report, mode) {
  const capability = report.capabilities.find((item) => item?.name === 'structured-runner');
  const runner = capability?.runner;
  if (capability?.status !== 'accessible' || !runner || runner.protocol !== 'stdin-json-v1'
    || !Array.isArray(runner.argv) || runner.argv.length < 1 || runner.argv.length > 8
    || !runner.argv.every((argument) => typeof argument === 'string' && argument.length > 0 && argument.length <= 1024)
    || !Number.isInteger(runner.timeout_ms) || runner.timeout_ms < 1 || runner.timeout_ms > 3000
    || !Array.isArray(runner.modes) || !runner.modes.every((item) => MODES.has(item))
    || !runner.modes.includes(mode)) {
    throw new Error('probe fixture does not prove an exact structured runner for the requested mode');
  }
  return runner;
}

function pending(detail, probe = null) {
  return { schema_version: 1, status: 'pending', detail, invoked: false, probe };
}

function invokeCandidate(repoRoot, input) {
  const issues = checkAssets(optionsFor(repoRoot)).issues;
  if (issues.length) return pending(issues.join('; '));
  const receipt = regularJson(path.join(repoRoot, RECEIPT_PATH), 'candidate receipt');
  const callerModified = receipt.files.find((entry) => entry.caller_modified);
  if (callerModified) return pending(`modified output ${callerModified.path}`);
  let request;
  try {
    request = parseRequest(input.requestPath, repoRoot);
  } catch (error) {
    return pending(error.message);
  }
  if (!input.executable || !input.expectedSha256 || !input.fixturePath) {
    return pending('executable, expected sha256, and probe fixture are required before invocation');
  }
  const probe = probeHost({
    host: 'cli', executable: input.executable,
    expectedSha256: input.expectedSha256, fixturePath: input.fixturePath,
  });
  if (probe.status !== 'accessible') return pending(`host probe is ${probe.status}: ${probe.detail}`, probe);
  let runner;
  try {
    runner = parseRunner(probe, request.mode);
  } catch (error) {
    return pending(error.message, probe);
  }
  const executable = probe.binary.path;
  if (sha256(executable) !== probe.binary.sha256) return pending('host binary changed after the probe', probe);
  const result = spawnSync(executable, runner.argv, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: CLEAN_ENVIRONMENT,
    input: `${JSON.stringify(request)}\n`,
    maxBuffer: 64 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: runner.timeout_ms,
    windowsHide: true,
  });
  if (result.error?.code === 'ETIMEDOUT') return pending('structured runner timed out', probe);
  if (result.error || result.status !== 0) return pending(result.error?.message || `structured runner exited ${result.status}`, probe);
  if (sha256(executable) !== probe.binary.sha256) return pending('host binary changed during invocation', probe);
  let response;
  try {
    response = JSON.parse(result.stdout);
  } catch (error) {
    return pending(`structured runner output is malformed: ${error.message}`, probe);
  }
  if (!response || response.schema_version !== 1 || response.status !== 'success'
    || response.session_id !== request.session_id || typeof response.worktree !== 'string'
    || !path.isAbsolute(response.worktree)
    || fs.realpathSync.native(response.worktree) !== fs.realpathSync.native(repoRoot)) {
    return pending('structured runner output does not match the request boundary', probe);
  }
  return { ...response, invoked: true, argv: runner.argv, probe };
}

module.exports = { checkCandidate, generateCandidate, invokeCandidate, uninstallCandidate };
