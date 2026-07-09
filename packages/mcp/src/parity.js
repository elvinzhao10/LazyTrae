const fs = require('fs');
const path = require('path');

/**
 * Parity ledger coverage checker.
 * Same logic as packages/cli/src/lib/parity-check.js but returns JSON.
 */

const EXPECTED_CATEGORIES = [
  'Core Commands',
  'Agent Roles',
  'Hooks',
  'State Management',
  'Verification Gates',
  'MCP Servers',
  'Model Routing',
  'Skills (Shared)',
  'Ultrawork/ulw-loop Core',
  'Rules Component',
];

/**
 * Parse the parity ledger markdown file and return summary stats.
 * @param {string} repoRoot
 * @returns {{ present: boolean, errors: string[], total?: number, complete?: number, design?: number, gap?: number, deferred?: number, na?: number, coverage?: string, categories?: Array }}
 */
function getParityStatus(repoRoot) {
  const ledgerPath = path.join(repoRoot, 'docs', 'lazytrae-parity-ledger.md');
  if (!fs.existsSync(ledgerPath)) {
    return {
      present: false,
      errors: ['Parity ledger not found at docs/lazytrae-parity-ledger.md'],
    };
  }

  const content = fs.readFileSync(ledgerPath, 'utf-8');
  const issues = [];

  for (const cat of EXPECTED_CATEGORIES) {
    if (!content.includes(cat)) {
      issues.push('Missing category section: "' + cat + '"');
    }
  }

  // Parse the summary table row
  // Format: | Category | Total | DESIGN | GAP | DEFERRED | N/A | COMPLETE |
  // We need to parse individual category rows and the TOTAL row
  const categories = [];
  const rowRe = /\|\s*\*{0,2}([A-Za-z/\s-]+?)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|/g;
  let match;
  while ((match = rowRe.exec(content)) !== null) {
    const name = match[1].trim();
    const total = parseInt(match[2], 10);
    const design = parseInt(match[3], 10);
    const gap = parseInt(match[4], 10);
    const deferred = parseInt(match[5], 10);
    const na = parseInt(match[6], 10);
    const complete = parseInt(match[7], 10);

    if (name === 'TOTAL') {
      const coverage = total > 0 ? ((complete / total) * 100).toFixed(1) : '0.0';
      return {
        present: true,
        errors: issues,
        total,
        complete,
        design,
        gap,
        deferred,
        na,
        coverage: coverage + '%',
        categories,
      };
    }

    categories.push({
      category: name,
      total,
      complete,
      design,
      gap,
      deferred,
      na,
      coverage: total > 0 ? ((complete / total) * 100).toFixed(1) + '%' : '0.0%',
    });
  }

  return {
    present: true,
    errors: issues.length > 0 ? issues : ['Summary table row not parseable'],
  };
}

module.exports = { getParityStatus, EXPECTED_CATEGORIES };