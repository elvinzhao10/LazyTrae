const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const SOURCE_MCP_ROOT = path.resolve(CLI_ROOT, '..', 'mcp', 'src');
const FALLBACK_MCP_ROOT = path.join(CLI_ROOT, 'src', 'mcp');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || CLI_ROOT,
    encoding: 'utf8',
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function readJavaScriptFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort();
}

function normalizeFallbackImports(source) {
  return source.replaceAll('../../cli/src/lib/', '../lib/');
}

function queryInstalledMcp(binary) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = new Map();
    let stderr = '';
    let stdout = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`installed MCP server timed out:\n${stderr}`));
    }, 10_000);

    function finish(error) {
      clearTimeout(timeout);
      child.kill();
      if (error) reject(error);
      else resolve(responses);
    }

    child.stdout.on('data', chunk => {
      stdout += chunk;
      const lines = stdout.split('\n');
      stdout = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        try {
          const response = JSON.parse(line);
          responses.set(response.id, response);
        } catch (error) {
          finish(new Error(`installed MCP emitted invalid JSON-RPC: ${error.message}`));
          return;
        }
      }
      if (responses.has(1) && responses.has(2)) finish();
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish(error));
    child.on('exit', code => {
      if (!responses.has(1) || !responses.has(2)) {
        finish(new Error(`installed MCP exited before responding (code ${code}):\n${stderr}`));
      }
    });

    child.stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
  });
}

test('packaged CLI fallback MCP stays source-equivalent', () => {
  const sourceFiles = readJavaScriptFiles(SOURCE_MCP_ROOT);
  assert.deepEqual(readJavaScriptFiles(FALLBACK_MCP_ROOT), sourceFiles);

  for (const file of sourceFiles) {
    const source = fs.readFileSync(path.join(SOURCE_MCP_ROOT, file), 'utf8');
    const fallback = fs.readFileSync(path.join(FALLBACK_MCP_ROOT, file), 'utf8');
    assert.equal(fallback, normalizeFallbackImports(source), `${file} drifted from the publishable fallback`);
  }
});

test('packed and prefix-installed CLI starts MCP with all 15 tools', { timeout: 30_000 }, async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-packaged-mcp-'));
  try {
    const packOutput = run(npm, ['pack', '--json', '--pack-destination', temporaryRoot]);
    const [packageInfo] = JSON.parse(packOutput);
    const tarball = path.join(temporaryRoot, packageInfo.filename);
    const installRoot = path.join(temporaryRoot, 'install');

    run(npm, [
      'install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund',
      '--offline', '--package-lock=false', tarball,
    ]);

    const binary = path.join(installRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'lazytrae.cmd' : 'lazytrae');
    const responses = await queryInstalledMcp(binary);
    const initialize = responses.get(1);
    const toolList = responses.get(2);

    assert.equal(initialize.error, undefined);
    assert.equal(initialize.result.serverInfo.name, 'lazytrae-mcp');
    assert.equal(initialize.result.protocolVersion, '2024-11-05');
    assert.equal(toolList.error, undefined);
    assert.equal(toolList.result.tools.length, 15);
    assert.deepEqual(
      toolList.result.tools.map(tool => tool.name),
      require('../src/mcp/tool-defs').TOOLS.map(tool => tool.name),
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
