const fs = require('fs');
const path = require('path');

const MIN_MEMBERS = 2;

/**
 * Checks team mode state. Returns an object compatible with doctor's addResult shape.
 *
 * @param {string} repoRoot - Absolute path to the repo root.
 * @returns {{ label: string, status: 'PASS'|'FAIL'|'WARN', detail?: string }}
 */
function checkTeamMode(repoRoot) {
  const teamDir = path.join(repoRoot, '.lazytrae', 'team');
  const schemaPath = path.join(repoRoot, '.lazytrae', 'schemas', 'team.schema.json');
  const teamPath = path.join(teamDir, 'team.json');

  if (!fs.existsSync(schemaPath)) {
    return { label: 'Team mode', status: 'FAIL', detail: 'Schema .lazytrae/schemas/team.schema.json not found' };
  }

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  } catch (e) {
    return { label: 'Team mode', status: 'FAIL', detail: `Schema parse error: ${e.message}` };
  }

  if (!fs.existsSync(teamDir)) {
    return { label: 'Team mode', status: 'PASS', detail: 'State directory ready (no active team)' };
  }

  if (!fs.existsSync(teamPath)) {
    return { label: 'Team mode', status: 'WARN', detail: 'State directory exists but no team.json found' };
  }

  let team;
  try {
    team = JSON.parse(fs.readFileSync(teamPath, 'utf-8'));
  } catch (e) {
    return { label: 'Team mode', status: 'FAIL', detail: `team.json parse error: ${e.message}` };
  }

  if (team.schemaVersion !== 2) {
    return { label: 'Team mode', status: 'FAIL', detail: 'team.json schemaVersion must be 2' };
  }

  if (!Array.isArray(team.members)) {
    return { label: 'Team mode', status: 'FAIL', detail: 'team.json members must be an array' };
  }

  if (team.members.length > 0 && team.members.length < MIN_MEMBERS) {
    return { label: 'Team mode', status: 'WARN', detail: `Team has ${team.members.length} member(s), minimum is ${MIN_MEMBERS}` };
  }

  const statusCounts = {};
  for (const m of team.members) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  }
  const membersSummary = Object.entries(statusCounts).map(([s, c]) => `${c} ${s}`).join(', ');

  return {
    label: 'Team mode',
    status: 'PASS',
    detail: `${team.members.length} members (${membersSummary}), team status: ${team.status}`,
  };
}

module.exports = { checkTeamMode };
