const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeFixture, runCli } = require('./test-helpers');
const { readinessReport } = require('../src/lib/lazyseries-capability-readiness');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'lazyseries-capability-readiness.v2.json'), 'utf8'));
const expectedText = [
  'context7: disabled (optional, configuration only; Optional Context7 library documentation MCP. Enabled explicitly; credentials stay in the host environment.)',
  'grep_app: disabled (optional, configuration only; Experimental optional grep_app public-code MCP. Enabled explicitly; endpoint is unpinned.)',
  'filesystem: disabled (optional, configuration only; Optional project-scoped filesystem MCP. Enabled explicitly; npx runs only when the configured MCP host starts it.)',
  'playwright: disabled (optional, configuration only; Optional Playwright browser MCP. Enabled explicitly; npx runs only when the configured MCP host starts it.)',
].join('\n') + '\n';

function withFixture(prefix, callback) {
  const fixture = makeFixture(prefix);
  try {
    callback(fixture);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function validate(record) {
  assert.deepEqual(Object.keys(record).sort(), [...schema.required].sort());
  assert.equal(record.schema_version, schema.properties.schema_version.const);
  assert.equal(record.contract_version, schema.properties.contract_version.const);
  assert.equal(record.policy_digest, schema.properties.policy_digest.const);
  assert.equal(record.host, 'trae-cli');
  assert.ok(record.capability.length > 0);
  assert.ok(record.provider === null || typeof record.provider === 'string');
  assert.ok(schema.properties.internal_status.enum.includes(record.internal_status));
  assert.equal(record.readiness_scope, 'package');
  assert.ok(record.reason_code === null || typeof record.reason_code === 'string');
  assert.equal(typeof record.message, 'string');
  assert.equal(record.evidence.scope, 'package');
  assert.equal(record.evidence.session_id, null);
}

function records(result) {
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.ok(value.every(record => record.readiness_scope === 'package'));
  assert.doesNotMatch(result.stdout, /host-ready|live-host-proof|connected/);
  return value;
}

function recordFor(result, capability) {
  return records(result).find(record => record.capability === capability);
}

test('capability-status keeps its legacy text report byte-compatible', () => {
  withFixture('lazytrae-readiness-text-', fixture => {
    const result = runCli(['tooling', 'capability-status'], { cwd: fixture });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expectedText);
  });
});

test('capability-status --json returns schema-valid records without writing report inputs', () => {
  withFixture('lazytrae-readiness-json-', fixture => {
    const sentinels = [
      path.join(fixture, '.trae', 'mcp.json'),
      path.join(fixture, '.lazytrae', 'state', 'tooling.json'),
    ];
    const before = sentinels.map(hash);

    const result = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture });

    assert.equal(result.status, 0, result.stderr);
    const records = JSON.parse(result.stdout);
    assert.equal(records.length, 9);
    for (const record of records) validate(record);
    assert.doesNotMatch(result.stdout, /host-ready|live-host-proof|connected/);
    assert.deepEqual(records.map(record => record.capability), [
      'local_search',
      'structural_search',
      'code_navigation',
      'architecture_search',
      'documentation_search',
      'web_search',
      'external_code_search',
      'browser_automation',
      'filesystem_read',
    ]);
    assert.equal(records.find(record => record.capability === 'architecture_search').internal_status, 'disabled');
    assert.equal(records.find(record => record.capability === 'documentation_search').internal_status, 'disabled');
    assert.equal(records.find(record => record.capability === 'browser_automation').internal_status, 'disabled');
    assert.deepEqual(sentinels.map(hash), before);
  });
});

test('capability-status --json reports an absent tooling state as not-initialized without creating it', () => {
  withFixture('lazytrae-readiness-uninitialized-', fixture => {
    const statePath = path.join(fixture, '.lazytrae', 'state', 'tooling.json');
    fs.rmSync(statePath);

    const result = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture });

    assert.equal(result.status, 0, result.stderr);
    const records = JSON.parse(result.stdout);
    assert.equal(records.length, 9);
    assert.ok(records.every(record => record.internal_status === 'not-initialized'));
    assert.equal(fs.existsSync(statePath), false);
  });
});

test('capability-status --json discovers host and project providers without invoking them', () => {
  withFixture('lazytrae-readiness-incompatible-', fixture => {
    const bin = path.join(fixture, 'bin');
    const marker = path.join(fixture, 'provider-ran');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rg'), `#!/bin/sh\ntouch ${marker}\n`);
    fs.chmodSync(path.join(bin, 'rg'), 0o755);
    const projectProvider = path.join(fixture, 'node_modules', '.bin', 'typescript-language-server');
    fs.mkdirSync(path.dirname(projectProvider), { recursive: true });
    fs.writeFileSync(projectProvider, `#!/bin/sh\ntouch ${marker}\n`);
    fs.chmodSync(projectProvider, 0o755);
    fs.writeFileSync(path.join(fixture, 'tsconfig.json'), '{}\n');
    const statePath = path.join(fixture, '.lazytrae', 'state', 'tooling.json');
    fs.writeFileSync(statePath, JSON.stringify({ schema_version: 1, capabilities: { context7: { enabled: true, state: 'failed' } } }) + '\n');

    const result = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });

    assert.equal(recordFor(result, 'local_search').internal_status, 'package-ready');
    assert.equal(recordFor(result, 'code_navigation').internal_status, 'package-ready');
    assert.equal(recordFor(result, 'documentation_search').internal_status, 'failed-optional');
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(statePath, 'utf8').includes('"failed"'), true);
  });
});

test('capability-status --json maps a compatible host executable to package-ready', () => {
  withFixture('lazytrae-readiness-host-', fixture => {
    const bin = path.join(fixture, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rg'), '#!/bin/sh\necho "ripgrep 14.1.0"\n');
    fs.chmodSync(path.join(bin, 'rg'), 0o755);

    const result = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture, env: { ...process.env, PATH: bin } });

    assert.equal(recordFor(result, 'local_search').internal_status, 'package-ready');
  });
});

test('capability-status --json requires an executable receipt-owned CodeGraph provider', () => {
  withFixture('lazytrae-readiness-owned-', fixture => {
    const toolingRoot = path.join(fixture, 'owned-codegraph');
    const executable = path.join(toolingRoot, 'node_modules', '.bin', 'codegraph');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, '#!/bin/sh\n');
    const relative = path.relative(toolingRoot, executable);
    fs.writeFileSync(path.join(toolingRoot, 'lazytrae-tooling-receipt.json'), JSON.stringify({
      schema_version: 1,
      owner: 'lazytrae-tooling',
      tooling_root: toolingRoot,
      files: [{ path: relative, type: 'file', sha256: hash(executable) }],
      provisioned_capabilities: ['codegraph'],
    }) + '\n');
    const index = path.join(fixture, '.codegraph');
    fs.mkdirSync(index);
    fs.writeFileSync(path.join(index, 'codegraph.db'), Buffer.from('SQLite format 3\0' + ' '.repeat(16)));
    const statePath = path.join(fixture, '.lazytrae', 'state', 'tooling.json');
    fs.writeFileSync(statePath, JSON.stringify({ schema_version: 1, capabilities: { codegraph: { enabled: true, state: 'ready', tooling_root: toolingRoot } } }) + '\n');
    const stateHash = hash(statePath);

    const result = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture });
    const codegraph = recordFor(result, 'architecture_search');

    assert.equal(codegraph.internal_status, 'incompatible');
    fs.chmodSync(executable, 0o755);
    const executableResult = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture });
    const executableCodegraph = recordFor(executableResult, 'architecture_search');

    assert.equal(executableCodegraph.internal_status, 'owned-ready');
    assert.equal(executableCodegraph.evidence.scope, 'package');
    assert.equal(hash(statePath), stateHash);
  });
});

test('capability-status --json fails safely when the readiness contract integrity check fails', () => {
  withFixture('lazytrae-readiness-contract-', fixture => {
    const contractPath = path.join(fixture, 'readiness-contract.json');
    const checksumPath = `${contractPath}.sha256`;
    fs.copyFileSync(path.join(__dirname, '..', 'contracts', 'lazyseries-capability-readiness.v2.json'), contractPath);
    fs.writeFileSync(checksumPath, `0${'0'.repeat(63)}  readiness-contract.json\n`);

    const report = readinessReport(fixture, { contractPath, checksumPath });

    assert.equal(report.length, 9);
    assert.ok(report.every(record => record.internal_status === 'failed-optional'));
    assert.ok(report.every(record => record.reason_code === 'CONTRACT_INTEGRITY_INVALID'));
  });
});

test('capability-status --json treats malformed state as a report-only failed optional result', () => {
  withFixture('lazytrae-readiness-malformed-', fixture => {
    const statePath = path.join(fixture, '.lazytrae', 'state', 'tooling.json');
    const malformed = '{not-json\n';
    fs.writeFileSync(statePath, malformed);

    const result = runCli(['tooling', 'capability-status', '--json'], { cwd: fixture });

    assert.ok(records(result).every(record => record.internal_status === 'failed-optional'));
    assert.equal(fs.readFileSync(statePath, 'utf8'), malformed);
  });
});
