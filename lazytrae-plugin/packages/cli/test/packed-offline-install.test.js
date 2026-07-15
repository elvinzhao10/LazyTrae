const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || CLI_ROOT,
    encoding: 'utf8',
    env: { ...process.env, npm_config_update_notifier: 'false', ...options.env },
  });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function initialize(binary) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`installed MCP server timed out:\n${stderr}`));
    }, 10_000);
    const finish = (error, response) => {
      clearTimeout(timeout);
      child.kill();
      if (error) reject(error);
      else resolve(response);
    };

    child.stdout.on('data', chunk => {
      stdout += chunk;
      const [line] = stdout.split('\n');
      if (!line) return;
      try {
        finish(undefined, JSON.parse(line));
      } catch (error) {
        finish(new Error(`installed MCP emitted invalid JSON-RPC: ${error.message}`));
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish(error));
    child.stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
  });
}

test('packed CLI installs from a cold offline npm cache with only production dependencies', { timeout: 30_000 }, async () => {
  // Given: a freshly packed artifact and an empty cache, as available to an offline consumer.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-packed-offline-'));
  try {
    const [packageInfo] = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', root]));
    const tarball = path.join(root, packageInfo.filename);
    const members = run('tar', ['-tzf', tarball]).trim().split('\n');
    const bundledPackages = new Set(members
      .map(member => member.match(/^package\/node_modules\/([^/]+)\/package\.json$/)?.[1])
      .filter(Boolean));

    // When: npm installs the tarball without access to a populated cache or registry.
    const installRoot = path.join(root, 'install');
    run(npm, [
      'install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund',
      '--offline', '--package-lock=false', tarball,
    ], { env: { npm_config_cache: path.join(root, 'cold-cache') } });

    // Then: the artifact carries exactly the runtime dependency closure and its CLI/MCP work.
    assert.deepEqual(
      bundledPackages,
      new Set(['ajv', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string']),
      'the tarball must bundle only ajv and its production closure',
    );
    assert.equal(
      members.includes('package/node_modules/.package-lock.json'),
      false,
      'the tarball must not bundle npm installation metadata',
    );
    const binary = path.join(installRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'lazytrae.cmd' : 'lazytrae');
    const help = run(binary, ['--help'], { cwd: root });
    assert.match(help, /lazytrae/);
    const response = await initialize(binary);
    assert.equal(response.error, undefined);
    assert.equal(response.result.serverInfo.name, 'lazytrae-mcp');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
