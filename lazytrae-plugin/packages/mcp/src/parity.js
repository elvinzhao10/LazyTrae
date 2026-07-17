function getParityStatus(repoRoot) {
  return {
    present: true,
    errors: [],
    total: 0,
    complete: 0,
    coverage: 'not applicable',
    categories: [],
    detail: 'Historical parity records are optional private material and are not read by LazyTrae.',
  };
}

module.exports = { getParityStatus };
