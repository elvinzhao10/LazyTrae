#!/usr/bin/env node

const { existsSync } = require('fs');
const path = require('path');

const commands = {
  init: () => require('./commands/init').run,
  doctor: () => require('./commands/doctor').run,
  sync: () => require('./commands/sync').run,
  uninstall: () => require('./commands/uninstall').run,
  verify: () => require('./commands/verify').run,
  'completion-status': () => require('./commands/completion-status').run,
  handoff: () => require('./commands/handoff').run,
  hook: () => require('./commands/hook').run,
  mcp: () => require('./commands/mcp').run,
  loop: () => require('./commands/loop').run,
  run: () => require('./commands/run').run,
  team: () => require('./commands/team').run,
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
  console.log(`LazyTrae CLI v0.8.0 — Trae-native LazyCodex/OmO workflows

Usage: lazytrae <command> [options]

Commands:
  init        Install LazyTrae into the current repo
  doctor      Check LazyTrae installation health
  sync        Update managed templates and managed blocks
  uninstall   Remove LazyTrae from the current repo
  verify      Run doctor checks; --must-pass also checks completion gates
  completion-status
              Print ready/blocked status for completion gates
  handoff     Print handoff summary from current state
  hook        Dispatch a LazyTrae hook event
  mcp         Start the LazyTrae MCP server (stdio JSON-RPC)
  loop        Long-horizon execution loop status and control
  run         Execute a task with explicit model routing (optional trae-agent backend)
  team        Team mode / parallel-work coordination

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
  run(cmdArgs);
}

main();
