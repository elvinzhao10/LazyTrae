const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  assertSafeSkillPath,
  installWorkSkills,
  rejectHardLinkedFile,
  rejectSymlink,
  skillState: readSkillState,
} = require('../lib/work-skill-transaction');
const {
  formatHostMcpConfiguration,
  localCommand,
  MCP_JSON_BEGIN,
  MCP_JSON_END,
  shellQuote,
} = require('../lib/local-launcher');

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates');
const WORK_SKILLS_DIR_ENV = 'LAZYTRAE_WORK_SKILLS_DIR';

function printHelp() {
  console.log(`Usage: lazytrae work <command> [options]

Install and inspect LazyTrae's global Trae Work skills.

Commands:
  install     Copy every lazy-* skill into Trae Work's global skills directory
  status      Report whether the global skills are current
  uninstall   Remove only exact, unmodified LazyTrae skills

Options:
  --skills-dir <path>  Override the macOS default (~/.trae-cn/skills)

Trae Work has no global command registry. Use the installed skills by name or
natural language. MCP registration is intentionally manual in Settings → MCP.
`);
}

function readSkillsDir(args) {
  const optionArgs = args.length ? args : process.argv.slice(3);
  const flag = optionArgs.indexOf('--skills-dir');
  if (flag !== -1) {
    const value = optionArgs[flag + 1];
    if (!value || value.startsWith('--')) throw new Error('--skills-dir requires a path.');
    return path.resolve(value);
  }

  if (process.env[WORK_SKILLS_DIR_ENV]) return path.resolve(process.env[WORK_SKILLS_DIR_ENV]);

  if (process.platform !== 'darwin') {
    throw new Error('Trae Work global skills are only known on macOS. Pass --skills-dir with the directory reported by your Trae Work installation.');
  }
  return path.join(os.homedir(), '.trae-cn', 'skills');
}

function listSkills() {
  const sourceDir = path.join(TEMPLATES_DIR, 'skills');
  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('lazy-'))
    .map(entry => entry.name)
    .filter(name => fs.existsSync(path.join(sourceDir, name, 'SKILL.md')))
    .sort();
}

function skillState(skillsDir, name) {
  const source = path.join(TEMPLATES_DIR, 'skills', name, 'SKILL.md');
  const { destination } = assertSafeSkillPath(skillsDir, name);
  return readSkillState(source, destination);
}

function printMcpReminder() {
  console.log('\nWORK MCP ROUTE: OBSERVED PRERELEASE. After approval, paste this configuration into Settings → MCP; this is not a documented universal host contract.');
  console.log(MCP_JSON_BEGIN);
  console.log(formatHostMcpConfiguration(process.cwd()));
  console.log(MCP_JSON_END);
  console.log('Global slash commands are not supported by Trae Work; use the installed skills or natural language.');
}

function install(skillsDir) {
  const skills = listSkills();
  const result = installWorkSkills(skillsDir, skills.map(name => ({
    name,
    source: path.join(TEMPLATES_DIR, 'skills', name, 'SKILL.md'),
  })));

  console.log(`Trae Work global skills: ${result.installed} installed, ${result.updated} updated, ${result.unchanged} already current.`);
  console.log(`Directory: ${skillsDir}`);
  console.log('Restart or reload Trae Work to discover newly copied skills.');
  printMcpReminder();
}

function uninstall(skillsDir) {
  rejectSymlink(skillsDir);
  for (const name of listSkills()) assertSafeSkillPath(skillsDir, name);

  let removed = 0;
  let preserved = 0;
  for (const name of listSkills()) {
    const { destination, destinationDir } = assertSafeSkillPath(skillsDir, name);
    if (!fs.existsSync(destination)) continue;
    if (skillState(skillsDir, name) !== 'current' || fs.readdirSync(destinationDir).length !== 1) {
      preserved++;
      continue;
    }
    fs.unlinkSync(destination);
    fs.rmdirSync(destinationDir);
    removed++;
  }
  console.log(`Trae Work global skills: ${removed} removed, ${preserved} preserved.`);
  console.log(`Directory: ${skillsDir}`);
  console.log('Remove the LazyTrae MCP server manually in Settings → MCP; host installation paths are never guessed.');
}

function withSkillsDirOverride(skillsDir, callback) {
  const previous = process.env[WORK_SKILLS_DIR_ENV];
  process.env[WORK_SKILLS_DIR_ENV] = skillsDir;
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env[WORK_SKILLS_DIR_ENV];
    else process.env[WORK_SKILLS_DIR_ENV] = previous;
  }
}

function status(skillsDir) {
  const states = listSkills().map(name => ({ name, state: skillState(skillsDir, name) }));
  const current = states.filter(entry => entry.state === 'current').length;
  const missing = states.filter(entry => entry.state === 'missing').length;
  const outdated = states.filter(entry => entry.state === 'outdated').length;
  console.log(`Trae Work global skills: ${current}/${states.length} current, ${missing} missing, ${outdated} outdated.`);
  console.log(`Directory: ${skillsDir}`);
  if (missing || outdated) {
    console.log(`WORK SKILLS ACTION: APPROVAL REQUIRED. Ask before running ${localCommand(process.cwd())} work install --skills-dir ${shellQuote(skillsDir)}.`);
  }
  printMcpReminder();
  return missing || outdated ? 1 : 0;
}

function run(args) {
  const command = args[0];
  if (!command || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  if (!['install', 'status', 'uninstall'].includes(command)) {
    throw new Error(`Unknown Trae Work command '${command}'. Run \`lazytrae work --help\`.`);
  }

  const skillsDir = readSkillsDir(args.slice(1));
  if (command === 'install') install(skillsDir);
  else if (command === 'status') process.exitCode = status(skillsDir);
  else uninstall(skillsDir);
}

module.exports = {
  WORK_SKILLS_DIR_ENV,
  assertSafeSkillPath,
  install,
  listSkills,
  readSkillsDir,
  rejectHardLinkedFile,
  run,
  skillState,
  status,
  uninstall,
  withSkillsDirOverride,
};
