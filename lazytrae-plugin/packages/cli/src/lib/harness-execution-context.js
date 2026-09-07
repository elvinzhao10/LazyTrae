'use strict';

const { stableDigest, approvalClasses } = require('./adaptive-identity');

const LANES = Object.freeze(['goal', 'qa', 'code', 'security', 'context']);
const PRIOR = new Set(['PASS', 'FAIL', 'MISSING', 'STALE']);
const OWNERSHIP = new Set(['absent', 'unmodified', 'modified', 'untracked']);
const FORBIDDEN_EXECUTABLES = new Set(['rm', 'sudo', 'curl', 'wget', 'ssh', 'scp']);
const FORBIDDEN_INTERPRETERS = new Set(['bash', 'cmd', 'dash', 'fish', 'perl', 'powershell', 'pwsh', 'python', 'python3', 'ruby', 'sh', 'zsh']);
const FORBIDDEN_GIT = new Set(['push', 'reset', 'clean', 'checkout', 'restore', 'commit', 'rebase', 'merge', 'tag']);
const FORBIDDEN_NPM = new Set(['install', 'publish', 'uninstall', 'update']);
const NODE_EVALUATION = new Set(['-e', '--eval', '-p', '--print']);
const SAFE_TOKEN = /^[^;&|<>`$\r\n]+$/;

function executionRevision(goal) {
  return stableDigest({
    taskId: goal.id,
    objective: goal.objective,
    criteria: goal.successCriteria.map(({ id, runtime }) => ({ id, runtime: runtime === true })),
    ownedPaths: goal.ownedPaths || [],
    planCommands: goal.planCommands || [],
  });
}

function validateExecutionContext(input, goal, artifactIds) {
  const value = section(input, 'execution');
  if (Buffer.byteLength(JSON.stringify(value)) > 8192) fail('execution', 'must be at most 8192 bytes.');
  exactKeys(value, ['commandValidation', 'contractVersion', 'preTask', 'reviewLanes', 'taskDelta', 'terminalReport'], 'execution');
  literal(value.contractVersion, 1, 'execution.contractVersion');
  const expectedRevision = executionRevision(goal);
  literal(goal.executionRevision, expectedRevision, 'goal.executionRevision');
  const expectedCriteria = goal.successCriteria.map(({ id }) => id);
  const expectedPaths = goal.ownedPaths || [];
  const expectedCommands = goal.planCommands || [];
  const taskDelta = parseTaskDelta(value.taskDelta, goal.id, expectedRevision, expectedCriteria, expectedPaths, artifactIds);
  const preTask = parsePreTask(value.preTask, expectedPaths);
  const commandValidation = parseCommandValidation(value.commandValidation, expectedCommands);
  const terminalReport = parseTerminalReport(value.terminalReport, goal, expectedRevision, expectedCriteria, artifactIds);
  const reviewLanes = parseReviewLanes(value.reviewLanes, artifactIds);
  return { contractVersion: 1, taskDelta, preTask, commandValidation, terminalReport, reviewLanes };
}

function parseTaskDelta(input, taskId, revision, criterionIds, ownedPaths, artifactIds) {
  const value = section(input, 'execution.taskDelta');
  exactKeys(value, ['artifactRefs', 'criterionIds', 'ownedPaths', 'revision', 'taskId'], 'execution.taskDelta');
  literal(value.taskId, taskId, 'execution.taskDelta.taskId');
  literal(value.revision, revision, 'execution.taskDelta.revision');
  exactArray(value.criterionIds, criterionIds, 'execution.taskDelta.criterionIds');
  exactArray(value.ownedPaths, ownedPaths, 'execution.taskDelta.ownedPaths');
  const refs = artifactRefs(value.artifactRefs, artifactIds, 'execution.taskDelta.artifactRefs');
  return { taskId, revision, criterionIds: [...criterionIds], ownedPaths: [...ownedPaths], artifactRefs: refs };
}

function parsePreTask(input, ownedPaths) {
  const value = section(input, 'execution.preTask');
  exactKeys(value, ['captureMode', 'ownership', 'status'], 'execution.preTask');
  literal(value.captureMode, 'read-only', 'execution.preTask.captureMode');
  const status = strings(value.status, 'execution.preTask.status', 64);
  if (!Array.isArray(value.ownership) || value.ownership.length !== ownedPaths.length) fail('execution.preTask.ownership', 'must cover every owned path exactly once.');
  const ownership = value.ownership.map((entry, index) => {
    const item = section(entry, `execution.preTask.ownership[${index}]`);
    exactKeys(item, ['path', 'state'], `execution.preTask.ownership[${index}]`);
    literal(item.path, ownedPaths[index], `execution.preTask.ownership[${index}].path`);
    if (!OWNERSHIP.has(item.state)) fail(`execution.preTask.ownership[${index}].state`, 'is invalid.');
    return { path: item.path, state: item.state };
  });
  return { captureMode: 'read-only', status, ownership };
}

function parseCommandValidation(input, expectedCommands) {
  const value = section(input, 'execution.commandValidation');
  exactKeys(value, ['commands', 'runs'], 'execution.commandValidation');
  literal(value.runs, 1, 'execution.commandValidation.runs');
  if (!Array.isArray(value.commands) || value.commands.length !== expectedCommands.length) fail('execution.commandValidation.commands', 'must cover each plan command once.');
  const commands = value.commands.map((entry, index) => {
    const item = section(entry, `execution.commandValidation.commands[${index}]`);
    exactKeys(item, ['argv', 'status'], `execution.commandValidation.commands[${index}]`);
    exactArray(item.argv, expectedCommands[index], `execution.commandValidation.commands[${index}].argv`);
    validateSafeArgv(item.argv, `execution.commandValidation.commands[${index}].argv`);
    literal(item.status, 'valid', `execution.commandValidation.commands[${index}].status`);
    return { argv: [...item.argv], status: 'valid' };
  });
  return { runs: 1, commands };
}

function validateSafeArgv(argv, field) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((token) => typeof token !== 'string' || !SAFE_TOKEN.test(token))) fail(field, 'must be non-shell argv without control operators.');
  if (FORBIDDEN_EXECUTABLES.has(argv[0])) fail(field, 'contains a mutation or remote command.');
  if (FORBIDDEN_INTERPRETERS.has(argv[0])) fail(field, 'contains a shell or interpreter command.');
  if (argv[0] === 'node' && argv.slice(1).some((token) => NODE_EVALUATION.has(token) || token.startsWith('--eval='))) fail(field, 'contains interpreter evaluation.');
  if (argv[0] === 'git' && FORBIDDEN_GIT.has(gitSubcommand(argv))) fail(field, 'contains a mutating Git command.');
  if (['npm', 'pnpm', 'yarn'].includes(argv[0]) && FORBIDDEN_NPM.has(argv[1])) fail(field, 'contains a dependency or publication mutation.');
  if (approvalClasses(argv.join(' '), {}).length > 0) fail(field, 'requires approval and is not a safe plan check.');
}

function gitSubcommand(argv) {
  const optionsWithValues = new Set(['-C', '-c', '--config-env', '--exec-path', '--git-dir', '--namespace', '--super-prefix', '--work-tree']);
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (optionsWithValues.has(token)) {
      index += 1;
    } else if (!token.startsWith('-')) {
      return token;
    }
  }
  return null;
}

function parseTerminalReport(input, goal, revision, criterionIds, artifactIds) {
  const value = section(input, 'execution.terminalReport');
  exactKeys(value, ['criteria', 'revision', 'status', 'taskId'], 'execution.terminalReport');
  literal(value.status, 'complete', 'execution.terminalReport.status');
  literal(value.taskId, goal.id, 'execution.terminalReport.taskId');
  literal(value.revision, revision, 'execution.terminalReport.revision');
  if (!Array.isArray(value.criteria) || value.criteria.length !== criterionIds.length) fail('execution.terminalReport.criteria', 'must cover every criterion exactly once.');
  const criteria = value.criteria.map((entry, index) => {
    const field = `execution.terminalReport.criteria[${index}]`;
    const item = section(entry, field);
    const runtime = goal.successCriteria[index].runtime === true;
    exactKeys(item, runtime ? ['artifactRefs', 'id', 'status', 'transition'] : ['artifactRefs', 'id', 'status'], field);
    literal(item.id, criterionIds[index], `${field}.id`);
    literal(item.status, 'PASS', `${field}.status`);
    const refs = artifactRefs(item.artifactRefs, artifactIds, `${field}.artifactRefs`);
    const result = { id: item.id, status: 'PASS', artifactRefs: refs };
    if (runtime) result.transition = parseTransition(item.transition, field);
    return result;
  });
  return { status: 'complete', taskId: goal.id, revision, criteria };
}

function parseTransition(input, parent) {
  const value = section(input, `${parent}.transition`);
  exactKeys(value, ['after', 'before', 'entrypoint'], `${parent}.transition`);
  const entrypoint = text(value.entrypoint, `${parent}.transition.entrypoint`);
  const before = text(value.before, `${parent}.transition.before`);
  const after = text(value.after, `${parent}.transition.after`);
  if (before === after) fail(`${parent}.transition`, 'must record a real state change.');
  return { entrypoint, before, after };
}

function parseReviewLanes(input, artifactIds) {
  if (!Array.isArray(input) || input.length !== LANES.length) fail('execution.reviewLanes', 'must contain all five lanes.');
  return input.map((entry, index) => {
    const field = `execution.reviewLanes[${index}]`;
    const item = section(entry, field);
    exactKeys(item, ['artifactRef', 'id', 'inputAffected', 'prior', 'rerun', 'status'], field);
    literal(item.id, LANES[index], `${field}.id`);
    if (!PRIOR.has(item.prior)) fail(`${field}.prior`, 'is invalid.');
    if (typeof item.inputAffected !== 'boolean' || typeof item.rerun !== 'boolean') fail(field, 'inputAffected and rerun must be boolean.');
    literal(item.status, 'PASS', `${field}.status`);
    const required = item.prior !== 'PASS' || item.inputAffected;
    if (item.rerun !== required) fail(`${field}.rerun`, required ? 'must rerun this lane.' : 'must preserve this PASS lane.');
    artifactRefs([item.artifactRef], artifactIds, `${field}.artifactRef`);
    return { ...item };
  });
}

function artifactRefs(value, allowed, field) {
  const refs = strings(value, field, 32);
  if (refs.length === 0 || refs.some((id) => !allowed.has(id))) fail(field, 'must reference existing report artifacts.');
  return refs;
}

function strings(value, field, limit) {
  if (!Array.isArray(value) || value.length > limit || value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > 512)) fail(field, 'must be a bounded string array.');
  return [...value];
}

function exactArray(actual, expected, field) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(field, 'does not match the task contract.');
}

function exactKeys(value, expected, field) {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) fail(field, 'has unexpected or missing fields.');
}

function section(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'must be an object.');
  return value;
}

function text(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) fail(field, 'must be bounded text.');
  return value;
}

function literal(value, expected, field) {
  if (value !== expected) fail(field, `must be ${String(expected)}.`);
}

function fail(field, message) {
  throw new Error(`${field}: ${message}`);
}

module.exports = { LANES, executionRevision, validateExecutionContext, validateSafeArgv };
