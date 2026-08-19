#!/usr/bin/env node

const { existsSync } = require('fs');
const path = require('path');
const { CURRENT_VERSION } = require('./lib/version');

const commands = {
  init: () => require('./commands/init').run,
  onboard: () => require('./commands/init').run,
  initdeep: () => require('./commands/init').run,
  doctor: () => require('./commands/doctor').run,
  sync: () => require('./commands/sync').run,
  status: () => require('./commands/status').run,
  offboard: () => require('./commands/offboard').run,
  uninstall: () => require('./commands/uninstall').run,
  verify: () => require('./commands/verify').run,
  'completion-status': () => require('./commands/completion-status').run,
  handoff: () => require('./commands/handoff').run,
  hook: () => require('./commands/hook').run,
  mcp: () => require('./commands/mcp').run,
  loop: () => require('./commands/loop').run,
  run: () => require('./commands/run').run,
  team: () => require('./commands/team').run,
  work: () => require('./commands/work').run,
  tooling: () => require('./commands/tooling').run,
  setup: () => require('./commands/setup').run,
  providers: () => require('./commands/providers').run,
  lsp: () => require('./commands/lsp').run,
  codegraph: () => require('./commands/codegraph').run,
  'load-check': () => require('./commands/load-check').run,
  'host-probe': () => require('./commands/host-probe').run,
  'traecli-candidate': () => require('./commands/traecli-candidate').run,
  lifecycle: () => require('./commands/lifecycle').run,
};

const aliases = {
  i: 'init',
  d: 'doctor',
  s: 'sync',
  rm: 'uninstall',
  v: 'verify',
  h: 'handoff',
  l: 'loop',
  r: 'run',
  t: 'team',
};

function printUsage() {
  console.log(`LazyTrae CLI v${CURRENT_VERSION} — Trae-native workflows

Usage: lazytrae <command> [options]

Commands:
  init        Install LazyTrae into the current repo
  onboard     Compatible onboarding alias for safe core installation
  initdeep    Compatible InitDeep alias for safe core installation
  doctor      Check LazyTrae installation health
  sync        Update managed templates and managed blocks
  status      Report independent package and host adapter evidence
  offboard    Remove exact outputs owned by one host adapter
  uninstall   Remove LazyTrae from the current repo
  verify      Run doctor checks; --must-pass also checks completion gates
  completion-status
              Print ready/blocked status for completion gates
  handoff     Print handoff summary from current state
  hook        Dispatch a LazyTrae hook event
  mcp         Start the LazyTrae MCP server (stdio JSON-RPC)
  loop        Long-horizon execution loop status and control
  run         Present explicit model routing for the supported Trae IDE route
  team        Team mode / parallel-work coordination
  work        Install or inspect global Trae Work skills
  tooling     Manage a package-owned local tooling root
  setup       Inspect provider setup without consuming credentials
  providers   Inspect, configure, or safely test providers
  lsp         Start the separate managed read-only LSP MCP bridge
  codegraph   Start the separate optional receipt-owned CodeGraph MCP bridge
  load-check  Verify every host component is ready after init
  host-probe  Safely inspect Trae host identity and capabilities
  traecli-candidate
              Generate inert Trae CLI assets or invoke a probe-proven structured runner
  lifecycle   Manage the durable verified package bundle

Aliases: i, d, s, rm, v, h, l, r, t

Run 'lazytrae <command> --help' for more info.
`);
}

function main() {
  const args = process.argv.slice(2);
  const cmdName = args[0] || '';
  const resolved = aliases[cmdName] || cmdName;

  if (!resolved || resolved === '--help' || resolved === '-h') {
    printUsage();
    process.exit(0);
  }

  // mcp is a special command — it starts a server, not a CLI action
  if (resolved === 'mcp') {
    commands.mcp()([]);
    return;
  }

  if (!commands[resolved]) {
    console.error(`lazytrae: Unknown command '${cmdName}'`);
    console.error('Run "lazytrae --help" for usage.');
    process.exit(1);
  }

  const cmdArgs = args.slice(1);
  const run = commands[resolved]();
  const exitCode = run(cmdArgs);
  if (exitCode && typeof exitCode.then === 'function') {
    exitCode.then(code => { if (typeof code === 'number') process.exitCode = code; });
    return;
  }
  if (typeof exitCode === 'number') process.exitCode = exitCode;
}

main();
