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

Print the computed fail-closed completion assessment.

Options:
  --json       Emit the assessment as JSON
  --help, -h   Show this help message
`);
    return;
  }

  const repoRoot = detectRepoRoot();
  const result = getCompletionStatus(repoRoot);
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'ready' ? 0 : 1;
    return;
  }
  const lines = [formatCompletionStatus(result)];

  const loopState = loadLoop(repoRoot);
  const adaptive = formatAdaptiveExplanation(loopState);
  if (adaptive) lines.push('', adaptive);

  console.log(lines.join('\n'));
  process.exitCode = result.status === 'ready' ? 0 : 1;
}

module.exports = { run };
