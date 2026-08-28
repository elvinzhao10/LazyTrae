const { spawnSync } = require('child_process');
const fs = require('node:fs');
const path = require('path');
const { detectRepoRoot, formatCompletionStatus, getCompletionStatus } = require('../lib/completion-gates');
const { runVerificationGates } = require('../lib/verification-gate-runner');

function optionValue(args, name) {
  const indexes = args.flatMap((value, index) => value === name ? [index] : []);
  if (indexes.length !== 1 || !args[indexes[0] + 1] || args[indexes[0] + 1].startsWith('--')) {
    throw new Error(`${name} requires exactly one JSON file path.`);
  }
  return path.resolve(args[indexes[0] + 1]);
}

function gitTreeDirty(root) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5000,
  });
  return result.status !== 0 || result.stdout.trim().length > 0;
}

function runRiskVerification(args) {
  const root = detectRepoRoot();
  const parsedInput = JSON.parse(fs.readFileSync(optionValue(args, '--risk-input'), 'utf8'));
  const plan = JSON.parse(fs.readFileSync(optionValue(args, '--gate-plan'), 'utf8'));
  const input = parsedInput !== null && typeof parsedInput === 'object' && !Array.isArray(parsedInput)
    ? { ...parsedInput, dirtyTree: parsedInput.dirtyTree === true || gitTreeDirty(root) }
    : parsedInput;
  const report = runVerificationGates(root, input, plan);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report)}\n`);
  else process.stdout.write(`${report.passed ? 'passed' : 'failed'}: ${report.gate_outcomes.length} gate invocations\n`);
  return report.passed ? 0 : 1;
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae verify [options]

Run doctor health checks and fail when blocking issues are present.

Options:
  --help, -h   Show this help message
  --strict     Treat WARNs as FAILs
  --must-pass  Run doctor plus completion gates; exit 1 when incomplete
  --risk-input <path>  Select deterministic risk gates from a JSON request
  --gate-plan <path>   Execute selected gates from an explicit JSON command plan
  --json               Emit the executed gate report as JSON
`);
    return;
  }

  if (args.includes('--risk-input') || args.includes('--gate-plan')) {
    try {
      return runRiskVerification(args);
    } catch (error) {
      process.stderr.write(`lazytrae verify: ${error.message}\n`);
      return 1;
    }
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
