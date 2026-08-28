'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildCapabilityMatrix } = require('../lib/host-capability-matrix');

const VALUES = new Set(['--host', '--client', '--execution', '--probe', '--receipt', '--session-id', '--now']);

function repoRoot() {
  let current = process.cwd();
  while (!fs.existsSync(path.join(current, '.git'))) {
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
  return current;
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: lazytrae host-capabilities --host ide|cli|work [--probe <absolute-json>] [--receipt <absolute-json>] [--client desktop|web|mobile] [--execution local|cloud] [--session-id <id>] [--json]');
    return 0;
  }
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') continue;
    if (!VALUES.has(argument) || !args[index + 1] || args[index + 1].startsWith('--') || Object.hasOwn(values, argument)) {
      throw new Error(`invalid host capability argument: ${argument}`);
    }
    values[argument] = args[index + 1];
    index += 1;
  }
  for (const flag of ['--probe', '--receipt']) {
    if (values[flag] && !path.isAbsolute(values[flag])) throw new Error(`${flag} must be an absolute path`);
  }
  const matrix = buildCapabilityMatrix(repoRoot(), values['--host'], {
    client: values['--client'],
    execution: values['--execution'],
    probePath: values['--probe'],
    receiptPath: values['--receipt'],
    sessionId: values['--session-id'],
    now: values['--now'],
  });
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(matrix, null, 2)}\n`);
  else for (const item of matrix.capabilities) console.log(`${item.capability_id}: ${item.status}`);
  return 0;
}

module.exports = { run };
