const fs = require('fs');
const path = require('path');
const { requireRepoFile } = require('./path-boundary');

const REQUIRED_SECTIONS = [
  'codeReview',
  'manualQa',
  'gateReview',
  'iteration',
  'criteriaCoverage',
];
const PLACEHOLDER = /^(?:placeholder|todo|tbd|n\/a|stub)$/i;
const ROLES = {
  codeReview: 'lazytrae-code-reviewer',
  manualQa: 'lazytrae-qa-executor',
  gateReview: 'lazytrae-gate-reviewer',
};
const SURFACES = new Set(['cli', 'http', 'tmux', 'browser', 'gui', 'data']);
const KINDS = new Set(['cli-transcript', 'log', 'screenshot', 'image', 'http-dump', 'data-diff']);

function validateQualityGate(repoRoot, qualityGatePath) {
  if (!qualityGatePath) throw new Error('Missing --quality-gate-json.');
  const absolute = requireRepoFile(repoRoot, qualityGatePath);
  const gate = parseGate(JSON.parse(fs.readFileSync(absolute, 'utf-8')), repoRoot);
  return { gate, path: qualityGatePath };
}

function parseGate(input, repoRoot) {
  const gate = section(input, 'qualityGate');
  const codeReview = section(gate.codeReview, 'codeReview');
  const manualQa = section(gate.manualQa, 'manualQa');
  const gateReview = section(gate.gateReview, 'gateReview');
  const iteration = section(gate.iteration, 'iteration');
  const coverage = section(gate.criteriaCoverage, 'criteriaCoverage');
  const totalCriteria = numberField(coverage.totalCriteria, 'criteriaCoverage.totalCriteria');
  const passCount = numberField(coverage.passCount, 'criteriaCoverage.passCount');
  if (passCount < totalCriteria) fail('criteriaCoverage.passCount', 'must cover totalCriteria.');
  const artifactRefs = parseArtifactRefs(manualQa.artifactRefs, repoRoot);
  const byId = artifactMap(artifactRefs);
  const codeReportPath = textField(codeReview.reportPath, 'codeReview.reportPath');
  const gateReportPath = textField(gateReview.reportPath, 'gateReview.reportPath');
  checkFile(repoRoot, codeReportPath, 'codeReview.reportPath');
  checkFile(repoRoot, gateReportPath, 'gateReview.reportPath');
  return {
    codeReview: {
      by: roleField(codeReview.by, ROLES.codeReview, 'codeReview.by'),
      recommendation: literal(codeReview.recommendation, 'APPROVE', 'codeReview.recommendation'),
      codeQualityStatus: literal(codeReview.codeQualityStatus, 'CLEAR', 'codeReview.codeQualityStatus'),
      reportPath: codeReportPath,
      evidence: textField(codeReview.evidence, 'codeReview.evidence'),
      blockers: emptyBlockers(codeReview.blockers, 'codeReview.blockers'),
    },
    manualQa: {
      by: roleField(manualQa.by, ROLES.manualQa, 'manualQa.by'),
      status: literal(manualQa.status, 'passed', 'manualQa.status'),
      evidence: textField(manualQa.evidence, 'manualQa.evidence'),
      surfaceEvidence: parseSurfaceEvidence(manualQa.surfaceEvidence, byId),
      adversarialCases: parseAdversarialCases(manualQa.adversarialCases, byId),
      artifactRefs,
    },
    gateReview: {
      by: roleField(gateReview.by, ROLES.gateReview, 'gateReview.by'),
      recommendation: literal(gateReview.recommendation, 'APPROVE', 'gateReview.recommendation'),
      reportPath: gateReportPath,
      evidence: textField(gateReview.evidence, 'gateReview.evidence'),
      blockers: emptyBlockers(gateReview.blockers, 'gateReview.blockers'),
    },
    iteration: {
      fullRerun: literal(iteration.fullRerun, true, 'iteration.fullRerun'),
      status: literal(iteration.status, 'passed', 'iteration.status'),
      rerunCommands: stringArray(iteration.rerunCommands, 'iteration.rerunCommands'),
      evidence: textField(iteration.evidence, 'iteration.evidence'),
    },
    criteriaCoverage: {
      totalCriteria,
      passCount,
      originalIntent: textField(coverage.originalIntent, 'criteriaCoverage.originalIntent'),
      desiredOutcome: textField(coverage.desiredOutcome, 'criteriaCoverage.desiredOutcome'),
      userOutcomeReview: textField(coverage.userOutcomeReview, 'criteriaCoverage.userOutcomeReview'),
      adversarialClassesCovered: stringArray(coverage.adversarialClassesCovered, 'criteriaCoverage.adversarialClassesCovered'),
    },
  };
}

function parseArtifactRefs(value, repoRoot) {
  if (!Array.isArray(value) || value.length === 0) fail('manualQa.artifactRefs', 'must not be empty.');
  return value.map((item, index) => {
    const field = `manualQa.artifactRefs[${index}]`;
    const ref = section(item, field);
    const artifactPath = textField(ref.path, `${field}.path`);
    checkFile(repoRoot, artifactPath, `${field}.path`);
    return {
      id: textField(ref.id, `${field}.id`),
      kind: kindField(ref.kind, `${field}.kind`),
      description: textField(ref.description, `${field}.description`),
      path: artifactPath,
    };
  });
}

function parseSurfaceEvidence(value, byId) {
  if (!Array.isArray(value) || value.length === 0) fail('manualQa.surfaceEvidence', 'must not be empty.');
  return value.map((item, index) => {
    const field = `manualQa.surfaceEvidence[${index}]`;
    const row = section(item, field);
    const surface = surfaceField(row.surface, `${field}.surface`);
    const artifacts = referencedArtifacts(row.artifactRefs, `${field}.artifactRefs`, byId);
    for (const artifact of artifacts) {
      if (!artifactCompatible(surface, artifact.kind)) fail('manualQa.surfaceEvidence', `${surface} artifact ${artifact.kind} is incompatible.`);
    }
    return {
      id: textField(row.id, `${field}.id`),
      criterionRef: textField(row.criterionRef, `${field}.criterionRef`),
      surface,
      invocation: textField(row.invocation, `${field}.invocation`),
      verdict: literal(row.verdict, 'passed', `${field}.verdict`),
      artifactRefs: artifacts.map(artifact => artifact.id),
    };
  });
}

function parseAdversarialCases(value, byId) {
  if (!Array.isArray(value) || value.length === 0) fail('manualQa.adversarialCases', 'must not be empty.');
  return value.map((item, index) => {
    const field = `manualQa.adversarialCases[${index}]`;
    const row = section(item, field);
    const artifacts = referencedArtifacts(row.artifactRefs, `${field}.artifactRefs`, byId);
    return {
      id: textField(row.id, `${field}.id`),
      criterionRef: textField(row.criterionRef, `${field}.criterionRef`),
      scenario: textField(row.scenario, `${field}.scenario`),
      expectedBehavior: textField(row.expectedBehavior, `${field}.expectedBehavior`),
      verdict: literal(row.verdict, 'passed', `${field}.verdict`),
      artifactRefs: artifacts.map(artifact => artifact.id),
    };
  });
}

function referencedArtifacts(value, field, byId) {
  return stringArray(value, field).map(id => {
    const artifact = byId.get(id);
    if (!artifact) fail(field, `references unknown artifact ${id}.`);
    return artifact;
  });
}

function artifactMap(refs) {
  const byId = new Map();
  for (const ref of refs) {
    if (byId.has(ref.id)) fail('manualQa.artifactRefs', `contains duplicate ${ref.id}.`);
    byId.set(ref.id, ref);
  }
  return byId;
}

function artifactCompatible(surface, kind) {
  if (surface === 'cli' || surface === 'tmux') return kind === 'cli-transcript' || kind === 'log';
  if (surface === 'http') return kind === 'http-dump';
  if (surface === 'browser' || surface === 'gui') return kind === 'screenshot' || kind === 'image';
  if (surface === 'data') return kind === 'data-diff';
  return false;
}

function checkFile(repoRoot, relativePath, field) {
  try {
    requireRepoFile(repoRoot, relativePath);
  } catch (error) {
    fail(field, error.message);
  }
}

function roleField(value, expected, field) {
  const actual = textField(value, field);
  if (actual !== expected) fail(field, `must be ${expected}.`);
  return expected;
}

function surfaceField(value, field) {
  const surface = textField(value, field);
  if (!SURFACES.has(surface)) fail(field, 'must be a supported manual QA surface.');
  return surface;
}

function kindField(value, field) {
  const kind = textField(value, field);
  if (!KINDS.has(kind)) fail(field, 'must be a supported artifact kind.');
  return kind;
}

function section(value, field) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  fail(field, 'must be an object.');
}

function textField(value, field) {
  if (typeof value !== 'string' || value.trim() === '') fail(field, 'must be a non-empty string.');
  const trimmed = value.trim();
  if (PLACEHOLDER.test(trimmed)) fail(field, 'must not be placeholder text.');
  return trimmed;
}

function numberField(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(field, 'must be numeric.');
  return value;
}

function stringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) fail(field, 'must be a non-empty array.');
  return value.map(item => textField(item, field));
}

function emptyBlockers(value, field) {
  if (Array.isArray(value) && value.length === 0) return [];
  fail(field, 'must be empty.');
}

function literal(value, expected, field) {
  if (value === expected) return expected;
  if (value === 'not_applicable') fail(field, 'must not be not_applicable.');
  fail(field, `must be ${String(expected)}.`);
}

function fail(field, message) {
  throw new Error(`${field}: ${message}`);
}

module.exports = { REQUIRED_SECTIONS, validateQualityGate };
