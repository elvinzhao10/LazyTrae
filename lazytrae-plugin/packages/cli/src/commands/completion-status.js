const {
  detectRepoRoot,
  formatCompletionStatus,
  getCompletionStatus,
} = require('../lib/completion-gates');
const { loadLoop } = require('../lib/loop-store');
const { formatAdaptiveExplanation } = require('../lib/adaptive-explanation');

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae completion-status [options]

Print whether active LazyTrae completion gates are ready or blocked.

Options:
  --help, -h   Show this help message
`);
    return;
  }

  const repoRoot = detectRepoRoot();
  const result = getCompletionStatus(repoRoot);
  const lines = [formatCompletionStatus(result)];

  const loopState = loadLoop(repoRoot);
  const adaptive = formatAdaptiveExplanation(loopState);
  if (adaptive) lines.push('', adaptive);

  console.log(lines.join('\n'));
  process.exit(result.status === 'ready' ? 0 : 1);
}

module.exports = { run };
