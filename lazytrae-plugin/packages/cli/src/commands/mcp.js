#!/usr/bin/env node

/**
 * CLI mcp command — thin wrapper that delegates to packages/mcp/.
 * This is the entry point for `lazytrae mcp`.
 */

const path = require('path');
const fs = require('fs');

function resolveMcpIndex() {
  const sourceMcp = path.resolve(__dirname, '..', '..', '..', 'mcp', 'src', 'index.js');
  if (fs.existsSync(sourceMcp)) return sourceMcp;
  return path.resolve(__dirname, '..', 'mcp', 'index.js');
}

function run(_args) {
  // Find the mcp package relative to the CLI package
  require(resolveMcpIndex()).main();
}

module.exports = { run, resolveMcpIndex };
