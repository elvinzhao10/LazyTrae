#!/usr/bin/env node

/**
 * CLI mcp command — thin wrapper that delegates to packages/mcp/.
 * This is the entry point for `lazytrae mcp`.
 */

const path = require('path');

function run(_args) {
  // Find the mcp package relative to the CLI package
  const mcpIndex = path.resolve(__dirname, '..', '..', 'mcp', 'src', 'index.js');
  require(mcpIndex).main();
}

module.exports = { run };