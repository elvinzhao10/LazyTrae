const fs = require('fs');
const path = require('path');

function detectRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function safeReadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae handoff [options]

Print handoff summary from current state.

Options:
  --help, -h   Show this help message
  --json       Output as JSON instead of markdown
`);
    return;
  }

  const repoRoot = detectRepoRoot();
  const asJson = args.includes('--json');

  const boulder = safeReadJSON(path.join(repoRoot, '.lazytrae', 'state', 'boulder.json'));
  const loop = safeReadJSON(path.join(repoRoot, '.lazytrae', 'state', 'active-loop.json'));
  const sessions = safeReadJSON(path.join(repoRoot, '.lazytrae', 'state', 'sessions.json'));

  const evidenceDir = path.join(repoRoot, '.lazytrae', 'evidence');
  const evidenceFiles = fs.existsSync(evidenceDir)
    ? fs.readdirSync(evidenceDir).filter(f => f.endsWith('.md'))
    : [];

  // Determine active work
  let activeWork = null;
  if (boulder && boulder.active_work_id && boulder.works) {
    activeWork = boulder.works[boulder.active_work_id] || null;
  }

  // Determine active loop
  let activeLoop = !!loop && loop.active_goal_id !== null;

  // Build summary
  const now = new Date().toISOString();
  const sessionId = sessions ? (sessions.current_session_id || 'unknown') : 'unknown';

  const handoff = {
    sessionId,
    handoffDate: now,
    whatWasAccomplished: [],
    currentState: {
      planFile: activeWork ? activeWork.active_plan : null,
      tasksCompleted: activeWork
        ? `${activeWork.tasks.filter(t => t.status === 'complete').length}/${activeWork.tasks.length}`
        : 'N/A',
      currentTask: activeWork
        ? (activeWork.tasks.find(t => t.status === 'in_progress') || null)
        : null,
      activeLoop,
      loopIteration: loop ? `${loop.iteration || 0}/${loop.max_iterations || 500}` : 'N/A',
    },
    evidenceProduced: evidenceFiles.map(f => `.lazytrae/evidence/${f}`),
    remainingGaps: [],
    blockers: [],
    nextPrompt: '',
  };

  if (activeWork) {
    for (const task of activeWork.tasks) {
      if (task.status === 'complete') {
        handoff.whatWasAccomplished.push(`${task.description} (${task.id})`);
      }
    }
    for (const blocker of (activeWork.blockers || [])) {
      handoff.blockers.push(`${blocker.task_id}: ${blocker.reason}`);
    }
  }

  if (loop && loop.goals) {
    for (const goal of loop.goals) {
      if (goal.status === 'blocked') {
        handoff.blockers.push(`${goal.id}: ${goal.blocked_reason || 'no reason'}`);
      }
    }
  }

  if (asJson) {
    console.log(JSON.stringify(handoff, null, 2));
    return;
  }

  // Output as markdown
  console.log(`# Session Handoff

## Handoff Summary

- **Session ID**: ${handoff.sessionId}
- **Handoff date**: ${handoff.handoffDate}
- **Agent**: LazyTrae CLI

## What Was Accomplished

${handoff.whatWasAccomplished.length > 0
    ? handoff.whatWasAccomplished.map(a => `- ${a}`).join('\n')
    : '- (no active work)'}

## Current State

- **Plan file**: ${handoff.currentState.planFile || 'N/A'}
- **Tasks completed**: ${handoff.currentState.tasksCompleted}
- **Current task**: ${handoff.currentState.currentTask
    ? `${handoff.currentState.currentTask.id} — ${handoff.currentState.currentTask.description} (status: ${handoff.currentState.currentTask.status})`
    : 'None'}
- **Active loop**: ${handoff.currentState.activeLoop ? 'Active' : 'Inactive'}
- **Loop iteration**: ${handoff.currentState.loopIteration}

## Evidence Produced

${handoff.evidenceProduced.length > 0
    ? handoff.evidenceProduced.map(e => `- ${e}`).join('\n')
    : '- (none)'}

## Remaining Gaps

${handoff.remainingGaps.length > 0
    ? handoff.remainingGaps.map(g => `- ${g}`).join('\n')
    : '- (none identified)'}

## Blockers

${handoff.blockers.length > 0
    ? handoff.blockers.map(b => `- ${b}`).join('\n')
    : '- None.'}

## Next Prompt

\`\`\`
${handoff.nextPrompt || '(paste the next prompt to continue)'}
\`\`\`
`);
}

module.exports = { run };