'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { inspectHostProfile, inspectHostProfiles } = require('../lib/host-adapter-lifecycle');

function detectRepoRoot() {
  let current = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: lazytrae status [--host ide|work|cli] [--skills-dir <absolute-path>] [--json]');
    return 0;
  }
  const valueFlags = new Set(['--host', '--skills-dir']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') continue;
    if (!valueFlags.has(argument) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`unsupported status argument: ${argument}`);
    index += 1;
  }
  const hostIndex = args.indexOf('--host');
  const host = hostIndex === -1 ? null : args[hostIndex + 1];
  if (hostIndex !== -1 && !['ide', 'work', 'cli'].includes(host)) throw new Error('--host must be ide, work, or cli');
  const repoRoot = detectRepoRoot();
  const skillsIndex = args.indexOf('--skills-dir');
  const workSkillsDir = skillsIndex === -1 ? null : path.resolve(args[skillsIndex + 1]);
  const options = { workSkillsDir };
  const profiles = host ? [inspectHostProfile(repoRoot, host, options)] : inspectHostProfiles(repoRoot, options);
  const report = { schema_version: 2, contract_version: '2.0.0', profiles };
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else for (const profile of profiles) {
    console.log(`${profile.host}: PACKAGE ${profile.package_readiness.toUpperCase()}; HOST ${profile.host_readiness.toUpperCase()}`);
    console.log(`  assets=${profile.package_assets.status} generated=${profile.generated_assets.status} config=${profile.config.status} probe=${profile.probe.status} registration=${profile.registration.status} session=${profile.session.status} mcp=${profile.mcp.status} observation=${profile.observation.status} support=${profile.support}`);
  }
  return profiles.some(profile => profile.package_readiness === 'failed') ? 1 : 0;
}

module.exports = { run };
