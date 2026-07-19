const { spawnSync } = require('child_process');
const path = require('path');
const { detectRepoRoot, formatCompletionStatus, getCompletionStatus } = require('../lib/completion-gates');

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae verify [options]

Run doctor health checks and fail when blocking issues are present.

Options:
  --help, -h   Show this help message
  --strict     Treat WARNs as FAILs
  --must-pass  Run doctor plus completion gates; exit 1 when incomplete
`);
    return;
  }

  if (args.includes('--must-pass')) {
    const doctorArgs = args.includes('--strict') ? ['doctor', '--strict'] : ['doctor'];
    const cli = path.join(__dirname, '..', 'index.js');
    const doctor = spawnSync(process.execPath, [cli, ...doctorArgs], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    if (doctor.stdout) process.stdout.write(doctor.stdout);
    if (doctor.stderr) process.stderr.write(doctor.stderr);
    if (doctor.status !== 0) {
      console.log('Verification failed: doctor reported blocking checks; completion status withheld.');
      process.exit(1);
      return;
    }

    const status = getCompletionStatus(detectRepoRoot());
    console.log(formatCompletionStatus(status));
    if (status.status !== 'ready') process.exit(1);
    return;
  }

  const doctor = require('./doctor');
  doctor.run(args.includes('--strict') ? ['--strict'] : []);
}

module.exports = { run };
