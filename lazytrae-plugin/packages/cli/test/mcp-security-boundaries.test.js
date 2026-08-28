'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeCompletionFixture } = require('./test-helpers');
const source = require('../../mcp/src/handlers-evidence');
const fallback = require('../src/mcp/handlers-evidence');
const sourceReview = require('../../mcp/src/handlers-review');
const fallbackReview = require('../src/mcp/handlers-review');

test('MCP source and fallback evidence writers redact secret-bearing input', () => {
  // Given: user-controlled evidence fields containing credential material.
  const fixture = makeCompletionFixture('lazytrae-mcp-secret-redaction-', false);
  const secret = `sk-${'A'.repeat(28)}`;
  try {
    // When: both packaged evidence boundaries serialize the fixture.
    for (const handler of [source.handleRecordEvidence, fallback.handleRecordEvidence]) {
      handler(fixture, {
        gate_type: 'manual_qa', verdict: 'pass', outputs: [`password=${secret}`], notes: `Bearer ${secret}`,
      });
    }

    // Then: neither stored evidence artifact discloses the secret.
    const stored = fs.readFileSync(path.join(fixture, '.lazytrae', 'evidence', 'verifier.md'), 'utf8');
    assert.doesNotMatch(stored, new RegExp(secret));
    assert.match(stored, /\[REDACTED\]/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('MCP evidence persistence redacts structured credential fields without removing safe nested fields', () => {
  // Given: JSON-shaped evidence with direct, header, and nested credential values.
  const fixture = makeCompletionFixture('lazytrae-mcp-structured-redaction-', false);
  const directToken = `token-${'C'.repeat(24)}`;
  const basicValue = `basic-${'D'.repeat(24)}`;
  const bearerValue = `bearer-${'E'.repeat(24)}`;
  const structuredEvidence = JSON.stringify({
    safe: 'observable-safe-field',
    token: directToken,
    headers: {
      authorization: `Basic ${basicValue}`,
      'proxy-authorization': `Bearer ${bearerValue}`,
    },
    nested: { label: 'observable-nested-field', credential: { token: bearerValue } },
  });
  try {
    // When: the public evidence handlers persist the untrusted structured text.
    for (const handler of [source.handleRecordEvidence, fallback.handleRecordEvidence]) {
      handler(fixture, {
        gate_type: 'manual_qa',
        verdict: 'pass',
        outputs: [structuredEvidence, `{"token":"${directToken}", malformed`],
      });
    }

    // Then: stored evidence exposes safe fields but no direct or nested credential value.
    const stored = fs.readFileSync(path.join(fixture, '.lazytrae', 'evidence', 'verifier.md'), 'utf8');
    for (const value of [directToken, basicValue, bearerValue]) {
      assert.equal(stored.includes(value), false);
    }
    assert.match(stored, /\[REDACTED\]/);
    assert.match(stored, /observable-safe-field/);
    assert.match(stored, /observable-nested-field/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('MCP source and fallback review writers redact secret-bearing input', () => {
  // Given: review context carrying a fixture credential.
  const fixture = makeCompletionFixture('lazytrae-review-secret-redaction-', false);
  const secret = `sk-${'B'.repeat(28)}`;
  try {
    // When: both review evidence boundaries persist the request.
    for (const handler of [sourceReview.handleRequestReview, fallbackReview.handleRequestReview]) {
      handler(fixture, { review_type: 'full', context: `token=${secret}`, files_changed: [] });
    }

    // Then: the review artifact preserves context without disclosing the credential.
    const stored = fs.readFileSync(path.join(fixture, '.lazytrae', 'evidence', 'oracle-review.md'), 'utf8');
    assert.doesNotMatch(stored, new RegExp(secret));
    assert.match(stored, /\[REDACTED\]/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
