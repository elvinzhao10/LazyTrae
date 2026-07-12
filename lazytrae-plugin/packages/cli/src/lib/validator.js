const fs = require('fs');
const path = require('path');
const { resolveRepoPath } = require('./path-boundary');

let Ajv;
try {
  Ajv = require('ajv');
} catch (e) {
  Ajv = null;
}

const STATE_CONTRACTS = Object.freeze({
  'active-loop.json': { schemaFile: 'active-loop.schema.json', versionKey: 'version', version: 1 },
  'boulder.json': { schemaFile: 'boulder.schema.json', versionKey: 'schema_version', version: 2 },
  'sessions.json': { schemaFile: 'sessions.schema.json', versionKey: 'schema_version', version: 1 },
});

function formatAjvError(error) {
  let errorPath = error.instancePath;
  if (!errorPath && error.schemaPath) {
    const propertyMatch = error.schemaPath.match(/^#\/properties\/([^/]+)/);
    if (propertyMatch) {
      errorPath = `/${propertyMatch[1]}`;
    }
  }
  return `${errorPath || '/'} ${error.message}`;
}

function validateStateFile(repoRoot, stateFileName, schemaFileName) {
  const statePath = path.join(repoRoot, '.lazytrae', 'state', stateFileName);
  const schemaPath = path.join(repoRoot, '.lazytrae', 'schemas', schemaFileName);

  if (!fs.existsSync(statePath)) {
    return { valid: false, errors: [`State file not found: ${statePath}`] };
  }
  if (!fs.existsSync(schemaPath)) {
    return { valid: false, errors: [`Schema file not found: ${schemaPath}`] };
  }

  let stateData;
  try {
    stateData = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON in ${stateFileName}: ${e.message}`] };
  }

  let schemaData;
  try {
    schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON schema ${schemaFileName}: ${e.message}`] };
  }

  if (!Ajv) {
    return { valid: false, errors: ['Ajv is unavailable; cannot validate state schema'] };
  }

  let validate;
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validate = ajv.compile(schemaData);
  } catch (e) {
    return { valid: false, errors: [`Cannot compile schema ${schemaFileName}: ${e.message}`] };
  }

  let valid;
  try {
    valid = validate(stateData);
  } catch (e) {
    return { valid: false, errors: [`Cannot validate ${stateFileName}: ${e.message}`] };
  }

  if (!valid) {
    const errors = (validate.errors || []).map(formatAjvError);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateAllState(repoRoot) {
  const results = {};
  for (const [stateFile, contract] of Object.entries(STATE_CONTRACTS)) {
    const result = validateStateFile(repoRoot, stateFile, contract.schemaFile);
    if (result.valid) {
      const statePath = path.join(repoRoot, '.lazytrae', 'state', stateFile);
      const stateData = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      if (stateData[contract.versionKey] !== contract.version) {
        results[stateFile] = {
          valid: false,
          errors: [`Invalid ${contract.versionKey} in ${stateFile}: expected ${contract.version}`],
        };
        continue;
      }
    }
    results[stateFile] = result;
  }

  return results;
}

function checkCompletedTaskEvidence(repoRoot) {
  const boulderPath = path.join(repoRoot, '.lazytrae', 'state', 'boulder.json');
  if (!fs.existsSync(boulderPath)) {
    return { valid: true, errors: [] };
  }

  let boulder;
  try {
    boulder = JSON.parse(fs.readFileSync(boulderPath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Cannot inspect completed tasks: ${e.message}`] };
  }

  const errors = [];
  for (const [workId, work] of Object.entries(boulder.works || {})) {
    for (const task of work.tasks || []) {
      if (task.status !== 'complete') continue;
      const evidencePaths = Array.isArray(task.evidence_paths) ? task.evidence_paths : [];
      if (evidencePaths.length === 0) {
        errors.push(`${workId}/${task.id} is complete but has no evidence_paths`);
        continue;
      }
      for (const evidencePath of evidencePaths) {
        const resolved = resolveRepoPath(repoRoot, evidencePath, { mustExist: true });
        if (!resolved.ok) {
          errors.push(`${workId}/${task.id} invalid evidence path: ${evidencePath} (${resolved.error})`);
        } else if (!fs.statSync(resolved.path).isFile()) {
          errors.push(`${workId}/${task.id} evidence is not a file: ${evidencePath}`);
        } else if (fs.statSync(resolved.path).size === 0) {
          errors.push(`${workId}/${task.id} evidence empty: ${evidencePath}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateStateFile, validateAllState, checkCompletedTaskEvidence };
