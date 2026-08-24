'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { generateCandidate, invokeCandidate } = require('../lib/traecli-candidate');

const VALUE_FLAGS = new Set(['--request', '--executable', '--expected-sha256', '--fixture']);

function detectRepoRoot() {
  let current = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function parseRunArgs(args) {
  const values = {};
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      if (json) throw new Error('duplicate --json argument');
      json = true;
      continue;
    }
    if (!VALUE_FLAGS.has(argument)) throw new Error(`unsupported Trae CLI candidate argument: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--') || Object.hasOwn(values, argument)) throw new Error(`invalid ${argument} value`);
    values[argument] = value;
    index += 1;
  }
  const digest = values['--expected-sha256'];
  if (digest && !/^[0-9a-f]{64}$/i.test(digest)) throw new Error('--expected-sha256 must be a 64-character hexadecimal digest');
  return {
    json,
    input: {
      requestPath: values['--request'], executable: values['--executable'],
      expectedSha256: digest?.toLowerCase(), fixturePath: values['--fixture'],
    },
  };
}

function print(report, json) {
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else console.log(`Trae CLI candidate: ${report.status}\n${report.detail || ''}`);
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: lazytrae traecli-candidate generate|run [--request <absolute-json> --executable <absolute-path> --expected-sha256 <digest> --fixture <absolute-json>] [--json]');
    return 0;
  }
  const action = args[0];
  const rest = args.slice(1);
  const repoRoot = detectRepoRoot();
  try {
    if (action === 'generate') {
      if (rest.some((argument) => argument !== '--json')) throw new Error('generate accepts only --json');
      const report = generateCandidate(repoRoot);
      print(report, rest.includes('--json'));
      return 0;
    }
    if (action !== 'run') throw new Error('action must be generate or run');
    const parsed = parseRunArgs(rest);
    const report = invokeCandidate(repoRoot, parsed.input);
    print(report, parsed.json);
    return report.status === 'success' ? 0 : 2;
  } catch (error) {
    print({ schema_version: 1, status: 'pending', detail: error.message, invoked: false }, args.includes('--json'));
    return 2;
  }
}

module.exports = { run };
