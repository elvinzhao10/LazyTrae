const { providerMatrix } = require('../lib/provider-lifecycle');

function run(args) {
  if (args.some(argument => argument !== '--non-interactive' && argument !== '--json')) {
    console.error('lazytrae setup: usage: lazytrae setup [--non-interactive] [--json]');
    return 1;
  }
  const value = { mode: args.includes('--non-interactive') ? 'noninteractive' : 'interactive', configWritten: false, providers: providerMatrix({ environment: process.env }) };
  if (args.includes('--json')) console.log(JSON.stringify(value, null, 2));
  else console.log(`Provider setup is ${value.mode}; no configuration was written.`);
  return 0;
}

module.exports = { run };
