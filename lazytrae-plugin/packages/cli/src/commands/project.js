'use strict';
const { detectRepoRoot } = require('../lib/loop-store');
const project = require('../lib/project-state');
const { DashboardError } = require('../lib/dashboard-files');

const LIMIT = 8 * 1024 * 1024;

function readStdinJSON() {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    process.stdin.on('data', chunk => {
      size += chunk.length;
      if (size > LIMIT) { reject(new DashboardError('INPUT_TOO_LARGE')); process.stdin.destroy(); return; }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new DashboardError('INVALID_JSON')); }
    });
    process.stdin.on('error', reject);
  });
}

function options(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    if (!['--actor', '--project-id'].includes(argv[index]) || values.has(argv[index]) || !argv[index + 1]) {
      throw new DashboardError('INVALID_ARGV');
    }
    values.set(argv[index], argv[index + 1]);
  }
  return { actor: values.get('--actor'), projectId: values.get('--project-id') };
}

async function invoke(root, args) {
  const [action, ...rest] = args;
  if (action === 'init') {
    const settings = options(rest);
    if (!settings.actor) throw new DashboardError('INVALID_ARGV');
    return project.init(root, settings);
  }
  if (action === 'read') {
    if (rest.length) throw new DashboardError('INVALID_ARGV');
    return project.read(root);
  }
  if (action === 'command') {
    const settings = options(rest);
    if (!settings.actor) throw new DashboardError('INVALID_ARGV');
    // A not-initialized repository answers before reading stdin: the
    // not-initialized path is inert for any input, including malformed bytes.
    if (!project.isInitialized(root)) return project.notInitialized('project.command');
    const command = await readStdinJSON();
    return project.execute(root, command, settings.actor);
  }
  throw new DashboardError('INVALID_ARGV');
}

async function run(args) {
  if (args.includes('--help') || !args.length) {
    console.log('Usage: lazytrae project init --actor <id> [--project-id <id>]\n       lazytrae project read\n       lazytrae project command --actor <id> < command.json\nPersistent opt-in project record over the vendored family core. init is the only action that creates the record; read and command are inert typed not-initialized results before init. Native goal mapping: the record id is the Trae repository identity (trae:<sha256>) shared with the dashboard and the native loop.');
    return 0;
  }
  try {
    const result = await invoke(detectRepoRoot(), args);
    console.log(JSON.stringify(result));
    return result?.status === 'rejected' ? 1 : 0;
  } catch (error) {
    console.error(JSON.stringify({ status: 'rejected', code: error.code ?? error.message }));
    return 1;
  }
}

module.exports = { run, invoke };
