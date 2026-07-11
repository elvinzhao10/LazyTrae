const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { REPO_ROOT, makeFixture } = require('./test-helpers');

const ACTIVE_AGENT_NAMES = [
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
const LEGACY_AGENT_REFERENCE = /lazycodex|\bomo\b|old checkout|legacy harness/i;
const ABSENT_CONSUMER_DOCUMENT = /docs\/lazytrae-/i;

function agentFileNames(directory) {
  return fs.readdirSync(directory)
    .filter(file => file.endsWith('.md'))
    .map(file => path.basename(file, '.md'))
    .sort();
}

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
  assert.deepEqual(readActiveAgentNames(), ACTIVE_AGENT_NAMES);

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

});

test('all active agent source mirrors, templates, and fresh installs remain self-contained', () => {
  const sourceAgents = path.join(REPO_ROOT, '.trae', 'agents');
  const templateAgents = path.join(REPO_ROOT, 'packages', 'cli', 'templates', 'agents');
  const fixture = makeFixture('lazytrae-agent-mirror-');

  try {
    assert.deepEqual(agentFileNames(sourceAgents), ACTIVE_AGENT_NAMES);
    assert.deepEqual(agentFileNames(templateAgents), ACTIVE_AGENT_NAMES);

    for (const name of ACTIVE_AGENT_NAMES) {
      const source = fs.readFileSync(path.join(sourceAgents, `${name}.md`), 'utf8');
      const template = fs.readFileSync(path.join(templateAgents, `${name}.md`), 'utf8');
      const installed = fs.readFileSync(path.join(fixture, '.trae', 'agents', `${name}.md`), 'utf8');

      assert.equal(source, template, `${name} source mirror drifted from its template`);
      assert.equal(installed, template, `${name} was not installed from its template`);
      assert.doesNotMatch(template, LEGACY_AGENT_REFERENCE, `${name} retains legacy operational guidance`);
      assert.doesNotMatch(template, ABSENT_CONSUMER_DOCUMENT, `${name} links to documentation absent from consumer projects`);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
