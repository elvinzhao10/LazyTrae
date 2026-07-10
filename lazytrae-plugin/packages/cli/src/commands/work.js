const fs = require('fs');
const os = require('os');
const path = require('path');

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates');

function printHelp() {
  console.log(`Usage: lazytrae work <command> [options]

Install and inspect LazyTrae's global Trae Work skills.

Commands:
  install     Copy every lazy-* skill into Trae Work's global skills directory
  status      Report whether the global skills are current

Options:
  --skills-dir <path>  Override the macOS default (~/.trae-cn/skills)

Trae Work has no global command registry. Use the installed skills by name or
natural language. MCP registration is intentionally manual in Settings → MCP.
`);
}

function readSkillsDir(args) {
  const flag = args.indexOf('--skills-dir');
  if (flag !== -1) {
    const value = args[flag + 1];
    if (!value || value.startsWith('--')) throw new Error('--skills-dir requires a path.');
    return path.resolve(value);
  }

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

function rejectSymlink(target) {
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`Refusing to write through symlinked global skill path: ${target}`);
  }
}

function skillState(skillsDir, name) {
  const source = path.join(TEMPLATES_DIR, 'skills', name, 'SKILL.md');
  const destination = path.join(skillsDir, name, 'SKILL.md');
  if (!fs.existsSync(destination)) return 'missing';
  if (fs.readFileSync(source, 'utf-8') === fs.readFileSync(destination, 'utf-8')) return 'current';
  return 'outdated';
}

function printMcpReminder() {
  console.log('\nMCP remains a one-time Trae Work setting: Settings → MCP, command `lazytrae`, argument `mcp`.');
  console.log('Global slash commands are not supported by Trae Work; use the installed skills or natural language.');
}

function install(skillsDir) {
  rejectSymlink(skillsDir);
  fs.mkdirSync(skillsDir, { recursive: true });

  let installed = 0;
  let updated = 0;
  let unchanged = 0;
  for (const name of listSkills()) {
    const destinationDir = path.join(skillsDir, name);
    const destination = path.join(destinationDir, 'SKILL.md');
    rejectSymlink(destinationDir);
    const state = skillState(skillsDir, name);
    if (state === 'current') {
      unchanged++;
      continue;
    }
    fs.mkdirSync(destinationDir, { recursive: true });
    fs.copyFileSync(path.join(TEMPLATES_DIR, 'skills', name, 'SKILL.md'), destination);
    if (state === 'missing') installed++;
    else updated++;
  }

  console.log(`Trae Work global skills: ${installed} installed, ${updated} updated, ${unchanged} already current.`);
  console.log(`Directory: ${skillsDir}`);
  console.log('Restart or reload Trae Work to discover newly copied skills.');
  printMcpReminder();
}

function status(skillsDir) {
  const states = listSkills().map(name => ({ name, state: skillState(skillsDir, name) }));
  const current = states.filter(entry => entry.state === 'current').length;
  const missing = states.filter(entry => entry.state === 'missing').length;
  const outdated = states.filter(entry => entry.state === 'outdated').length;
  console.log(`Trae Work global skills: ${current}/${states.length} current, ${missing} missing, ${outdated} outdated.`);
  console.log(`Directory: ${skillsDir}`);
  if (missing || outdated) console.log('Run `lazytrae work install` to repair the global skill installation.');
  printMcpReminder();
  return missing || outdated ? 1 : 0;
}

function run(args) {
  const command = args[0];
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (!['install', 'status'].includes(command)) {
    throw new Error(`Unknown Trae Work command '${command}'. Run \`lazytrae work --help\`.`);
  }

  const skillsDir = readSkillsDir(args.slice(1));
  if (command === 'install') install(skillsDir);
  else process.exitCode = status(skillsDir);
}

module.exports = { listSkills, readSkillsDir, run, skillState };
