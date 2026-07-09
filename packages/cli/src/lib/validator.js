const fs = require('fs');
const path = require('path');

let Ajv;
try {
  Ajv = require('ajv');
} catch (e) {
  Ajv = null;
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
    try {
      Ajv = require('ajv');
    } catch (e) {
      return { valid: true, errors: [], warning: 'ajv not installed — skipping schema validation' };
    }
  }

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schemaData);
  const valid = validate(stateData);

  if (!valid) {
    const errors = (validate.errors || []).map(e =>
      `${e.instancePath || '/'} ${e.message}`
    );
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateAllState(repoRoot) {
  const results = {};
  const stateDir = path.join(repoRoot, '.lazytrae', 'state');
  const schemaDir = path.join(repoRoot, '.lazytrae', 'schemas');

  if (!fs.existsSync(stateDir) || !fs.existsSync(schemaDir)) {
    return results;
  }

  const stateFiles = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));
  const schemaFiles = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));

  for (const stateFile of stateFiles) {
    const base = stateFile.replace('.json', '');
    const schemaFile = schemaFiles.find(s => s.startsWith(base + '.'));
    if (schemaFile) {
      results[stateFile] = validateStateFile(repoRoot, stateFile, schemaFile);
    }
  }

  return results;
}

module.exports = { validateStateFile, validateAllState };