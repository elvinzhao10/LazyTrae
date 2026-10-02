const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('Given the installed dependency tree, when every fast-uri edge is listed, then direct and Ajv copies are patched', () => {
  const root = path.join(__dirname, '..');
  const tree = JSON.parse(execFileSync('npm', ['ls', 'fast-uri', '--all', '--json'], { cwd: root, encoding: 'utf8' }));
  const direct = tree.dependencies['fast-uri'].version;
  const nested = tree.dependencies.ajv.dependencies['fast-uri'].version;
  const manifest = require('../package.json');
  assert.equal(direct, manifest.dependencies['fast-uri']);
  assert.equal(nested, manifest.overrides.ajv['fast-uri']);
});


const { createRequire } = require('node:module');
const implementations = {
  direct: require('fast-uri'),
  ajv: createRequire(require.resolve('ajv'))('fast-uri'),
};

test('Given mailto authority recipients, when repeatedly normalized, then normalization reaches a stable result', () => {
  const uri = implementations.direct;
  const first = uri.normalize('mailto://host/recipient@example.test?to=other@example.test');
  assert.equal(uri.normalize(first), first);
  assert.equal(uri.serialize({ scheme: 'mailto', host: 'host', to: ['recipient@example.test'] }), 'mailto:recipient@example.test');
});

test('Given an IPv6 zone identifier, when serialized and normalized, then the zone survives consistently', () => {
  const uri = implementations.direct;
  const input = 'http://[fe80::1%25eth0]/';
  const normalized = uri.normalize(input);
  assert.equal(uri.normalize(normalized), normalized);
  assert.equal(uri.parse(uri.serialize(uri.parse(input))).host, uri.parse(input).host);
  assert.equal(uri.equal(input, normalized), true);
});

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
