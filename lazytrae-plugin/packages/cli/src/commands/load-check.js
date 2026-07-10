const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates');

function expectedNames(directory, predicate) {
  const source = path.join(TEMPLATES_DIR, directory);
  return fs.readdirSync(source, { withFileTypes: true })
    .filter(predicate)
    .map(entry => entry.name)
    .sort();
}

function missingEntries(repoRoot, directory, names, fileForName) {
  return names.filter(name => !fs.existsSync(path.join(repoRoot, '.trae', directory, name, fileForName)));
}

function detectRepoRoot() {
  let directory = process.cwd();
  while (directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, '.git'))) return directory;
    directory = path.dirname(directory);
  }
  return process.cwd();
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: lazytrae load-check [--host ide|work|cli]

Check that a freshly initialized repository has every LazyTrae host component.
The check proves the files and MCP declaration are ready for the host to scan;
reload or reopen the host after init so it performs that scan.
`);
    return 0;
  }

  const hostIndex = args.indexOf('--host');
  const host = hostIndex === -1 ? 'ide' : args[hostIndex + 1];
  if (!['ide', 'work', 'cli'].includes(host)) throw new Error('--host must be ide, work, or cli.');

  const repoRoot = detectRepoRoot();
  const checks = [];
  const check = (label, missing) => checks.push({ label, missing });
  check('skills', missingEntries(repoRoot, 'skills', expectedNames('skills', entry => entry.isDirectory()), 'SKILL.md'));
  check('commands', expectedNames('commands', entry => entry.isFile() && entry.name.endsWith('.md'))
    .filter(name => !fs.existsSync(path.join(repoRoot, '.trae', 'commands', name))));
  check('agents', expectedNames('agents', entry => entry.isFile() && entry.name.endsWith('.md'))
    .filter(name => !fs.existsSync(path.join(repoRoot, '.trae', 'agents', name))));
  check('rules', expectedNames('rules', entry => entry.isFile() && entry.name.endsWith('.md'))
    .filter(name => !fs.existsSync(path.join(repoRoot, '.trae', 'rules', name))));
  check('hooks', expectedNames('hooks', entry => entry.isFile() && entry.name.endsWith('.sh'))
    .filter(name => !fs.existsSync(path.join(repoRoot, '.trae', 'hooks', name))));

  const mcpPath = path.join(repoRoot, '.trae', 'mcp.json');
  let mcpError = '';
  try {
    const expected = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, 'mcp.json'), 'utf8')).mcpServers || {};
    const actual = JSON.parse(fs.readFileSync(mcpPath, 'utf8')).mcpServers || {};
    const missing = Object.keys(expected).filter(name => !actual[name]);
    if (missing.length) mcpError = `missing ${missing.join(', ')}`;
  } catch (error) {
    mcpError = error.message;
  }

  console.log('=== LazyTrae Tool Load Check ===');
  console.log(`Host: ${host}`);
  for (const result of checks) {
    const expected = expectedNames(result.label, entry => {
      if (result.label === 'skills') return entry.isDirectory();
      return entry.isFile() && (result.label === 'hooks' ? entry.name.endsWith('.sh') : entry.name.endsWith('.md'));
    }).length;
    const loaded = expected - result.missing.length;
    const status = result.missing.length ? 'FAIL' : 'PASS';
    console.log(`${status} ${result.label}: ${loaded}/${expected}${result.missing.length ? ` (missing: ${result.missing.join(', ')})` : ''}`);
  }
  console.log(`${mcpError ? 'FAIL' : 'PASS'} MCP declarations: ${mcpError || 'all template servers present'}`);

  if (host === 'work') {
    const work = require('./work');
    const skillsDir = work.readSkillsDir([]);
    const states = work.listSkills().map(name => work.skillState(skillsDir, name));
    const current = states.filter(state => state === 'current').length;
    const status = current === states.length ? 'PASS' : 'FAIL';
    console.log(`${status} global Trae Work skills: ${current}/${states.length} current`);
    console.log('MANUAL Settings → MCP is still required for Trae Work.');
    if (status === 'FAIL') checks.push({ label: 'global Trae Work skills', missing: ['outdated or missing skills'] });
  }

  const failed = checks.some(result => result.missing.length) || Boolean(mcpError);
  console.log(failed
    ? 'Load check failed. Run lazytrae sync, then reopen the host and re-run this check.'
    : 'Load check passed. Reopen or reload the host so it scans this repository.');
  return failed ? 1 : 0;
}

module.exports = { run };
