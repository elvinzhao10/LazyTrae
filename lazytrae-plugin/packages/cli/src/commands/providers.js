const { providerMatrix } = require('../lib/provider-lifecycle');
const { loadContract, readConfig, saveConfig } = require('../lib/automatic-tooling-policy');

function usage() {
  console.log('Usage: lazytrae providers [--json] | providers configure --provider <id> [--credential-ref <opaque-ref>] [--endpoint <https-url>] [--json] | providers test [--json]');
}

function jsonRequested(args) {
  return args.includes('--json');
}

function render(value, json) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else value.providers.forEach(provider => console.log(`${provider.id}: ${provider.pricing}; credential=${provider.credential || 'none'}; read-only=${provider.readOnly}; reachability=${provider.reachability}`));
}

function parseConfigure(args) {
  const allowed = new Set(['--provider', '--credential-ref', '--endpoint', '--json']);
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (!allowed.has(name) || Object.hasOwn(values, name)) throw new Error('invalid providers configure arguments');
    if (name === '--json') { values[name] = true; continue; }
    const value = args[++index];
    if (!value) throw new Error(`${name} requires a value`);
    values[name] = value;
  }
  if (!values['--provider']) throw new Error('providers configure requires --provider');
  return values;
}

function configure(args) {
  const values = parseConfigure(args);
  const provider = values['--provider'];
  const { contract } = loadContract();
  if (!Object.hasOwn(contract.providers, provider)) throw new Error('AUTOMATIC_TOOLING_UNKNOWN_PROVIDER');
  const config = readConfig({ environment: process.env });
  if (values['--credential-ref']) config.credential_refs[provider] = values['--credential-ref'];
  if (values['--endpoint']) config.endpoints[provider] = values['--endpoint'];
  if (!config.priority.includes(provider)) config.priority.push(provider);
  saveConfig(config, { environment: process.env });
  render({ configured: provider, providers: providerMatrix({ environment: process.env, config }) }, values['--json'] === true);
  return 0;
}

function run(args) {
  try {
    if (args.includes('--help') || args.includes('-h')) { usage(); return 0; }
    if (args[0] === 'configure') return configure(args.slice(1));
    if (args.length > 0 && args[0] !== 'test' && !(args.length === 1 && args[0] === '--json')) throw new Error('unknown providers command');
    const matrix = providerMatrix({ environment: process.env });
    const value = { providers: matrix.map(provider => args[0] === 'test' ? { ...provider, reachability: 'not-tested-noninteractive' } : provider) };
    render(value, jsonRequested(args));
    return 0;
  } catch (error) {
    console.error(`lazytrae providers: ${error.message}`);
    return 1;
  }
}

module.exports = { run };
