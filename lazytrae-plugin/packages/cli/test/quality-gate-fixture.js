'use strict';

const { executionRevision, LANES } = require('../src/lib/harness-execution-context');

function makeCanonicalQualityGate(goalInput = null) {
  const goal = goalInput || {
    id: 'goal-1',
    objective: 'Ship the T1 loop runtime',
    successCriteria: [{ id: 'crit-1', runtime: false }],
    ownedPaths: [],
    planCommands: [],
  };
  goal.executionRevision = goal.executionRevision || executionRevision(goal);
  const criterionIds = goal.successCriteria.map(({ id }) => id);
  const ownedPaths = goal.ownedPaths || [];
  const planCommands = goal.planCommands || [];
  return {
    codeReview: {
      by: 'lazytrae-code-reviewer',
      recommendation: 'APPROVE',
      codeQualityStatus: 'CLEAR',
      reportPath: '.lazytrae/evidence/code-review.md',
      evidence: 'Reviewer approved the implementation and focused tests.',
      blockers: [],
    },
    manualQa: {
      by: 'lazytrae-qa-executor',
      status: 'passed',
      evidence: 'CLI checkpoint scenarios passed with captured artifacts.',
      surfaceEvidence: [{
        id: 'surface-cli-pass',
        criterionRef: 'crit-1',
        surface: 'cli',
        invocation: 'lazytrae loop checkpoint --quality-gate-json .lazytrae/evidence/quality.json',
        verdict: 'passed',
        artifactRefs: ['artifact-cli-pass'],
      }],
      adversarialCases: [{
        id: 'adv-old-gate',
        criterionRef: 'crit-1',
        scenario: 'old snake_case local gate is submitted',
        expectedBehavior: 'checkpoint rejects the non-canonical gate before mutating state',
        verdict: 'passed',
        artifactRefs: ['artifact-cli-reject'],
      }],
      artifactRefs: [
        { id: 'artifact-cli-pass', kind: 'cli-transcript', description: 'Valid checkpoint transcript.', path: '.lazytrae/evidence/cli-pass.txt' },
        { id: 'artifact-cli-reject', kind: 'log', description: 'Invalid checkpoint rejection log.', path: '.lazytrae/evidence/rejection.txt' },
      ],
    },
    gateReview: {
      by: 'lazytrae-gate-reviewer',
      recommendation: 'APPROVE',
      reportPath: '.lazytrae/evidence/gate-review.md',
      evidence: 'Gate reviewer approved the artifact-backed completion.',
      blockers: [],
    },
    iteration: {
      fullRerun: true,
      status: 'passed',
      rerunCommands: ['cd packages/cli && npm test'],
      evidence: 'Full CLI test suite passed.',
    },
    criteriaCoverage: {
      totalCriteria: 1,
      passCount: 1,
      originalIntent: 'Validate canonical LazyTrae quality gates.',
      desiredOutcome: 'Only artifact-backed canonical gates complete the loop.',
      userOutcomeReview: 'The checkpoint behavior matches the requested user-visible contract.',
      adversarialClassesCovered: ['old_local_gate', 'missing_artifact'],
    },
    execution: {
      contractVersion: 1,
      taskDelta: {
        taskId: goal.id,
        revision: goal.executionRevision,
        criterionIds,
        ownedPaths,
        artifactRefs: ['artifact-cli-pass'],
      },
      preTask: { captureMode: 'read-only', status: [], ownership: ownedPaths.map((ownedPath) => ({ path: ownedPath, state: 'unmodified' })) },
      commandValidation: { runs: 1, commands: planCommands.map((argv) => ({ argv, status: 'valid' })) },
      terminalReport: {
        status: 'complete',
        taskId: goal.id,
        revision: goal.executionRevision,
        criteria: goal.successCriteria.map(({ id, runtime }) => ({
          id,
          status: 'PASS',
          artifactRefs: ['artifact-cli-pass'],
          ...(runtime ? { transition: { entrypoint: 'lazytrae loop record-evidence', before: 'pending', after: 'pass' } } : {}),
        })),
      },
      reviewLanes: LANES.map((id) => ({ id, prior: 'PASS', inputAffected: false, rerun: false, status: 'PASS', artifactRef: 'artifact-cli-pass' })),
    },
  };
}

module.exports = { makeCanonicalQualityGate };
