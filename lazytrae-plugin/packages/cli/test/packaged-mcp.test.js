const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CLI_ROOT = path.resolve(__dirname, '..');
const SOURCE_MCP_ROOT = path.resolve(CLI_ROOT, '..', 'mcp', 'src');
const FALLBACK_MCP_ROOT = path.join(CLI_ROOT, 'src', 'mcp');
const CLI_RUNTIME_ROOT = path.join(CLI_ROOT, 'src', 'lib');
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

function readJavaScriptFiles(root, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...readJavaScriptFiles(root, relativePath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(relativePath);
  }
  return files.sort();
}

function normalizeMcpSourceForCli(source) {
  return source.replaceAll('./runtime/', '../lib/');
}

function cliParityPath(relativePath, fallbackMcpRoot, cliRuntimeRoot) {
  const runtimePrefix = `runtime${path.sep}`;
  return relativePath.startsWith(runtimePrefix)
    ? path.join(cliRuntimeRoot, relativePath.slice(runtimePrefix.length))
    : path.join(fallbackMcpRoot, relativePath);
}

function assertMcpSourceParity(sourceMcpRoot, fallbackMcpRoot, cliRuntimeRoot) {
  const sourceFiles = readJavaScriptFiles(sourceMcpRoot);
  const handlerFiles = sourceFiles.filter(file => !file.startsWith(`runtime${path.sep}`));
  assert.deepEqual(readJavaScriptFiles(fallbackMcpRoot), handlerFiles);

  for (const file of sourceFiles) {
    const fallbackPath = cliParityPath(file, fallbackMcpRoot, cliRuntimeRoot);
    assert.equal(fs.existsSync(fallbackPath), true, `${file} is missing from the CLI parity source`);
    const source = fs.readFileSync(path.join(sourceMcpRoot, file), 'utf8');
    const fallback = fs.readFileSync(fallbackPath, 'utf8');
    assert.equal(fallback, normalizeMcpSourceForCli(source), `${file} drifted from the publishable fallback`);
  }
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
      if ([1, 2, 3, 4, 5].every(id => responses.has(id))) finish();
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish(error));
    child.on('exit', code => {
      if (![1, 2, 3, 4, 5].every(id => responses.has(id))) {
        finish(new Error(`installed MCP exited before responding (code ${code}):\n${stderr}`));
      }
    });

    child.stdin.end([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'run_check', arguments: {} } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'lazytrae.record_evidence', arguments: { gate_type: [] } } },
      { jsonrpc: '2.0', id: 5, method: 'ping' },
    ].map(request => JSON.stringify(request)).join('\n') + '\n');
  });
}

test('packaged CLI fallback MCP stays source-equivalent', () => {
  assertMcpSourceParity(SOURCE_MCP_ROOT, FALLBACK_MCP_ROOT, CLI_RUNTIME_ROOT);
});

test('packaged CLI parity check rejects runtime drift', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-parity-'));
  const sourceMcpRoot = path.join(temporaryRoot, 'mcp');
  const fallbackMcpRoot = path.join(temporaryRoot, 'cli-mcp');
  const cliRuntimeRoot = path.join(temporaryRoot, 'cli-lib');
  fs.mkdirSync(path.join(sourceMcpRoot, 'runtime'), { recursive: true });
  fs.mkdirSync(fallbackMcpRoot, { recursive: true });
  fs.mkdirSync(cliRuntimeRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceMcpRoot, 'runtime', 'path-boundary.js'), 'module.exports = { safe: true };\n');
  fs.writeFileSync(path.join(cliRuntimeRoot, 'path-boundary.js'), 'module.exports = { safe: false };\n');

  try {
    assert.throws(
      () => assertMcpSourceParity(sourceMcpRoot, fallbackMcpRoot, cliRuntimeRoot),
      /runtime\/path-boundary\.js drifted from the publishable fallback/,
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
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
    assert.equal(responses.get(3).error.code, -32601);
    assert.equal(responses.get(4).error.code, -32602);
    assert.deepEqual(responses.get(5).result, {});
    const project = path.join(temporaryRoot, 'project');
    fs.mkdirSync(path.join(project, '.git'), { recursive: true });
    run(binary, ['init'], { cwd: project });
    const sessions = path.join(project, '.lazytrae/state/sessions.json');
    fs.writeFileSync(sessions, JSON.stringify({ current_session_id: 's1', sessions: { s1: {} } }));
    const hook = spawnSync('bash', [path.join(project, '.trae/hooks/post-tool-use.sh')], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'main.js' } }), encoding: 'utf8',
    });
    assert.equal(hook.status, 0, hook.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(sessions)).sessions.s1.changed_files, ['main.js']);
    assert.equal(fs.existsSync(path.join(project, 'packages/cli/src/lib')), false);
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
