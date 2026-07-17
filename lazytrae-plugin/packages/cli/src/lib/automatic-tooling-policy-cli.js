const { defaultConfigPath, defaultToolpackPath, readConfig, resolveCapability } = require('./automatic-tooling-policy');

function parseStatusArgs(args) {
  if (args[0] !== 'status') throw new Error('policy supports only status');
  const capability = args.includes('--capability') ? args[args.indexOf('--capability') + 1] : 'local_search';
  const toolpack = args.includes('--toolpack') ? args[args.indexOf('--toolpack') + 1] : undefined;
  if (!capability || args.length !== (toolpack ? 5 : args.includes('--capability') ? 3 : 1)) throw new Error('usage: lazytrae tooling policy status [--capability <id>] [--toolpack <absolute-path>]');
  return { capability, toolpack };
}

function runPolicy(args) {
  const { capability, toolpack } = parseStatusArgs(args);
  const config = readConfig({ environment: process.env });
  const resolution = resolveCapability(capability, { config, environment: process.env, toolpackPath: toolpack });
  console.log(`POLICY: ready\nCAPABILITY: ${resolution.capability}\nPROVIDER: ${resolution.provider}\nCONTRACT_DIGEST: ${resolution.contractDigest}\nCONFIG: ${defaultConfigPath(process.env)}\nTOOLPACK: ${toolpack || defaultToolpackPath(process.env)}\nEXECUTION: not performed`);
  return 0;
}

module.exports = { runPolicy };
