const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT } = require('./test-helpers');

function readActiveAgentNames() {
  const config = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'config.json'), 'utf8'),
  );
  return [...new Set(Object.values(config.routing).flatMap(route => route.agents))].sort();
}

function requiredContextSection(template) {
  const heading = '## Required Context Files\n';
  const start = template.indexOf(heading);
  if (start === -1) return '';
  const context = template.slice(start + heading.length);
  const nextHeading = context.indexOf('\n## ');
  return nextHeading === -1 ? context : context.slice(0, nextHeading);
}

test('active agent templates require only consumer-available context', () => {
  const expectedAgents = [
    'atlas',
    'cleaner',
    'explorer',
    'hephaestus',
    'librarian',
    'metis',
    'migration-planner',
    'momus',
    'oracle',
    'prometheus',
    'sisyphus',
  ];
  assert.deepEqual(readActiveAgentNames(), expectedAgents);

  for (const name of readActiveAgentNames()) {
    const template = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'agents', `${name}.md`),
      'utf8',
    );
    assert.doesNotMatch(
      requiredContextSection(template),
      /docs\/lazytrae-/,
      `${name} requires repository documentation absent from a consumer project`,
    );
  }

  const migrationPlanner = fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'agents', 'migration-planner.md'),
    'utf8',
  );
  assert.doesNotMatch(
    migrationPlanner,
    /Read LazyCodex source files for reference/,
    'migration-planner must not require a LazyCodex checkout',
  );
  assert.match(
    migrationPlanner,
    /optional user-provided LazyCodex checkout/,
    'migration-planner may use LazyCodex material only when the user provides it',
  );
});
