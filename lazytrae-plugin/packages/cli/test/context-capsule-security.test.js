'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { makeFixture, runCli } = require('./test-helpers');

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function hostileState() {
  return {
    boulder: {
      schema_version: 2,
      active_work_id: 'work-safe',
      works: {
        'work-safe': {
          work_id: 'work-safe',
          objective: 'Bearer objective-secret-value',
          active_plan: 'token=plan-path-secret',
          plan_revision: digest('plan-safe'),
          tasks: [
            {
              id: 'task-complete', description: 'complete', status: 'complete',
              evidence_paths: ['api_key=completed-evidence-secret'],
            },
            {
              id: 'task-current', status: 'in_progress',
              description: 'api_key=description-secret',
              plan_section: 'secret=section-secret',
              owned_paths: ['client_secret=owned-path-secret'],
              criteria: ['x-api-key=criteria-secret'],
              commands: ['Authorization: Basic command-secret'],
              manual_qa_surface: 'password=manual-secret',
              evidence_destination: 'credential=evidence-destination-secret',
              authority_constraints: [
                '-----BEGIN PRIVATE KEY-----\nprivate-material-secret\n-----END PRIVATE KEY-----',
              ],
              adversarial_requirements: ['refresh_token=adversarial-secret'],
              review_paths: ['cookie=review-path-secret'],
            },
          ],
          blockers: [{ reason: 'proxy-authorization=work-blocker-secret' }],
        },
      },
    },
    loop: {
      run_id: 'run-safe',
      loop_state: 'active',
      adaptive: {
        requestDigest: digest('request-safe'),
        revisionFingerprint: { status: 'available', digest: digest('revision-safe') },
        scopeFingerprint: digest('scope-safe'),
      },
      checkpoints: [{
        id: 'checkpoint-safe', status: 'complete',
        summary: 'Token checkpoint-summary-secret',
        evidence_paths: ['API_KEY=checkpoint-evidence-secret'],
      }],
      review_blockers: [{ reason: 'id_token=review-blocker-secret' }],
    },
    sessions: { current_session_id: 'session-safe' },
  };
}

function writeState(root, state) {
  const stateRoot = path.join(root, '.lazytrae', 'state');
  for (const [name, value] of [
    ['boulder.json', state.boulder],
    ['active-loop.json', state.loop],
    ['sessions.json', state.sessions],
  ]) fs.writeFileSync(path.join(stateRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

function capsuleFrom(result) {
  const line = result.stdout.split('\n').find((entry) => entry.startsWith('{"lazytraeContext"'));
  assert.ok(line, result.stdout);
  return JSON.parse(line).lazytraeContext;
}

test('session hooks redact every secret-bearing free-text capsule field', async (t) => {
  for (const event of ['session-start', 'recover-context']) {
    await t.test(event, () => {
      // Given: every caller-controlled free-text field contains a distinct secret form.
      const root = makeFixture(`lazytrae-context-redaction-${event}-`);
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const state = hostileState();
      writeState(root, state);

      // When: the real hook adapter emits current context.
      const result = runCli(['hook', event], { cwd: root });
      const capsule = capsuleFrom(result);

      // Then: every free-text projection is redacted while structural identity stays exact.
      assert.equal(result.status, 0, result.stderr);
      const projected = [
        capsule.objective, capsule.task.description, capsule.plan.path, capsule.plan.section,
        capsule.owned_paths, capsule.criteria, capsule.commands, capsule.manual_qa_surface,
        capsule.evidence_destination, capsule.authority_constraints,
        capsule.adversarial_requirements, capsule.accepted_boundaries[0].summary,
        capsule.accepted_boundaries[0].evidence_paths, capsule.evidence_pointers,
        capsule.review_pointers, capsule.blockers,
      ];
      for (const field of projected) assert.match(JSON.stringify(field), /\[REDACTED\]/);
      assert.doesNotMatch(JSON.stringify(capsule), /objective-secret|description-secret|plan-path-secret|section-secret|owned-path-secret|criteria-secret|command-secret|manual-secret|evidence-destination-secret|private-material-secret|adversarial-secret|checkpoint-summary-secret|checkpoint-evidence-secret|completed-evidence-secret|review-path-secret|work-blocker-secret|review-blocker-secret/);
      assert.deepEqual(capsule.identity, {
        work_id: 'work-safe', run_id: 'run-safe', task_id: 'task-current',
        request_digest: digest('request-safe'),
        revision_fingerprint: { status: 'available', digest: digest('revision-safe') },
        scope_fingerprint: digest('scope-safe'), plan_revision: digest('plan-safe'),
      });
      assert.equal(capsule.task.status, 'in_progress');
    });
  }
});
