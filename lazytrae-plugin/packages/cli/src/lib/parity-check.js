function checkParityLedger(repoRoot) {
  return {
    present: true,
    errors: [],
    total: 0,
    complete: 0,
    coverage: 'not applicable',
    detail: 'Historical parity records are optional private material and are not read by LazyTrae.',
  };
}

module.exports = { checkParityLedger };
