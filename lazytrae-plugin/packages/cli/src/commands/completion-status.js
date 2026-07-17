const { detectRepoRoot, formatCompletionStatus, getCompletionStatus } = require('../lib/completion-gates');

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae completion-status [options]

Print whether active LazyTrae completion gates are ready or blocked.

Options:
  --help, -h   Show this help message
`);
    return;
  }

  const result = getCompletionStatus(detectRepoRoot());
  console.log(formatCompletionStatus(result));
  process.exit(result.status === 'ready' ? 0 : 1);
}

module.exports = { run };
