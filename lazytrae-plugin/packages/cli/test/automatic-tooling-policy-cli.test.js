const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runCli } = require('./test-helpers');

test('tooling policy status validates the contract without mutating project or user state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazyseries-policy-cli-'));
  const home = path.join(root, 'home');
  const environment = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, 'config'), XDG_DATA_HOME: path.join(home, 'data') };
  try {
    fs.mkdirSync(path.join(root, '.git'));
    const projectState = path.join(root, '.lazytrae', 'state', 'tooling.json');
    fs.mkdirSync(path.dirname(projectState), { recursive: true });
    fs.writeFileSync(projectState, '{"caller":"unchanged"}\n');
    const before = fs.readFileSync(projectState, 'utf8');
    const result = runCli(['tooling', 'policy', 'status', '--capability', 'structural_search'], { cwd: root, env: environment });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /POLICY: ready/);
    assert.match(result.stdout, /PROVIDER: ast_grep/);
    assert.match(result.stdout, /EXECUTION: not performed/);
    assert.equal(fs.readFileSync(projectState, 'utf8'), before);
    assert.equal(fs.existsSync(path.join(environment.XDG_CONFIG_HOME, 'lazyseries', 'config.yaml')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
