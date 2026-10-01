const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('Given the installed dependency tree, when every fast-uri edge is listed, then direct and Ajv copies are patched', () => {
  const root = path.join(__dirname, '..');
  const tree = JSON.parse(execFileSync('npm', ['ls', 'fast-uri', '--all', '--json'], { cwd: root, encoding: 'utf8' }));
  const direct = tree.dependencies['fast-uri'].version;
  const nested = tree.dependencies.ajv.dependencies['fast-uri'].version;
  assert.equal(direct, '4.1.5');
  assert.equal(nested, '3.1.8');
});


const { createRequire } = require('node:module');
const implementations = {
  direct: require('fast-uri'),
  ajv: createRequire(require.resolve('ajv'))('fast-uri'),
};

for (const [name, uri] of Object.entries(implementations)) {
  test(`Given ${name} URI parsing, when a scheme-relative host uses encoded uppercase, then host decisions agree`, () => {
    // GHSA-hrr3-gc8f-f4qj: encoding must not bypass host canonicalization.
    assert.equal(uri.parse('//%41.com').host, 'a.com');
    assert.equal(uri.normalize('//%41.com'), uri.normalize('//a.com'));
    assert.equal(uri.equal('//%41.com', '//a.com'), true);
  });
}

test('Given encoded mailto fields, when serialized and reparsed, then checked recipients and fields stay identical', () => {
  // GHSA-jvvf-x445-j334: reserved field names must be decoded before decisions.
  const uri = implementations.direct;
  const parsed = uri.parse('mailto:checked@example.test?%74o=extra@example.test&%73ubject=subject&%62ody=body');
  const reparsed = uri.parse(uri.serialize(parsed));
  assert.deepEqual(parsed.to, ['checked@example.test', 'extra@example.test']);
  assert.equal(parsed.subject, 'subject');
  assert.equal(parsed.body, 'body');
  assert.deepEqual(reparsed.to, parsed.to);
  assert.equal(reparsed.subject, parsed.subject);
  assert.equal(reparsed.body, parsed.body);
});
