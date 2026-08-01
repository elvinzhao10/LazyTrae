#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RELEASE_VERSION = '1.0.3';

function readRoot(args) {
  const indexes = args.flatMap((value, index) => value === '--root' ? [index] : []);
  if (indexes.length === 0) return null;
  if (indexes.length !== 1) throw new Error('--root may be provided only once.');
  const index = indexes[0];
  const root = args[index + 1];
  if (!root || root.startsWith('--')) throw new Error('--root requires an absolute project path.');
  if (!path.isAbsolute(root)) throw new Error('--root must be an absolute project path.');
  let stat;
  try {
    stat = fs.statSync(root);
  } catch (error) {
    throw new Error(`--root project is unavailable at ${JSON.stringify(root)}: ${error.message}`, { cause: error });
  }
  if (!stat.isDirectory()) throw new Error(`--root must name a directory: ${JSON.stringify(root)}.`);
  args.splice(index, 2);
  return fs.realpathSync(root);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-V')) {
    process.stdout.write(`${RELEASE_VERSION}\n`);
    return;
  }
  const root = readRoot(args);
  if (root) process.chdir(root);
  process.argv = [process.execPath, __filename, ...args];
  require('../src/index.js');
}

try {
  main();
} catch (error) {
  console.error(`lazytrae: ${error.message}`);
  process.exitCode = 1;
}
