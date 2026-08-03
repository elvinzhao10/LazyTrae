'use strict';

const { probeHost } = require('../lib/host-probe');

const VALUE_FLAGS = new Set(['--host', '--executable', '--expected-sha256', '--fixture']);

function usage() {
  return [
    'Usage: lazytrae host-probe --host ide|work|cli --executable <absolute-path> [options]',
    '',
    'Read-only options:',
    '  --expected-sha256 <digest>  Fail closed if the binary fingerprint differs',
    '  --fixture <absolute-path>   Classify a schema-v2 observation fixture',
    '  --json                      Print the typed JSON report',
    '',
    'The probe runs only --version and --help with a credential-free environment.',
    'It never changes host readiness; every report keeps host_readiness pending.',
    '',
  ].join('\n');
}

function parseArgs(args) {
  if (args.length > 10) return { kind: 'error', detail: 'too many host probe arguments' };
  const values = {};
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') {
      if (json) return { kind: 'error', detail: 'duplicate --json argument' };
      json = true;
      continue;
    }
    if (!VALUE_FLAGS.has(argument)) return { kind: 'error', detail: `unsupported host probe argument: ${argument}` };
    const value = args[index + 1];
    if (!value || value.startsWith('--') || value.length > 4096 || Object.hasOwn(values, argument)) {
      return { kind: 'error', detail: `invalid ${argument} value` };
    }
    values[argument] = value;
    index += 1;
  }
  const expectedSha256 = values['--expected-sha256'];
  if (expectedSha256 && !/^[a-f0-9]{64}$/i.test(expectedSha256)) {
    return { kind: 'error', detail: '--expected-sha256 must be a 64-character hexadecimal digest' };
  }
  return {
    kind: 'ok',
    json,
    request: {
      host: values['--host'],
      executable: values['--executable'],
      expectedSha256: expectedSha256?.toLowerCase(),
      fixturePath: values['--fixture'],
    },
  };
}

function printReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  console.log(`Trae ${report.host} probe: ${report.status}`);
  console.log(`Region: ${report.region}; edition: ${report.edition}`);
  console.log(`HOST READINESS: ${report.host_readiness.toUpperCase()}`);
  console.log(report.detail);
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const parsed = parseArgs(args);
  if (parsed.kind === 'error') {
    const report = {
      schema_version: 2,
      contract_version: '2.0.0',
      product: 'trae',
      host: 'unknown',
      status: 'unsupported',
      detail: parsed.detail,
      region: 'unknown',
      edition: 'unknown',
      binary: null,
      capabilities: [],
      observed_argv: [],
      host_readiness: 'pending',
    };
    printReport(report, args.includes('--json'));
    return 2;
  }
  const report = probeHost(parsed.request);
  printReport(report, parsed.json);
  return report.status === 'accessible' ? 0 : 2;
}

module.exports = { parseArgs, run };
