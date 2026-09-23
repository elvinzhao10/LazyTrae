const fs = require('fs');
const path = require('path');

const EXPECTED_CATEGORIES = [
  'quick',
  'deep',
  'ultrabrain',
  'visual-engineering',
  'writing',
  'review',
];

/**
 * Checks the .lazytrae/config.json routing section for the 6 routing categories.
 * Returns a result object compatible with doctor's addResult shape.
 *
 * @param {string} repoRoot - Absolute path to the repo root.
 * @returns {{ checked: boolean, label: string, status: 'PASS'|'FAIL'|'WARN', detail?: string }}
 */
function checkModelRouting(repoRoot) {
  const configPath = path.join(repoRoot, '.lazytrae', 'config.json');
  if (!fs.existsSync(configPath)) {
    return { checked: false, label: 'Model routing', status: 'WARN', detail: 'config.json not found' };
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return { checked: true, label: 'Model routing', status: 'FAIL', detail: `Cannot parse config.json: ${e.message}` };
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { checked: true, label: 'Model routing configuration', status: 'FAIL', detail: 'config.json must contain an object' };
  }

  if (!config.routing) {
    return { checked: true, label: 'Model routing', status: 'WARN', detail: 'No routing section in config.json' };
  }

  const presentCategories = Object.keys(config.routing);
  const missingCats = EXPECTED_CATEGORIES.filter(c => !presentCategories.includes(c));
  if (missingCats.length === 0) {
    const invalidCats = EXPECTED_CATEGORIES.filter(category => {
      const route = config.routing[category];
      return !route || typeof route !== 'object' || Array.isArray(route)
        || typeof route.traeMode !== 'string' || !route.traeMode.trim()
        || !Array.isArray(route.agents) || route.agents.length === 0
        || route.agents.some(agent => typeof agent !== 'string' || !agent.trim());
    });
    if (invalidCats.length > 0) {
      return {
        checked: true,
        label: 'Model routing configuration',
        status: 'FAIL',
        detail: `Invalid route values: ${invalidCats.join(', ')}`,
      };
    }
    return {
      checked: true,
      label: `Model routing configuration (${presentCategories.length} categories)`,
      status: 'PASS',
      detail: `All 6 categories configured: ${presentCategories.join(', ')}. Native model resolution is not observed.`,
    };
  }

  return {
    checked: true,
    label: 'Model routing',
    status: 'FAIL',
    detail: `Missing categories: ${missingCats.join(', ')}`,
  };
}

module.exports = { checkModelRouting, EXPECTED_CATEGORIES };
