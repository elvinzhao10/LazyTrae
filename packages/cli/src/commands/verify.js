const fs = require('fs');
const path = require('path');

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae verify [options]

Same as doctor --strict (treats WARNs as FAILs).

Options:
  --help, -h   Show this help message
`);
    return;
  }

  const doctor = require('./doctor');
  doctor.run(['--strict']);
}

module.exports = { run };