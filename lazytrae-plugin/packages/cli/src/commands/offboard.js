'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { uninstallCandidate } = require('../lib/traecli-candidate');
const { routeFor } = require('../lib/host-adapter-lifecycle');

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
    console.log('Usage: lazytrae offboard --host ide|work|cli --yes [--skills-dir <absolute-path>]');
    return 0;
  }
  const hostIndex = args.indexOf('--host');
  const host = hostIndex === -1 ? null : args[hostIndex + 1];
  if (!['ide', 'work', 'cli'].includes(host)) throw new Error('--host must be ide, work, or cli');
  routeFor(host);
  if (!args.includes('--yes') && !args.includes('-y')) {
    console.log(`Offboard plan: remove exact receipt-owned ${host} outputs; preserve modified and unknown files. Re-run with --yes.`);
    return 0;
  }
  if (host === 'cli') {
    const repoRoot = detectRepoRoot();
    const receipt = path.join(repoRoot, '.traecli', 'candidate-receipt.v1.json');
    if (!fs.existsSync(receipt)) {
      console.log('Trae CLI candidate outputs: 0 removed, 0 preserved.');
      return 0;
    }
    const result = uninstallCandidate(repoRoot);
    if (result.preserved.length === 0) {
      for (const relative of ['candidates/lazytrae/commands', 'candidates/lazytrae/agents', 'candidates/lazytrae/skills', 'candidates/lazytrae', 'candidates', '.']) {
        const directory = path.join(repoRoot, '.traecli', relative);
        if (fs.existsSync(directory) && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
      }
    }
    console.log(`Trae CLI candidate outputs: ${result.removed.length} removed, ${result.preserved.length} preserved.`);
    return result.preserved.length > 0 ? 1 : 0;
  }
  if (host === 'work') {
    const work = require('./work');
    const result = work.uninstall(work.readSkillsDir(args));
    return result.preserved > 0 ? 1 : 0;
  }
  const result = require('./uninstall').run(['--yes', '--soft']);
  return result.preserved.some(item => /modified|caller/i.test(item)) ? 1 : 0;
}

module.exports = { run };
