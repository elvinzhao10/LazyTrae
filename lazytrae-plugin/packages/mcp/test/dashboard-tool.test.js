const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CLI_ROOT = path.resolve(PACKAGE_ROOT, '..', 'cli');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || PACKAGE_ROOT,
    encoding: 'utf8',
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function seedProject() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-dashboard-')));
  const goal = {
    id: 'goal-1', title: 'Dashboard goal', objective: 'Observe the native dashboard', status: 'pending',
    priority: 0, depends_on: [], successCriteria: [{ id: 'goal-1-c1', scenario: 'Native snapshot is readable', essential: true }],
  };
  const runId = 'run-mcp-dashboard';
  const loop = {
    version: 1, run_id: runId, loop_state: 'active', revision: 1, goals: [goal],
    brief_path: `.lazytrae/loop/${runId}/brief.md`, goals_path: `.lazytrae/loop/${runId}/goals.json`,
    ledger_path: `.lazytrae/loop/${runId}/ledger.jsonl`,
  };
  fs.mkdirSync(path.join(root, '.lazytrae', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, '.lazytrae', 'loop', runId), { recursive: true });
  fs.writeFileSync(path.join(root, '.lazytrae', 'state', 'active-loop.json'), `${JSON.stringify(loop, null, 2)}\n`);
  fs.writeFileSync(path.join(root, '.lazytrae', 'loop', runId, 'goals.json'), `${JSON.stringify([goal], null, 2)}\n`);
  return root;
}

function runInstalledMcp(entry, projectRoot, requests, expectedResponses) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = [];
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(responses);
    };
    const timer = setTimeout(() => finish(new Error(`installed MCP timed out; stdout=${stdout}; stderr=${stderr}`)), 20000);
    child.stdout.on('data', chunk => {
      stdout += chunk;
      const lines = stdout.split('\n');
      stdout = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        try { responses.push(JSON.parse(line)); } catch (error) { finish(new Error(`invalid JSON-RPC: ${error.message}`)); return; }
      }
      if (responses.length >= expectedResponses) finish();
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', finish);
    child.on('exit', code => {
      if (!settled) finish(new Error(`installed MCP exited early (${code}); stdout=${stdout}; stderr=${stderr}`));
    });
    child.stdin.end(requests.map(request => JSON.stringify(request)).join('\n') + '\n');
  });
}

test('dashboard tool delegates to the installed checked CLI package without sibling assumptions', { timeout: 90000 }, async () => {
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-mcp-dashboard-pack-'));
  const projectRoot = seedProject();
  try {
    const cliPack = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', workRoot], { cwd: CLI_ROOT }));
    const mcpPack = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', workRoot], { cwd: PACKAGE_ROOT }));
    const installRoot = path.join(workRoot, 'install');
    run(npm, [
      'install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund', '--offline', '--package-lock=false',
      path.join(workRoot, cliPack[0].filename), path.join(workRoot, mcpPack[0].filename),
    ]);
    const installedCli = path.join(installRoot, 'node_modules', 'lazytrae-ai');
    const installedMcp = path.join(installRoot, 'node_modules', '@lazytrae', 'mcp-server');
    assert.equal(fs.existsSync(path.join(installedCli, 'src', 'index.js')), true);
    assert.equal(fs.existsSync(path.join(installedMcp, 'src', 'index.js')), true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(installedCli, 'package.json'))).name, 'lazytrae-ai');
    const { handleDashboard, tool } = require('../src/handlers-dashboard');
    assert.equal(tool.name, 'lazytrae.dashboard');
    assert.throws(() => handleDashboard(projectRoot, { action: 'snapshot', port: 70000 }), /INVALID_DASHBOARD_ARGUMENTS/);
    assert.throws(() => handleDashboard(projectRoot, { action: 'reboot' }), /INVALID_DASHBOARD_ARGUMENTS/);
    assert.throws(() => handleDashboard(projectRoot, { action: 'context', task_id: '-injected' }), /INVALID_DASHBOARD_ARGUMENTS/);

    const responses = await runInstalledMcp(path.join(installedMcp, 'src', 'index.js'), projectRoot, [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lazytrae.dashboard', arguments: { action: 'snapshot' } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'lazytrae.dashboard', arguments: { action: 'context', task_id: 'goal-1' } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'lazytrae.dashboard', arguments: { action: 'context', task_id: 'missing' } } },
    ], 5);

    const tools = responses[1].result.tools.map(item => item.name);
    assert.equal(tools.includes('lazytrae.dashboard'), true);
    const snapshot = JSON.parse(responses[2].result.content[0].text);
    assert.match(snapshot.snapshot.project_id, /^trae:[a-f0-9]{64}$/);
    assert.equal(snapshot.snapshot.run_id, 'run-mcp-dashboard');
    assert.equal(snapshot.snapshot.tasks[0].id, 'goal-1');
    assert.equal(snapshot.snapshot.tasks[0].criteria[0].id, 'goal-1-c1');
    const context = JSON.parse(responses[3].result.content[0].text);
    assert.equal(context.task.id, 'goal-1');
    assert.equal(context.host_execution, 'not-observed');
    assert.ok(responses[4].error, 'unknown task must surface a tool error');
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
