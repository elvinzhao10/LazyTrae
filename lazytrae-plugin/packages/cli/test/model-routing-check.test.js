const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkModelRouting, EXPECTED_CATEGORIES } = require('../src/lib/model-routing-check');

function check(t, routing) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-routing-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.lazytrae'));
  fs.writeFileSync(path.join(root, '.lazytrae/config.json'), JSON.stringify({ routing }));
  return checkModelRouting(root);
}

function validRouting() {
  return Object.fromEntries(EXPECTED_CATEGORIES.map(category => [category, {
    traeMode: 'auto', agents: ['explorer'],
  }]));
}

test('accepts complete configured route values', t => {
  // Given
  const routing = validRouting();
  // When
  const result = check(t, routing);
  // Then
  assert.equal(result.status, 'PASS');
});

for (const invalid of [null, [], '', {}, { traeMode: '', agents: ['explorer'] },
  { traeMode: 'auto', agents: [] }, { traeMode: 'auto', agents: [null] }]) {
  test(`rejects unusable route value ${JSON.stringify(invalid)}`, t => {
    // Given
    const routing = { ...validRouting(), quick: invalid };
    // When
    const result = check(t, routing);
    // Then
    assert.equal(result.status, 'FAIL');
  });
}

test('rejects a missing category', t => {
  // Given
  const routing = validRouting();
  delete routing.quick;
  // When
  const result = check(t, routing);
  // Then
  assert.equal(result.status, 'FAIL');
});

test('reports invalid configuration instead of throwing on JSON null', t => {
  // Given
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazytrae-routing-null-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.lazytrae'));
  fs.writeFileSync(path.join(root, '.lazytrae/config.json'), 'null');
  // When
  const result = checkModelRouting(root);
  // Then
  assert.equal(result.status, 'FAIL');
});
