const fs = require('fs');
const path = require('path');

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

function checkParityLedger(repoRoot) {
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
      issues.push(`Missing category section: "${cat}"`);
    }
  }

  const summaryMatch = content.match(/Summary[\s\S]*?TOTAL.*?(\d+).*?(\d+).*?(\d+).*?(\d+).*?(\d+).*?(\d+)/);
  if (summaryMatch) {
    const total = parseInt(summaryMatch[1], 10);
    const complete = parseInt(summaryMatch[2], 10);
    const design = parseInt(summaryMatch[3], 10);
    const gap = parseInt(summaryMatch[4], 10);
    const deferred = parseInt(summaryMatch[5], 10);
    const na = parseInt(summaryMatch[6], 10);

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
      coverage,
    };
  }

  return {
    present: true,
    errors: issues.length > 0 ? issues : ['Summary table not parseable'],
  };
}

module.exports = { checkParityLedger, EXPECTED_CATEGORIES };