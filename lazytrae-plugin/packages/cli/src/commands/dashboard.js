'use strict';
const path = require('node:path');
const { detectRepoRoot } = require('../lib/loop-store');
const { capture } = require('../lib/dashboard-snapshot');
const { lifecycle } = require('../lib/dashboard-service-lifecycle');
const { DashboardError } = require('../lib/dashboard-files');

async function invoke(root, args) {
  const [action, ...rest] = args;
  if (action === 'snapshot' && !rest.length) return capture(root);
  if (action === 'context' && rest.length === 1) {
    const { snapshot } = await capture(root);
    const task = snapshot.tasks.find(item => item.id === rest[0]);
    if (!task) throw new DashboardError('UNKNOWN_TASK');
    return { project_id: snapshot.project_id, run_id: snapshot.run_id, revision: snapshot.revision,
      plan_revision: snapshot.plan_revision, task, host_execution: 'not-observed' };
  }
  if (action === 'execute') {
    const [goalId, criterionId, ...flags] = rest; const request = { goalId, criterionId };
    const names = { '--executor': 'executor', '--verifier': 'verifier', '--timeout': 'timeout' };
    if (!goalId || !criterionId || flags.length % 2) throw new DashboardError('INVALID_ARGV');
    for (let i = 0; i < flags.length; i += 2) {
      const key = names[flags[i]];
      if (!key || request[key] !== undefined) throw new DashboardError('INVALID_ARGV');
      request[key] = key === 'timeout' ? Number(flags[i + 1]) : flags[i + 1];
    }
    return require('../lib/dashboard-producer').execute(root, request);
  }
  if (!['start', 'open', 'status', 'stop'].includes(action) || (rest.length && (rest.length !== 2 || rest[0] !== '--port'))) throw new DashboardError('INVALID_ARGV');
  const { snapshot } = await capture(root);
  return lifecycle(action === 'open' ? 'start' : action, { projectRoot: root, projectId: snapshot.project_id,
    runId: snapshot.run_id, assetRoot: path.resolve(__dirname, '../../shared/dashboard/ui'),
    ...(rest.length ? { port: Number(rest[1]) } : {}) });
}
async function run(args) {
  if (args.includes('--help') || !args.length) {
    console.log('Usage: lazytrae dashboard start|open|status|stop [--port N]\n       lazytrae dashboard snapshot\n       lazytrae dashboard context <goal-id>\n       lazytrae dashboard execute <goal-id> <criterion-id> --executor <script.js> --verifier <script.js> [--timeout ms]\nOpen returns the local browser URL and protected credential file. Native host embedding and handoff remain unobserved.');
    return 0;
  }
  try {
    const result = await invoke(detectRepoRoot(), args);
    console.log(JSON.stringify(result));
    return ['failed', 'cancelled'].includes(result.status) ? 1 : 0;
  } catch (error) {
    console.error(JSON.stringify({ status: 'rejected', code: error.code ?? error.message }));
    return 1;
  }
}
module.exports = { run, invoke };
