'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { selectVerificationPolicy } = require('./verification-risk-policy');

const COMPREHENSIVE_GATES = [
  'targeted-tests',
  'dependency-tests',
  'contract-tests',
  'paired-full-suites',
  'independent-review',
  'security-review',
  'real-surface',
  'final-assertions',
];

function validInvocation(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.command === 'string'
    && path.isAbsolute(value.command)
    && Array.isArray(value.args)
    && value.args.every((argument) => typeof argument === 'string')
    && (value.actor === undefined || ['primary', 'secondary'].includes(value.actor));
}

function invocationsFor(plan, gateId) {
  const invocations = plan?.gates?.[gateId];
  if (!Array.isArray(invocations) || invocations.length === 0 || !invocations.every(validInvocation)) return null;
  if (gateId === 'paired-full-suites') {
    if (invocations.length !== 2) return null;
    const actors = invocations.map(({ actor }) => actor);
    if (actors[0] !== 'primary' || actors[1] !== 'secondary') return null;
  } else if (invocations.length !== 1 || (invocations[0].actor && invocations[0].actor !== 'primary')) {
    return null;
  }
  return invocations;
}

function runInvocation(root, gateId, invocation, index, timeoutMs) {
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  const timedOut = result.error?.code === 'ETIMEDOUT';
  return {
    gate_id: gateId,
    invocation: index + 1,
    actor: invocation.actor || 'primary',
    outcome: result.status === 0 && !result.error ? 'passed' : 'failed',
    exit_code: Number.isInteger(result.status) ? result.status : null,
    timed_out: timedOut,
  };
}

function runVerificationGates(root, input, plan) {
  const initialPolicy = selectVerificationPolicy(input);
  const timeoutMs = Number.isInteger(plan?.timeoutMs) && plan.timeoutMs > 0 && plan.timeoutMs <= 120000
    ? plan.timeoutMs
    : 30000;
  const queued = [...initialPolicy.gates];
  const completed = new Set();
  const gateOutcomes = [];
  let escalated = false;

  while (queued.length > 0) {
    const gateId = queued.shift();
    if (completed.has(gateId)) continue;
    completed.add(gateId);
    const invocations = invocationsFor(plan, gateId);
    if (invocations === null) {
      gateOutcomes.push({
        gate_id: gateId,
        invocation: 1,
        actor: 'primary',
        outcome: 'failed',
        exit_code: null,
        timed_out: false,
      });
    } else {
      gateOutcomes.push(...invocations.map((invocation, index) => (
        runInvocation(root, gateId, invocation, index, timeoutMs)
      )));
    }
    if (!escalated && gateOutcomes.some(({ outcome }) => outcome === 'failed')) {
      escalated = true;
      if (gateId === 'final-assertions') completed.delete(gateId);
      const remaining = COMPREHENSIVE_GATES.filter((candidate) => !completed.has(candidate));
      queued.splice(0, queued.length, ...remaining);
    }
  }

  const effectiveLevel = escalated ? 'comprehensive' : initialPolicy.level;
  const actors = new Set(gateOutcomes.map(({ actor }) => actor));
  const passed = gateOutcomes.length > 0 && gateOutcomes.every(({ outcome }) => outcome === 'passed');
  return {
    schema_version: 'lazytrae.verification-report.v1',
    policy: {
      level: effectiveLevel,
      reasonCodes: escalated
        ? [...new Set([...initialPolicy.reasonCodes, 'actual-gate-failure'])]
        : initialPolicy.reasonCodes,
    },
    actor_count: actors.size,
    gate_outcomes: gateOutcomes,
    cost: {
      gate_invocations: gateOutcomes.length,
      targeted_invocations: gateOutcomes.filter(({ gate_id: gate }) => gate === 'targeted-tests').length,
      dependency_contract_invocations: gateOutcomes.filter(({ gate_id: gate }) => (
        gate === 'dependency-tests' || gate === 'contract-tests'
      )).length,
      full_suite_invocations: gateOutcomes.filter(({ gate_id: gate }) => gate === 'paired-full-suites').length,
    },
    passed,
  };
}

module.exports = { runVerificationGates };
